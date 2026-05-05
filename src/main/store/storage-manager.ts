import { app } from 'electron'
import { execFile } from 'child_process'
import { parse, join } from 'path'
import { mkdirSync, existsSync, statSync } from 'fs'
import { readdir, rm, stat } from 'fs/promises'
import { promisify } from 'util'
import { assetManager } from './asset-manager'
import { databaseManager } from './db'

const execFileAsync = promisify(execFile)
const RETENTION_POLICY_KEY = 'retentionPolicy'

export interface StorageBreakdown {
  video: number
  image: number
  audio: number
  cache: number
  database: number
  total: number
}

export interface DiskInfo {
  totalSpace: number
  freeSpace: number
  usedByApp: number
}

export interface RetentionPolicy {
  deleteUnstarredAfterDays: number | null
  clearCacheOnExit: boolean
  maxStorageMB: number | null
}

export interface StorageTypeStat {
  type: 'video' | 'image' | 'audio'
  count: number
  size: number
  largestFile: { name: string; size: number; path: string } | null
}

export interface StorageReport {
  breakdown: StorageBreakdown
  byType: StorageTypeStat[]
}

export interface RetentionResult {
  deletedGenerations: number
  deletedAssets: number
  freedBytes: number
}

interface RetentionGenerationRow {
  id: string
  result_asset_id: string | null
}

interface RetentionAssetRow {
  id: string
  size_bytes: number
}

const DEFAULT_POLICY: RetentionPolicy = {
  deleteUnstarredAfterDays: 30,
  clearCacheOnExit: false,
  maxStorageMB: null
}

const MEDIA_EXTENSIONS: Record<string, 'video' | 'image' | 'audio'> = {
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.bmp': 'image',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.m4a': 'audio',
  '.aac': 'audio',
  '.flac': 'audio',
  '.ogg': 'audio'
}

class StorageManager {
  private cacheRoot = ''
  private tempRoot = ''
  private assetsRoot = ''

  initialize(): void {
    const userDataPath = app.getPath('userData')
    this.assetsRoot = join(userDataPath, 'assets')
    this.cacheRoot = join(userDataPath, 'cache')
    this.tempRoot = join(userDataPath, 'temp')

    mkdirSync(this.assetsRoot, { recursive: true })
    mkdirSync(this.cacheRoot, { recursive: true })
    mkdirSync(this.tempRoot, { recursive: true })
  }

  async getStorageBreakdown(): Promise<StorageReport> {
    const byType: StorageTypeStat[] = [
      { type: 'video', count: 0, size: 0, largestFile: null },
      { type: 'image', count: 0, size: 0, largestFile: null },
      { type: 'audio', count: 0, size: 0, largestFile: null }
    ]
    const statsByType = new Map(byType.map((entry) => [entry.type, entry]))

    await this.walkDirectory(this.assetsRoot, async (path, fileStat) => {
      const ext = parse(path).ext.toLowerCase()
      const type = MEDIA_EXTENSIONS[ext]
      if (!type) return

      const entry = statsByType.get(type)
      if (!entry) return

      const fileSize = Number(fileStat.size)
      entry.count += 1
      entry.size += fileSize

      if (!entry.largestFile || fileSize > entry.largestFile.size) {
        entry.largestFile = {
          name: parse(path).base,
          size: fileSize,
          path
        }
      }
    })

    const breakdown: StorageBreakdown = {
      video: statsByType.get('video')?.size ?? 0,
      image: statsByType.get('image')?.size ?? 0,
      audio: statsByType.get('audio')?.size ?? 0,
      cache:
        (await this.getDirectorySize(this.cacheRoot)) +
        (await this.getDirectorySize(this.tempRoot)),
      database: this.getDatabaseSize(),
      total: 0
    }

    breakdown.total =
      breakdown.video + breakdown.image + breakdown.audio + breakdown.cache + breakdown.database

    return {
      breakdown,
      byType
    }
  }

  async getSystemDiskInfo(): Promise<DiskInfo> {
    const report = await this.getStorageBreakdown()
    const usedByApp = report.breakdown.total
    const userDataPath = app.getPath('userData')

    try {
      if (process.platform === 'win32') {
        const drive = parse(userDataPath).root.replace(/[\\/]+$/, '')
        const command = [
          '-NoProfile',
          '-Command',
          `$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${drive}'"; ` +
            `Write-Output "$($disk.Size)|$($disk.FreeSpace)"`
        ]
        const { stdout } = await execFileAsync('powershell.exe', command)
        const [totalSpace, freeSpace] = stdout
          .trim()
          .split('|')
          .map((value) => Number(value))

        if (!Number.isNaN(totalSpace) && !Number.isNaN(freeSpace)) {
          return { totalSpace, freeSpace, usedByApp }
        }
      } else {
        const { stdout } = await execFileAsync('df', ['-k', userDataPath])
        const lines = stdout.trim().split(/\r?\n/)
        const dataLine = lines[lines.length - 1]?.trim()
        const parts = dataLine.split(/\s+/)
        const totalSpace = Number(parts[1]) * 1024
        const freeSpace = Number(parts[3]) * 1024

        if (!Number.isNaN(totalSpace) && !Number.isNaN(freeSpace)) {
          return { totalSpace, freeSpace, usedByApp }
        }
      }
    } catch (error) {
      console.warn('[StorageManager] Failed to get system disk info:', error)
    }

    return {
      totalSpace: usedByApp,
      freeSpace: 0,
      usedByApp
    }
  }

  async cleanupCache(): Promise<number> {
    const cacheBytes = await this.getDirectorySize(this.cacheRoot)
    const tempBytes = await this.getDirectorySize(this.tempRoot)
    const freedBytes = cacheBytes + tempBytes

    await Promise.all([
      rm(this.cacheRoot, { recursive: true, force: true }),
      rm(this.tempRoot, { recursive: true, force: true })
    ])

    mkdirSync(this.cacheRoot, { recursive: true })
    mkdirSync(this.tempRoot, { recursive: true })

    return freedBytes
  }

  getRetentionPolicy(): RetentionPolicy {
    const row = databaseManager.queryOne<{ value: string }>(
      'SELECT value FROM preferences WHERE key = ?',
      [RETENTION_POLICY_KEY]
    )

    if (!row?.value) {
      return { ...DEFAULT_POLICY }
    }

    try {
      const parsed = JSON.parse(row.value) as Partial<RetentionPolicy>
      return {
        deleteUnstarredAfterDays:
          typeof parsed.deleteUnstarredAfterDays === 'number'
            ? parsed.deleteUnstarredAfterDays
            : parsed.deleteUnstarredAfterDays === null
              ? null
              : DEFAULT_POLICY.deleteUnstarredAfterDays,
        clearCacheOnExit:
          typeof parsed.clearCacheOnExit === 'boolean'
            ? parsed.clearCacheOnExit
            : DEFAULT_POLICY.clearCacheOnExit,
        maxStorageMB:
          typeof parsed.maxStorageMB === 'number'
            ? parsed.maxStorageMB
            : parsed.maxStorageMB === null
              ? null
              : DEFAULT_POLICY.maxStorageMB
      }
    } catch {
      return { ...DEFAULT_POLICY }
    }
  }

  setRetentionPolicy(policy: RetentionPolicy): { success: boolean } {
    databaseManager.run('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', [
      RETENTION_POLICY_KEY,
      JSON.stringify(policy)
    ])
    return { success: true }
  }

  async applyRetentionPolicy(policy = this.getRetentionPolicy()): Promise<RetentionResult> {
    let deletedGenerations = 0
    let deletedAssets = 0
    let freedBytes = 0
    const deletedGenerationIds = new Set<string>()

    const deleteGenerationBatch = async (generationIds: string[]): Promise<void> => {
      for (const generationId of generationIds) {
        if (deletedGenerationIds.has(generationId)) continue
        deletedGenerationIds.add(generationId)

        const assetIds = this.getAssetIdsForGeneration(generationId)
        for (const assetId of assetIds) {
          const asset = assetManager.getAsset(assetId)
          if (!asset) continue
          const assetSize = asset.size_bytes
          const deleted = await assetManager.deleteAsset(assetId)
          if (deleted) {
            deletedAssets += 1
            freedBytes += assetSize
          }
        }

        databaseManager.run('DELETE FROM generations WHERE id = ?', [generationId])
        deletedGenerations += 1
      }
    }

    if (
      typeof policy.deleteUnstarredAfterDays === 'number' &&
      policy.deleteUnstarredAfterDays >= 0
    ) {
      const cutoff = Date.now() - policy.deleteUnstarredAfterDays * 24 * 60 * 60 * 1000
      const rows = databaseManager.query<RetentionGenerationRow>(
        `SELECT id, result_asset_id
         FROM generations
         WHERE starred = 0
           AND COALESCE(completed_at, started_at, created_at) < ?`,
        [cutoff]
      )

      await deleteGenerationBatch(rows.map((row) => row.id))
    }

    if (typeof policy.maxStorageMB === 'number' && policy.maxStorageMB > 0) {
      const currentReport = await this.getStorageBreakdown()
      const maxBytes = policy.maxStorageMB * 1024 * 1024
      let overflow = currentReport.breakdown.total - freedBytes - maxBytes

      if (overflow > 0) {
        const candidates = databaseManager.query<{ id: string }>(
          `SELECT id
           FROM generations
           WHERE starred = 0
           ORDER BY COALESCE(completed_at, started_at, created_at) ASC`
        )

        for (const candidate of candidates) {
          if (overflow <= 0) break
          if (deletedGenerationIds.has(candidate.id)) continue

          const candidateAssets = this.getAssetIdsForGeneration(candidate.id)
          let candidateBytes = 0
          for (const assetId of candidateAssets) {
            const asset = assetManager.getAsset(assetId)
            candidateBytes += asset?.size_bytes ?? 0
          }

          await deleteGenerationBatch([candidate.id])
          overflow -= candidateBytes
        }
      }
    }

    return {
      deletedGenerations,
      deletedAssets,
      freedBytes
    }
  }

  private getAssetIdsForGeneration(generationId: string): string[] {
    const directAssetId = databaseManager.queryOne<{ result_asset_id: string | null }>(
      'SELECT result_asset_id FROM generations WHERE id = ?',
      [generationId]
    )?.result_asset_id

    const assetIds = new Set<string>()
    if (directAssetId) {
      assetIds.add(directAssetId)
    }

    const metadataMatches = databaseManager.query<RetentionAssetRow>(
      `SELECT id, size_bytes
       FROM assets
       WHERE json_extract(metadata, '$.jobId') = ?`,
      [generationId]
    )

    for (const row of metadataMatches) {
      assetIds.add(row.id)
    }

    return [...assetIds]
  }

  private getDatabaseSize(): number {
    try {
      const dbPath = databaseManager.getDbPath()
      let size = 0
      if (existsSync(dbPath)) {
        size += statSync(dbPath).size
      }
      if (existsSync(dbPath + '-wal')) {
        size += statSync(dbPath + '-wal').size
      }
      if (existsSync(dbPath + '-shm')) {
        size += statSync(dbPath + '-shm').size
      }
      return size
    } catch {
      return 0
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    if (!existsSync(dirPath)) return 0
    let size = 0
    const entries = await readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        size += await this.getDirectorySize(fullPath)
      } else if (entry.isFile()) {
        size += (await stat(fullPath)).size
      }
    }
    return size
  }

  private async walkDirectory(
    dirPath: string,
    onFile: (filePath: string, fileStat: Awaited<ReturnType<typeof stat>>) => Promise<void>
  ): Promise<void> {
    if (!existsSync(dirPath)) return
    const entries = await readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, onFile)
      } else if (entry.isFile()) {
        await onFile(fullPath, await stat(fullPath))
      }
    }
  }
}

export const storageManager = new StorageManager()
