import { BrowserWindow, app } from 'electron'
import { createReadStream } from 'fs'
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from 'fs/promises'
import { request } from 'https'
import { join, relative, sep } from 'path'
import { Worker } from 'worker_threads'
import { databaseManager } from '../store/db'
import { assetManager } from '../store/asset-manager'
import { logger } from '../logger'
import { MIGRATIONS } from '../store/schema'
import { googleAuth } from './google-auth'
import type {
  BackupInfo,
  BackupManifest,
  BackupProgress,
  BackupSettings,
  CreateBackupOptions,
  CreateBackupResult
} from './types'

const BACKUP_SETTINGS_KEY = 'backupSettings'
const FIVE_MB = 5 * 1024 * 1024

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoBackupEnabled: false,
  autoBackupIntervalHours: 24,
  encryptBackups: false,
  autoSyncGeneratedVideos: false,
  lastBackupAt: null,
  lastBackupSize: null,
  lastBackupDriveFileId: null,
  driveQuota: null
}

interface FileEntry {
  path: string
  archivePath: string
  size: number
}

interface UploadMetadata {
  name: string
  parents: string[]
  appProperties: Record<string, string>
}

interface WorkerDoneMessage {
  type: 'done'
  outputPath: string
  size: number
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

function toDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

class BackupManager {
  private autoBackupTimer: NodeJS.Timeout | null = null
  private sessionBackupPassword: string | null = null

  async createBackup(options: CreateBackupOptions): Promise<CreateBackupResult> {
    if (options.encrypt && !options.password) {
      throw new Error('Enter a password before creating an encrypted backup.')
    }

    const authStatus = await googleAuth.isAuthenticated()
    if (!authStatus.authenticated) {
      throw new Error('Connect Google Drive before creating a backup.')
    }

    const userDataPath = app.getPath('userData')
    const tempRoot = join(userDataPath, 'temp')
    await mkdir(tempRoot, { recursive: true })
    const tempDir = await mkdtemp(join(tempRoot, 'backup-'))
    const timestamp = new Date().toISOString()
    const safeTimestamp = timestamp.replace(/[:.]/g, '-')
    const baseName = `manthan-backup-${safeTimestamp}.zip`
    const zipPath = join(tempDir, baseName)
    const outputPath = options.encrypt ? join(tempDir, `${baseName}.enc`) : zipPath

    try {
      this.emitProgress({ phase: 'packaging', percent: 0, message: 'Preparing database copy' })
      databaseManager.getDb().pragma('wal_checkpoint(TRUNCATE)')
      const dbCopyPath = join(tempDir, 'manthan.db')
      await copyFile(databaseManager.getDbPath(), dbCopyPath)

      const assetsRoot = join(userDataPath, 'assets')
      const files = await this.enumerateAssetFiles(assetsRoot)
      const manifest: BackupManifest = {
        app: 'manthan-studio',
        version: 1,
        createdAt: timestamp,
        schemaVersion: getCurrentSchemaVersion(),
        assetCount: files.length,
        databaseFile: 'manthan.db'
      }

      const workerResult = await this.runBackupWorker({
        dbPath: dbCopyPath,
        zipPath,
        outputPath,
        files,
        encrypt: options.encrypt,
        password: options.password,
        manifest
      })

      const size = workerResult.size
      const driveFileId = await this.uploadBackup({
        filePath: workerResult.outputPath,
        name: options.encrypt ? `${baseName}.enc` : baseName,
        size,
        encrypted: options.encrypt,
        timestamp,
        schemaVersion: manifest.schemaVersion
      })

      const settings = this.getSettingsSync()
      this.setSettings({
        ...settings,
        lastBackupAt: Date.now(),
        lastBackupSize: size,
        lastBackupDriveFileId: driveFileId
      })
      this.scheduleAutoBackup()

      return {
        backupId: driveFileId,
        driveFileId,
        size,
        timestamp
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch((error) => {
        logger.warn('Backup', 'Failed to clean temporary backup files:', error)
      })
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    const drive = await googleAuth.getDriveClient()
    const folderId = await googleAuth.getBackupFolderId()
    const backups: BackupInfo[] = []
    let pageToken: string | undefined

    do {
      const response = await drive.files.list({
        q:
          `'${toDriveQueryValue(folderId)}' in parents and trashed=false and ` +
          "appProperties has { key='backup' and value='true' }",
        fields: 'nextPageToken, files(id,name,size,createdTime,appProperties)',
        orderBy: 'createdTime desc',
        pageSize: 100,
        pageToken,
        spaces: 'drive'
      })

      for (const file of response.data.files ?? []) {
        if (!file.id || !file.name) continue
        backups.push({
          id: file.id,
          name: file.name,
          size: Number(file.size ?? 0),
          createdAt: file.createdTime ?? new Date(0).toISOString(),
          encrypted: file.appProperties?.encrypted === 'true' || file.name.endsWith('.enc')
        })
      }

      pageToken = response.data.nextPageToken ?? undefined
    } while (pageToken)

    return backups
  }

  async deleteBackup(driveFileId: string): Promise<{ success: boolean }> {
    const drive = await googleAuth.getDriveClient()
    await drive.files.delete({ fileId: driveFileId })
    return { success: true }
  }

  async syncGeneratedVideoAsset(assetId: string): Promise<void> {
    const settings = this.getSettingsSync()
    if (!settings.autoSyncGeneratedVideos) return

    const asset = assetManager.getAsset(assetId)
    if (!asset || asset.type !== 'video' || asset.source !== 'generated') return

    const authStatus = await googleAuth.isAuthenticated()
    if (!authStatus.authenticated) return

    const fileStat = await stat(asset.storage_path)
    const accessToken = await googleAuth.getAccessToken()
    const folderId = await googleAuth.getBackupFolderId()
    const metadata: UploadMetadata = {
      name: asset.filename,
      parents: [folderId],
      appProperties: {
        app: 'manthan-studio',
        generatedVideo: 'true',
        assetId: asset.id,
        projectId: asset.project_id ?? 'default',
        createdAt: new Date(asset.created_at).toISOString()
      }
    }

    this.emitProgress({
      phase: 'uploading',
      percent: 0,
      message: `Syncing generated video ${asset.filename}`
    })
    const sessionUrl = await this.createResumableUploadSession(accessToken, metadata, fileStat.size)
    await this.uploadFileToSession(sessionUrl, asset.storage_path, fileStat.size)
  }

  async getSettings(): Promise<BackupSettings> {
    const settings = this.getSettingsSync()
    const authStatus = await googleAuth.isAuthenticated()
    if (!authStatus.authenticated) {
      return { ...settings, driveQuota: null }
    }

    return {
      ...settings,
      driveQuota: await googleAuth.getStorageQuota()
    }
  }

  setSettings(settings: Partial<BackupSettings> & { sessionPassword?: string }): BackupSettings {
    const { sessionPassword, driveQuota: _driveQuota, ...persisted } = settings
    if (sessionPassword !== undefined) {
      this.sessionBackupPassword = sessionPassword || null
    }

    const current = this.getSettingsSync()
    const next: BackupSettings = {
      ...current,
      ...persisted,
      autoBackupIntervalHours: Math.max(
        1,
        Number(persisted.autoBackupIntervalHours ?? current.autoBackupIntervalHours)
      )
    }

    databaseManager.run('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', [
      BACKUP_SETTINGS_KEY,
      JSON.stringify(next)
    ])
    this.scheduleAutoBackup()
    return next
  }

  scheduleAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearTimeout(this.autoBackupTimer)
      this.autoBackupTimer = null
    }

    const settings = this.getSettingsSync()
    if (!settings.autoBackupEnabled) return

    const intervalMs = Math.max(1, settings.autoBackupIntervalHours) * 60 * 60 * 1000
    const nextRunAt = (settings.lastBackupAt ?? 0) + intervalMs
    const delayMs = Math.max(30_000, nextRunAt - Date.now())

    this.autoBackupTimer = setTimeout(() => {
      void this.runScheduledBackup()
    }, delayMs)
  }

  private async runScheduledBackup(): Promise<void> {
    try {
      const settings = this.getSettingsSync()
      if (!settings.autoBackupEnabled) return
      if (settings.encryptBackups && !this.sessionBackupPassword) {
        logger.warn('Backup', 'Skipping encrypted auto-backup because no session password is available.')
        return
      }

      await this.createBackup({
        encrypt: settings.encryptBackups,
        password: settings.encryptBackups ? this.sessionBackupPassword ?? undefined : undefined
      })
    } catch (error) {
      logger.warn('Backup', 'Scheduled backup failed:', error)
    } finally {
      this.scheduleAutoBackup()
    }
  }

  private getSettingsSync(): BackupSettings {
    const row = databaseManager.queryOne<{ value: string }>(
      'SELECT value FROM preferences WHERE key = ?',
      [BACKUP_SETTINGS_KEY]
    )
    if (!row?.value) return { ...DEFAULT_BACKUP_SETTINGS }

    try {
      const parsed = JSON.parse(row.value) as Partial<BackupSettings>
      return {
        ...DEFAULT_BACKUP_SETTINGS,
        ...parsed,
        driveQuota: null,
        autoBackupIntervalHours: Math.max(
          1,
          Number(parsed.autoBackupIntervalHours ?? DEFAULT_BACKUP_SETTINGS.autoBackupIntervalHours)
        )
      }
    } catch {
      return { ...DEFAULT_BACKUP_SETTINGS }
    }
  }

  private async enumerateAssetFiles(assetsRoot: string): Promise<FileEntry[]> {
    const files: FileEntry[] = []
    await this.walkFiles(assetsRoot, async (filePath) => {
      const fileStat = await stat(filePath)
      files.push({
        path: filePath,
        archivePath: ['assets', relative(assetsRoot, filePath).split(sep).join('/')].join('/'),
        size: fileStat.size
      })
    })
    return files
  }

  private async walkFiles(dirPath: string, onFile: (filePath: string) => Promise<void>): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        if (entry.isDirectory()) {
          await this.walkFiles(fullPath, onFile)
        } else if (entry.isFile()) {
          await onFile(fullPath)
        }
      }
    } catch {
      return
    }
  }

  private runBackupWorker(data: {
    dbPath: string
    zipPath: string
    outputPath: string
    files: FileEntry[]
    encrypt: boolean
    password?: string
    manifest: BackupManifest
  }): Promise<{ outputPath: string; size: number }> {
    const workerPath = join(__dirname, 'backup', 'backup-worker.js')
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, { workerData: data })

      worker.on('message', (message: WorkerMessage) => {
        if (message.type === 'progress') {
          this.emitProgress(message.progress)
        } else if (message.type === 'done') {
          resolve({ outputPath: message.outputPath, size: message.size })
        } else if (message.type === 'error') {
          reject(new Error(message.error))
        }
      })
      worker.on('error', reject)
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Backup worker exited with code ${code}`))
      })
    })
  }

  private async uploadBackup(options: {
    filePath: string
    name: string
    size: number
    encrypted: boolean
    timestamp: string
    schemaVersion: number
  }): Promise<string> {
    const accessToken = await googleAuth.getAccessToken()
    const folderId = await googleAuth.getBackupFolderId()
    const metadata: UploadMetadata = {
      name: options.name,
      parents: [folderId],
      appProperties: {
        app: 'manthan-studio',
        backup: 'true',
        encrypted: String(options.encrypted),
        createdAt: options.timestamp,
        schemaVersion: String(options.schemaVersion)
      }
    }

    this.emitProgress({
      phase: 'uploading',
      percent: 0,
      message:
        options.size > FIVE_MB
          ? 'Starting resumable Google Drive upload'
          : 'Starting Google Drive upload'
    })

    const sessionUrl = await this.createResumableUploadSession(accessToken, metadata, options.size)
    return this.uploadFileToSession(sessionUrl, options.filePath, options.size)
  }

  private createResumableUploadSession(
    accessToken: string,
    metadata: UploadMetadata,
    size: number
  ): Promise<string> {
    const body = JSON.stringify(metadata)
    const url = new URL('https://www.googleapis.com/upload/drive/v3/files')
    url.searchParams.set('uploadType', 'resumable')
    url.searchParams.set('fields', 'id')

    return new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'Content-Length': Buffer.byteLength(body),
            'X-Upload-Content-Type': 'application/octet-stream',
            'X-Upload-Content-Length': String(size)
          }
        },
        (res) => {
          const location = res.headers.location
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && location) {
            resolve(Array.isArray(location) ? location[0] : location)
            return
          }

          let responseBody = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => {
            responseBody += chunk
          })
          res.on('end', () => {
            reject(new Error(`Google Drive upload session failed: ${res.statusCode} ${responseBody}`))
          })
        }
      )

      req.on('error', reject)
      req.end(body)
    })
  }

  private uploadFileToSession(sessionUrl: string, filePath: string, size: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let uploadedBytes = 0
      const req = request(
        sessionUrl,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(size)
          }
        },
        (res) => {
          let responseBody = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => {
            responseBody += chunk
          })
          res.on('end', () => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`Google Drive upload failed: ${res.statusCode} ${responseBody}`))
              return
            }

            try {
              const parsed = JSON.parse(responseBody) as { id?: string }
              if (!parsed.id) throw new Error('Google Drive did not return a file id.')
              this.emitProgress({ phase: 'uploading', percent: 100, message: 'Backup uploaded' })
              resolve(parsed.id)
            } catch (error) {
              reject(error)
            }
          })
        }
      )

      req.on('error', reject)
      const input = createReadStream(filePath)
      input.on('data', (chunk: string | Buffer) => {
        uploadedBytes += Buffer.byteLength(chunk)
        this.emitProgress({
          phase: 'uploading',
          percent: Math.min(99, Math.round((uploadedBytes / Math.max(1, size)) * 100)),
          message: 'Uploading to Google Drive'
        })
      })
      input.on('error', reject)
      input.pipe(req)
    })
  }

  private emitProgress(progress: BackupProgress): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('backup:progress', progress)
      }
    }
  }
}

export const backupManager = new BackupManager()
