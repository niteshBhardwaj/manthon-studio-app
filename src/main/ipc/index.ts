// ============================================================
// Manthan Studio — IPC Handlers
// All IPC communication between main and renderer processes
// ============================================================

import { ipcMain, dialog, shell, app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { providerRegistry } from '../providers/registry'
import { keyStore } from '../store/key-store'
import { appStore } from '../store/app-store'
import { assetManager } from '../store/asset-manager'
import { projectManager } from '../store/project-manager'
import { storageManager } from '../store/storage-manager'
import type { EnqueueJobInput } from '../queue/types'
import { queueManager } from '../queue/queue-manager'
import { databaseManager } from '../store/db'
import { logger } from '../logger'

function summarizeArgs(args: any[]): any {
  return args.map(arg => {
    if (typeof arg === 'string' && arg.length > 200) return arg.substring(0, 200) + '...'
    if (arg && typeof arg === 'object') {
      const summary: any = {}
      for (const key in arg) {
        if (Object.prototype.hasOwnProperty.call(arg, key)) {
          const val = arg[key]
          if (typeof val === 'string' && val.length > 100) summary[key] = val.substring(0, 100) + '...'
          else if (val && typeof val === 'object' && !Array.isArray(val)) summary[key] = '[Object]'
          else if (Array.isArray(val)) summary[key] = `[Array(${val.length})]`
          else summary[key] = val
        }
      }
      return summary
    }
    return arg
  })
}

function logIpcHandler(channel: string, handler: (...args: any[]) => any): void {
  ipcMain.handle(channel, async (event, ...args) => {
    logger.debug('IPC', `→ ${channel}`, summarizeArgs(args))
    try {
      const result = await handler(event, ...args)
      logger.debug('IPC', `← ${channel} OK`)
      return result
    } catch (error) {
      logger.error('IPC', `← ${channel} FAILED`, { error })
      throw error
    }
  })
}

export function registerIpcHandlers(): void {
  // ── API Key Management ──────────────────────────────────
  logIpcHandler('api-key:save', async (_event, provider: string, apiKey: string) => {
    try {
      keyStore.saveApiKey(provider, apiKey)
      const group = keyStore.getProviderGroupMapping()[provider]
      if (group) {
        await providerRegistry.initializeGroup(group, apiKey)
      } else {
        await providerRegistry.initializeProvider(provider, apiKey)
      }
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Save failed' }
    }
  })

  logIpcHandler('api-key:test', async (_event, provider: string, apiKey: string) => {
    try {
      // Temporarily initialize with the test key
      const prov = providerRegistry.get(provider)
      if (!prov) return { connected: false, message: 'Provider not found' }
      await prov.initialize(apiKey)
      const status = await prov.testConnection()
      return status
    } catch (error: unknown) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Test failed'
      }
    }
  })

  logIpcHandler('api-key:status', async (_event, provider: string) => {
    const hasKey = keyStore.hasApiKey(provider)
    if (!hasKey) return { connected: false, message: 'No API key configured' }

    const prov = providerRegistry.get(provider)
    if (!prov || !prov.isInitialized()) {
      return { connected: false, message: 'Provider not initialized' }
    }

    return prov.testConnection()
  })

  logIpcHandler('api-key:remove', async (_event, provider: string) => {
    keyStore.removeApiKey(provider)
    return { success: true }
  })

  logIpcHandler('api-key:save-group', async (_event, group: string, apiKey: string) => {
    try {
      keyStore.saveGroupKey(group, apiKey)
      await providerRegistry.initializeGroup(group, apiKey)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Save failed' }
    }
  })

  logIpcHandler('api-key:test-group', async (_event, group: string, apiKey: string) => {
    try {
      const mapping = providerRegistry.getGroupMapping()
      const providerId = Object.keys(mapping).find((id) => mapping[id] === group)

      if (!providerId) {
        return { connected: false, message: 'Provider group not found' }
      }

      const provider = providerRegistry.get(providerId)
      if (!provider) {
        return { connected: false, message: 'Provider not found' }
      }

      await provider.initialize(apiKey)
      return provider.testConnection()
    } catch (error: unknown) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Test failed'
      }
    }
  })

  // ── Provider Management ─────────────────────────────────
  logIpcHandler('provider:list', async () => {
    return providerRegistry.getProviderList()
  })

  logIpcHandler('provider:set-active', async (_event, providerId: string) => {
    providerRegistry.setActive(providerId)
    keyStore.setActiveProvider(providerId)
    return { success: true }
  })

  logIpcHandler('provider:get-active', async () => {
    return providerRegistry.getActiveId()
  })

  logIpcHandler('provider:get-config', async (_event, providerId: string) => {
    const provider = providerRegistry.get(providerId)
    if (!provider) return null
    return provider.config
  })

  logIpcHandler('models:get-enabled', async () => {
    return appStore.getEnabledModels()
  })

  logIpcHandler('models:set-enabled', async (_event, ids: string[]) => {
    appStore.setEnabledModels(ids)
    return { success: true }
  })

  // ── Generation ──────────────────────────────────────────
  logIpcHandler('gen:video', async (_event, job: EnqueueJobInput) => {
    return queueManager.enqueue(job)
  })

  logIpcHandler('gen:image', async (_event, job: EnqueueJobInput) => {
    return queueManager.enqueue(job)
  })

  logIpcHandler('gen:audio', async (_event, job: EnqueueJobInput) => {
    return queueManager.enqueue(job)
  })

  logIpcHandler('queue:list', async () => {
    return queueManager.getQueueState()
  })

  logIpcHandler('queue:pause', async () => {
    return queueManager.pause()
  })

  logIpcHandler('queue:resume', async () => {
    return queueManager.resume()
  })

  logIpcHandler('queue:cancel', async (_event, id: string) => {
    return queueManager.cancelJob(id)
  })

  logIpcHandler('queue:retry', async (_event, id: string) => {
    return queueManager.retryJob(id)
  })

  logIpcHandler('queue:reorder', async (_event, id: string, newPriority: number) => {
    return queueManager.reorderJob(id, newPriority)
  })

  logIpcHandler('queue:clear-completed', async () => {
    return queueManager.clearCompleted()
  })

  logIpcHandler('queue:delete', async (_event, id: string) => {
    return queueManager.deleteJob(id)
  })

  // ── History ─────────────────────────────────────────────
  logIpcHandler('history:get', async () => {
    return appStore.getHistory()
  })

  logIpcHandler('history:clear', async () => {
    appStore.clearHistory()
    return { success: true }
  })

  logIpcHandler(
    'generation:list',
    async (
      _event,
      options?: {
        projectId?: string | null
        type?: 'video' | 'image' | 'audio'
        limit?: number
        offset?: number
      }
    ) => {
      return appStore.listGenerations(options)
    }
  )

  logIpcHandler('generation:star', async (_event, id: string) => {
    return appStore.toggleGenerationStar(id)
  })

  logIpcHandler('generation:delete', async (_event, id: string) => {
    return appStore.deleteGeneration(id)
  })

  // ── Templates ───────────────────────────────────────────
  logIpcHandler('templates:get', async () => {
    return appStore.getTemplates()
  })

  // ── Preferences ─────────────────────────────────────────
  logIpcHandler('preferences:get', async () => {
    return appStore.getPreferences()
  })

  logIpcHandler('preferences:set', async (_event, key: string, value: unknown) => {
    appStore.setPreference(key, value)
    return { success: true }
  })

  // ── File System ─────────────────────────────────────────
  logIpcHandler('file:save', async (_event, data: string, filename: string) => {
    const mediaDir = join(app.getPath('userData'), 'media')
    await mkdir(mediaDir, { recursive: true })

    const filePath = join(mediaDir, filename)
    const buffer = Buffer.from(data, 'base64')
    await writeFile(filePath, buffer)

    return { path: filePath }
  })

  logIpcHandler('file:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
        { name: 'Videos', extensions: ['mp4', 'webm'] },
        { name: 'Audio', extensions: ['mp3', 'wav'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const data = await readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase()
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm'
    }

    return {
      path: filePath,
      data: data.toString('base64'),
      mimeType: mimeMap[ext || ''] || 'application/octet-stream'
    }
  })

  logIpcHandler('file:read', async (_event, path: string) => {
    const data = await readFile(path)
    return data.toString('base64')
  })

  // ── Assets ───────────────────────────────────────────────
  logIpcHandler(
    'asset:save',
    async (
      _event,
      options: {
        projectId?: string
        base64Data: string
        mimeType: string
        filename?: string
        source?: 'generated' | 'imported' | 'uploaded'
        metadata?: Record<string, unknown>
      }
    ) => {
      return assetManager.saveBase64Asset(options)
    }
  )

  logIpcHandler(
    'asset:list',
    async (
      _event,
      options?: {
        projectId?: string
        type?: 'video' | 'image' | 'audio'
        source?: 'generated' | 'imported' | 'uploaded'
        limit?: number
        offset?: number
      }
    ) => {
      return assetManager.listAssets(options)
    }
  )

  logIpcHandler('asset:get', async (_event, id: string) => {
    return assetManager.getAsset(id)
  })

  logIpcHandler('asset:read', async (_event, id: string) => {
    return assetManager.readAssetBase64(id)
  })

  logIpcHandler('asset:delete', async (_event, id: string) => {
    return assetManager.deleteAsset(id)
  })

  logIpcHandler('asset:import', async (_event, projectId?: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
        { name: 'Videos', extensions: ['mp4', 'webm'] },
        { name: 'Audio', extensions: ['mp3', 'wav'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) return []

    const imported: Array<Awaited<ReturnType<typeof assetManager.importFromFile>>> = []
    for (const filePath of result.filePaths) {
      try {
        const asset = await assetManager.importFromFile(projectId ?? 'default', filePath)
        imported.push(asset)
      } catch (e) {
        logger.warn('App', `Failed to import ${filePath}`, e)
      }
    }
    return imported
  })

  logIpcHandler('asset:import-paths', async (_event, projectId: string | undefined, paths: string[]) => {
    const imported: Array<Awaited<ReturnType<typeof assetManager.importFromFile>>> = []

    for (const filePath of paths) {
      try {
        const asset = await assetManager.importFromFile(projectId ?? 'default', filePath)
        imported.push(asset)
      } catch (e) {
        logger.warn('App', `Failed to import dropped asset ${filePath}`, e)
      }
    }

    return imported
  })

  logIpcHandler('asset:export', async (_event, ids: string[]) => {
    if (!ids || ids.length === 0) return { success: false, error: 'No assets selected' }
    
    // For single file, use Save dialog
    if (ids.length === 1) {
      const asset = assetManager.getAsset(ids[0])
      if (!asset) return { success: false, error: 'Asset not found' }
      
      const result = await dialog.showSaveDialog({
        defaultPath: asset.filename,
        title: 'Export Asset'
      })
      
      if (result.canceled || !result.filePath) return { success: false }
      
      try {
        const { copyFile } = require('fs/promises')
        await copyFile(asset.storage_path, result.filePath)
        return { success: true }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
    
    // For multiple files, use Select Folder dialog
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Destination Folder'
    })
    
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    
    const targetDir = result.filePaths[0]
    let successCount = 0
    let lastError = ''
    const { copyFile } = require('fs/promises')
    
    for (const id of ids) {
      const asset = assetManager.getAsset(id)
      if (!asset) continue
      
      try {
        const targetPath = join(targetDir, asset.filename)
        await copyFile(asset.storage_path, targetPath)
        successCount++
      } catch (e: any) {
        lastError = e.message
      }
    }
    
    if (successCount === 0 && lastError) {
      return { success: false, error: lastError }
    }
    
    return { success: true, count: successCount }
  })

  logIpcHandler('asset:stats', async () => {
    return storageManager.getStorageBreakdown()
  })

  logIpcHandler('asset:cleanup-cache', async () => {
    return storageManager.cleanupCache()
  })

  logIpcHandler('storage:open-folder', async () => {
    shell.openPath(app.getPath('userData'))
  })

  logIpcHandler('storage:breakdown', async () => {
    return storageManager.getStorageBreakdown()
  })

  logIpcHandler('storage:disk-info', async () => {
    return storageManager.getSystemDiskInfo()
  })

  logIpcHandler('storage:cleanup-cache', async () => {
    return storageManager.cleanupCache()
  })

  logIpcHandler('storage:get-policy', async () => {
    return storageManager.getRetentionPolicy()
  })

  logIpcHandler('storage:set-policy', async (_event, policy) => {
    return storageManager.setRetentionPolicy(policy)
  })

  logIpcHandler('storage:apply-policy', async (_event, policy) => {
    return storageManager.applyRetentionPolicy(policy)
  })

  // ── Projects ─────────────────────────────────────────────
  logIpcHandler('project:list', async () => {
    return projectManager.listProjects()
  })

  logIpcHandler(
    'project:create',
    async (
      _event,
      options: { name: string; description?: string; color?: string; icon?: string }
    ) => {
      return projectManager.createProject(options)
    }
  )

  logIpcHandler(
    'project:update',
    async (
      _event,
      id: string,
      updates: { name?: string; description?: string; color?: string; icon?: string }
    ) => {
      return projectManager.updateProject(id, updates)
    }
  )

  logIpcHandler('project:delete', async (_event, id: string) => {
    projectManager.deleteProject(id)
    return { success: true }
  })

  logIpcHandler('project:colors', async () => {
    return projectManager.getColors()
  })

  // ── Dev Tools (Dev Mode Only) ───────────────────────────
  const devEnabled = is.dev || !app.isPackaged
  logger.info('App', `Dev mode handlers: ${devEnabled ? 'ENABLED' : 'DISABLED'}`)
  
  if (devEnabled) {
    logIpcHandler('dev:is-dev', () => true)
    
    logIpcHandler('dev:get-log-level', () => logger.getLevel())
    
    logIpcHandler('dev:set-log-level', (_e, level) => {
      logger.setLevel(level)
      appStore.setPreference('logLevel', level)
      return { success: true }
    })

    logIpcHandler('dev:db-tables', () => {
      logger.debug('DB', 'Fetching tables for explorer')
      const tables = databaseManager.query<{ name: string }>(
        `SELECT name FROM sqlite_master 
         WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'
         ORDER BY name`
      )
      
      logger.debug('DB', `Found ${tables.length} tables`)
      
      return tables.map(t => {
        try {
          const sql = `SELECT COUNT(*) as count FROM "${t.name}"`
          logger.debug('DB', `Running count query: ${sql}`)
          const result = databaseManager.queryOne<{ count: number }>(sql)
          return {
            name: t.name,
            row_count: result?.count || 0
          }
        } catch (e) {
          logger.error('DB', `Failed to get count for table ${t.name}`, e)
          return {
            name: t.name,
            row_count: -1
          }
        }
      })
    })

    logIpcHandler('dev:db-query', (_e, sql: string) => {
      if (!sql.trim().toLowerCase().startsWith('select')) {
        throw new Error('Only SELECT queries are allowed for safety')
      }
      return databaseManager.query(sql)
    })

    logIpcHandler('dev:db-table-info', (_e, table: string) => {
      // Validate table name to prevent injection
      if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error('Invalid table name')
      return databaseManager.query(`PRAGMA table_info(${table})`)
    })

    logIpcHandler('dev:db-path', () => {
      return databaseManager.getDbPath()
    })
  } else {
    ipcMain.handle('dev:is-dev', () => false)
  }
}

// Initialize providers with stored keys on startup
export async function initializeStoredProviders(): Promise<void> {
  const initializedProviders = new Set<string>()
  const initializedGroups = new Set<string>()

  for (const groupId of keyStore.getStoredGroupIds()) {
    const apiKey = keyStore.getGroupKey(groupId)
    if (!apiKey) continue

    try {
      await providerRegistry.initializeGroup(groupId, apiKey)
      initializedGroups.add(groupId)
      Object.entries(keyStore.getProviderGroupMapping()).forEach(([providerId, group]) => {
        if (group === groupId) initializedProviders.add(providerId)
      })
    } catch (e) {
      logger.warn('App', `Failed to initialize provider group ${groupId}`, e)
    }
  }

  const providerIds = keyStore.getAllProviderIds()

  for (const providerId of providerIds) {
    if (initializedProviders.has(providerId)) continue

    const mappedGroup = keyStore.getProviderGroupMapping()[providerId]
    if (mappedGroup && initializedGroups.has(mappedGroup)) continue

    const apiKey = keyStore.getApiKeyFromProviderSlot(providerId)
    if (!apiKey) continue

    try {
      if (mappedGroup) {
        await providerRegistry.initializeGroup(mappedGroup, apiKey)
        initializedGroups.add(mappedGroup)
      } else {
        await providerRegistry.initializeProvider(providerId, apiKey)
      }
      initializedProviders.add(providerId)
    } catch (e) {
      logger.warn('App', `Failed to initialize provider ${providerId}`, e)
    }
  }

  // Restore active provider
  const activeId = keyStore.getActiveProvider()
  if (activeId) {
    try {
      providerRegistry.setActive(activeId)
    } catch {
      // Provider may not be registered
    }
  }
}
