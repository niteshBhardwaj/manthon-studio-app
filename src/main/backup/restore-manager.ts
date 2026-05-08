import { BrowserWindow, app, dialog, type MessageBoxOptions } from 'electron'
import { createWriteStream } from 'fs'
import { cp, mkdir, mkdtemp, rm, stat } from 'fs/promises'
import { request } from 'https'
import { join } from 'path'
import { Worker } from 'worker_threads'
import { assetManager } from '../store/asset-manager'
import { appStore } from '../store/app-store'
import { databaseManager } from '../store/db'
import { storageManager } from '../store/storage-manager'
import { queueManager } from '../queue/queue-manager'
import { logger } from '../logger'
import { MIGRATIONS } from '../store/schema'
import { googleAuth } from './google-auth'
import type { BackupProgress, RestoreResult } from './types'

interface RestorePreview {
  dbPath: string
  assetsPath: string
  generationCount: number
  assetCount: number
  projectCount: number
  schemaVersion: number
  extractedSize: number
}

interface WorkerDoneMessage {
  type: 'done'
  preview: RestorePreview
}

interface WorkerProgressMessage {
  type: 'progress'
  progress: BackupProgress
}

interface WorkerErrorMessage {
  type: 'error'
  error: string
}

type WorkerMessage = WorkerDoneMessage | WorkerProgressMessage | WorkerErrorMessage

function getCurrentSchemaVersion(): number {
  return Math.max(...MIGRATIONS.map((migration) => migration.version))
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

class RestoreManager {
  async restoreBackup(driveFileId: string, password?: string): Promise<RestoreResult> {
    const userDataPath = app.getPath('userData')
    const tempRoot = join(userDataPath, 'temp')
    await mkdir(tempRoot, { recursive: true })
    const tempDir = await mkdtemp(join(tempRoot, 'restore-'))

    try {
      const metadata = await this.getDriveFileMetadata(driveFileId)
      const downloadPath = join(tempDir, metadata.name || 'backup.zip')
      await this.downloadBackup(driveFileId, downloadPath, metadata.size)

      const preview = await this.runRestoreWorker({
        inputPath: downloadPath,
        outputDir: tempDir,
        encrypted: metadata.encrypted,
        password,
        currentSchemaVersion: getCurrentSchemaVersion()
      })

      const confirmed = await this.confirmRestore(preview)
      if (!confirmed) return { restoredGenerations: 0, restoredAssets: 0, restoredProjects: 0, canceled: true }

      await this.applyRestore(preview)
      return {
        restoredGenerations: preview.generationCount,
        restoredAssets: preview.assetCount,
        restoredProjects: preview.projectCount
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch((error) => {
        logger.warn('Restore', 'Failed to clean temporary restore files:', error)
      })
    }
  }

  private async getDriveFileMetadata(
    driveFileId: string
  ): Promise<{ name: string; size: number; encrypted: boolean }> {
    const drive = await googleAuth.getDriveClient()
    const response = await drive.files.get({
      fileId: driveFileId,
      fields: 'id,name,size,appProperties'
    })
    const name = response.data.name ?? 'backup.zip'
    return {
      name,
      size: Number(response.data.size ?? 0),
      encrypted: response.data.appProperties?.encrypted === 'true' || name.endsWith('.enc')
    }
  }

  private async downloadBackup(driveFileId: string, targetPath: string, expectedSize: number): Promise<void> {
    const accessToken = await googleAuth.getAccessToken()
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${driveFileId}`)
    url.searchParams.set('alt', 'media')
    this.emitProgress({ phase: 'downloading', percent: 0, message: 'Downloading backup' })

    await new Promise<void>((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        },
        (res) => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            let body = ''
            res.setEncoding('utf8')
            res.on('data', (chunk) => {
              body += chunk
            })
            res.on('end', () => reject(new Error(`Google Drive download failed: ${res.statusCode} ${body}`)))
            return
          }

          let downloadedBytes = 0
          res.on('data', (chunk: string | Buffer) => {
            downloadedBytes += Buffer.byteLength(chunk)
            this.emitProgress({
              phase: 'downloading',
              percent: Math.min(99, Math.round((downloadedBytes / Math.max(1, expectedSize)) * 100)),
              message: 'Downloading backup'
            })
          })
          const output = createWriteStream(targetPath)
          output.on('finish', () => {
            this.emitProgress({ phase: 'downloading', percent: 100, message: 'Backup downloaded' })
            resolve()
          })
          output.on('error', reject)
          res.pipe(output)
        }
      )
      req.on('error', reject)
      req.end()
    })
  }

  private runRestoreWorker(data: {
    inputPath: string
    outputDir: string
    encrypted: boolean
    password?: string
    currentSchemaVersion: number
  }): Promise<RestorePreview> {
    const workerPath = join(__dirname, 'backup', 'restore-worker.js')
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, { workerData: data })

      worker.on('message', (message: WorkerMessage) => {
        if (message.type === 'progress') {
          this.emitProgress(message.progress)
        } else if (message.type === 'done') {
          resolve(message.preview)
        } else if (message.type === 'error') {
          reject(new Error(message.error))
        }
      })
      worker.on('error', reject)
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Restore worker exited with code ${code}`))
      })
    })
  }

  private async confirmRestore(preview: RestorePreview): Promise<boolean> {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options: MessageBoxOptions = {
      type: 'warning',
      buttons: ['Restore Backup', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Restore Backup',
      message: 'Restore this Google Drive backup?',
      detail:
        `This will replace the current Manthan Studio database and assets.\n\n` +
        `Projects: ${preview.projectCount}\n` +
        `Generations: ${preview.generationCount}\n` +
        `Assets: ${preview.assetCount}\n` +
        `Extracted size: ${formatBytes(preview.extractedSize)}\n` +
        `Schema version: ${preview.schemaVersion}`
    }
    const result = focusedWindow
      ? await dialog.showMessageBox(focusedWindow, options)
      : await dialog.showMessageBox(options)
    return result.response === 0
  }

  private async applyRestore(preview: RestorePreview): Promise<void> {
    this.emitProgress({ phase: 'restoring', percent: 0, message: 'Closing current database' })
    const dbPath = databaseManager.getDbPath()
    const assetsRoot = join(app.getPath('userData'), 'assets')
    const restoredAssetsStat = await stat(preview.assetsPath).catch(() => null)

    queueManager.shutdown()
    databaseManager.close()

    try {
      this.emitProgress({ phase: 'restoring', percent: 35, message: 'Replacing database' })
      await cp(preview.dbPath, dbPath, { force: true })

      this.emitProgress({ phase: 'restoring', percent: 65, message: 'Replacing assets' })
      await rm(assetsRoot, { recursive: true, force: true })
      if (restoredAssetsStat?.isDirectory()) {
        await cp(preview.assetsPath, assetsRoot, { recursive: true, force: true })
      } else {
        await mkdir(assetsRoot, { recursive: true })
      }
    } finally {
      databaseManager.initialize()
      assetManager.initialize()
      storageManager.initialize()
      appStore.initialize()
      queueManager.initialize()
    }

    this.emitProgress({ phase: 'restoring', percent: 100, message: 'Restore complete' })
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.reload()
      }
    }
  }

  private emitProgress(progress: BackupProgress): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('restore:progress', progress)
      }
    }
  }
}

export const restoreManager = new RestoreManager()
