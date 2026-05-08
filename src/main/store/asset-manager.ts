// ============================================================
// Manthan Studio — Asset Manager
// Manages media files on disk with a catalog in SQLite
// ============================================================

import { app } from 'electron'
import { join, extname } from 'path'
import { mkdirSync, existsSync, statSync, unlinkSync } from 'fs'
import { writeFile, readFile, stat, readdir, rm } from 'fs/promises'
import { randomUUID } from 'crypto'
import { databaseManager } from './db'
import { logger } from '../logger'

export interface Asset {
  id: string
  project_id: string | null
  filename: string
  mime_type: string
  size_bytes: number
  type: 'video' | 'image' | 'audio'
  source: 'generated' | 'imported' | 'uploaded'
  storage_path: string
  thumbnail_path: string | null
  metadata: Record<string, unknown>
  tags: string[]
  created_at: number
  updated_at: number
}

export interface StorageBreakdown {
  video: number
  image: number
  audio: number
  cache: number
  database: number
  total: number
}

const MIME_TO_TYPE: Record<string, 'video' | 'image' | 'audio'> = {
  'video/mp4': 'video',
  'video/webm': 'video',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/webm': 'audio'
}

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/webm': '.webm'
}

class AssetManager {
  private assetsRoot: string = ''
  private cacheRoot: string = ''
  private thumbnailsRoot: string = ''

  initialize(): void {
    this.assetsRoot = join(app.getPath('userData'), 'assets')
    this.cacheRoot = join(app.getPath('userData'), 'cache')
    this.thumbnailsRoot = join(this.assetsRoot, 'thumbnails')
    mkdirSync(this.assetsRoot, { recursive: true })
    mkdirSync(this.cacheRoot, { recursive: true })
    mkdirSync(this.thumbnailsRoot, { recursive: true })
  }

  /** Save a buffer as a managed asset */
  async saveAsset(options: {
    projectId?: string | null
    buffer: Buffer
    mimeType: string
    filename?: string
    source?: 'generated' | 'imported' | 'uploaded'
    metadata?: Record<string, unknown>
  }): Promise<Asset> {
    const id = randomUUID()
    const projectId = options.projectId ?? 'default'
    const source = options.source ?? 'generated'
    const type = MIME_TO_TYPE[options.mimeType] ?? 'image'
    const ext = MIME_TO_EXT[options.mimeType] ?? '.bin'
    const filename = options.filename ?? `${id}${ext}`

    // Create project directory
    const projectDir = join(this.assetsRoot, projectId)
    mkdirSync(projectDir, { recursive: true })

    // Write file
    const storagePath = join(projectDir, `${id}${ext}`)
    await writeFile(storagePath, options.buffer)

    const now = Date.now()
    const sizeBytes = options.buffer.length
    const metadata = JSON.stringify(options.metadata ?? {})

    // Insert into DB
    databaseManager.run(
      `INSERT INTO assets (id, project_id, filename, mime_type, size_bytes, type, source, storage_path, metadata, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`,
      [
        id,
        projectId,
        filename,
        options.mimeType,
        sizeBytes,
        type,
        source,
        storagePath,
        metadata,
        now,
        now
      ]
    )
    
    logger.debug('Asset', `Asset saved: ${filename} (${sizeBytes} bytes)`)

    return this.getAsset(id)!
  }

  /** Save a base64-encoded string as an asset */
  async saveBase64Asset(options: {
    projectId?: string | null
    base64Data: string
    mimeType: string
    filename?: string
    source?: 'generated' | 'imported' | 'uploaded'
    metadata?: Record<string, unknown>
  }): Promise<Asset> {
    const buffer = Buffer.from(options.base64Data, 'base64')
    return this.saveAsset({ ...options, buffer })
  }

  /** Import a file from a filesystem path */
  async importFromFile(projectId: string | null, filePath: string): Promise<Asset> {
    const buffer = await readFile(filePath)
    const ext = extname(filePath).toLowerCase()
    const filename = filePath.split(/[\\/]/).pop() ?? `import${ext}`

    // Infer MIME type from extension
    const extToMime: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    }
    const mimeType = extToMime[ext] ?? 'application/octet-stream'

    return this.saveAsset({
      projectId,
      buffer,
      mimeType,
      filename,
      source: 'imported'
    })
  }

  /** Get a single asset by ID */
  getAsset(id: string): Asset | null {
    const row = databaseManager.queryOne<RawAssetRow>('SELECT * FROM assets WHERE id = ?', [id])
    return row ? this.hydrate(row) : null
  }

  /** List assets with optional filters */
  listAssets(options?: {
    projectId?: string | null
    type?: 'video' | 'image' | 'audio'
    source?: 'generated' | 'imported' | 'uploaded'
    limit?: number
    offset?: number
  }): { assets: Asset[]; total: number; typeCounts: Record<string, number> } {
    const conditions: string[] = []
    const params: unknown[] = []

    if (options?.projectId) {
      conditions.push('project_id = ?')
      params.push(options.projectId)
    }
    if (options?.type) {
      conditions.push('type = ?')
      params.push(options.type)
    }
    if (options?.source) {
      conditions.push('source = ?')
      params.push(options.source)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0

    const rows = databaseManager.query<RawAssetRow>(
      `SELECT * FROM assets ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const countRow = databaseManager.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM assets ${where}`,
      params
    )

    // Calculate counts for all types in this project
    const typeCounts: Record<string, number> = { video: 0, image: 0, audio: 0 }
    const projectOnlyWhere = options?.projectId ? 'WHERE project_id = ?' : ''
    const projectOnlyParams = options?.projectId ? [options.projectId] : []
    
    const countRows = databaseManager.query<{ type: string; count: number }>(
      `SELECT type, COUNT(*) as count FROM assets ${projectOnlyWhere} GROUP BY type`,
      projectOnlyParams
    )

    for (const row of countRows) {
      typeCounts[row.type] = row.count
    }

    return {
      assets: rows.map((r) => this.hydrate(r)),
      total: countRow?.count ?? 0,
      typeCounts
    }
  }

  /** Delete an asset (file + DB row) */
  async deleteAsset(id: string): Promise<boolean> {
    const asset = this.getAsset(id)
    if (!asset) return false

    // Remove file
    try {
      if (existsSync(asset.storage_path)) {
        unlinkSync(asset.storage_path)
      }
      if (asset.thumbnail_path && existsSync(asset.thumbnail_path)) {
        unlinkSync(asset.thumbnail_path)
      }
    } catch (e) {
      logger.warn('Asset', `Failed to delete file for asset ${id}:`, e)
    }

    // Remove DB row
    databaseManager.run('DELETE FROM assets WHERE id = ?', [id])
    logger.debug('Asset', `Asset deleted: ${id}`)
    return true
  }

  /** Read asset file data as base64 */
  async readAssetBase64(id: string): Promise<string | null> {
    const asset = this.getAsset(id)
    if (!asset || !existsSync(asset.storage_path)) return null

    const data = await readFile(asset.storage_path)
    return data.toString('base64')
  }

  /** Save a renderer-generated thumbnail and attach it to an asset row */
  async saveThumbnail(
    assetId: string,
    base64Thumbnail: string,
    mimeType: string = 'image/webp'
  ): Promise<string | null> {
    const asset = this.getAsset(assetId)
    if (!asset) return null

    mkdirSync(this.thumbnailsRoot, { recursive: true })

    const ext = MIME_TO_EXT[mimeType] ?? '.webp'
    const thumbnailPath = join(this.thumbnailsRoot, `${assetId}${ext}`)
    const normalizedBase64 = base64Thumbnail.includes(',')
      ? base64Thumbnail.split(',').pop() ?? ''
      : base64Thumbnail

    await writeFile(thumbnailPath, Buffer.from(normalizedBase64, 'base64'))

    databaseManager.run('UPDATE assets SET thumbnail_path = ?, updated_at = ? WHERE id = ?', [
      thumbnailPath,
      Date.now(),
      assetId
    ])

    logger.debug('Asset', `Thumbnail saved for asset: ${assetId}`)
    return thumbnailPath
  }

  /** Get storage breakdown by media type */
  async getStorageStats(): Promise<StorageBreakdown> {
    const breakdown: StorageBreakdown = {
      video: 0,
      image: 0,
      audio: 0,
      cache: 0,
      database: 0,
      total: 0
    }

    // Asset sizes from DB (fast aggregate)
    const rows = databaseManager.query<{ type: string; total: number }>(
      'SELECT type, SUM(size_bytes) as total FROM assets GROUP BY type'
    )
    for (const row of rows) {
      if (row.type in breakdown) {
        breakdown[row.type as keyof StorageBreakdown] = row.total ?? 0
      }
    }

    // Database file size
    try {
      const dbPath = databaseManager.getDbPath()
      if (existsSync(dbPath)) {
        breakdown.database = statSync(dbPath).size
      }
      // Include WAL and SHM files
      const walPath = dbPath + '-wal'
      const shmPath = dbPath + '-shm'
      if (existsSync(walPath)) breakdown.database += statSync(walPath).size
      if (existsSync(shmPath)) breakdown.database += statSync(shmPath).size
    } catch {
      // Ignore
    }

    // Cache size
    breakdown.cache = await this.getDirectorySize(this.cacheRoot)

    breakdown.total =
      breakdown.video + breakdown.image + breakdown.audio + breakdown.cache + breakdown.database

    return breakdown
  }

  /** Clean up cache files, return bytes freed */
  async cleanupCache(): Promise<number> {
    const sizeBefore = await this.getDirectorySize(this.cacheRoot)
    try {
      await rm(this.cacheRoot, { recursive: true, force: true })
      mkdirSync(this.cacheRoot, { recursive: true })
    } catch (e) {
      logger.warn('Asset', 'Cache cleanup error:', e)
    }
    logger.info('Asset', `Cache cleaned: freed ${sizeBefore} bytes`)
    return sizeBefore
  }

  // ── Private helpers ────────────────────────────────────────

  private hydrate(row: RawAssetRow): Asset {
    return {
      ...row,
      metadata: this.parseJSON(row.metadata, {}),
      tags: this.parseJSON(row.tags, [])
    }
  }

  private parseJSON<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    if (!existsSync(dirPath)) return 0
    let size = 0
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        if (entry.isFile()) {
          const s = await stat(fullPath)
          size += s.size
        } else if (entry.isDirectory()) {
          size += await this.getDirectorySize(fullPath)
        }
      }
    } catch {
      // Ignore errors for inaccessible files
    }
    return size
  }
}

/** Raw row shape from SQLite (JSON columns are strings) */
interface RawAssetRow {
  id: string
  project_id: string | null
  filename: string
  mime_type: string
  size_bytes: number
  type: 'video' | 'image' | 'audio'
  source: 'generated' | 'imported' | 'uploaded'
  storage_path: string
  thumbnail_path: string | null
  metadata: string
  tags: string
  created_at: number
  updated_at: number
}

// Singleton instance
export const assetManager = new AssetManager()
