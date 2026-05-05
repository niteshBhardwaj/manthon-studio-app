// ============================================================
// Manthan Studio — IPC Handlers
// All IPC communication between main and renderer processes
// ============================================================

import { ipcMain, dialog, shell } from 'electron'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { providerRegistry } from '../providers/registry'
import { keyStore } from '../store/key-store'
import { appStore } from '../store/app-store'
import { assetManager } from '../store/asset-manager'
import { projectManager } from '../store/project-manager'
import { storageManager } from '../store/storage-manager'
import type { EnqueueJobInput } from '../queue/types'
import { queueManager } from '../queue/queue-manager'

export function registerIpcHandlers(): void {
  // ── API Key Management ──────────────────────────────────
  ipcMain.handle('api-key:save', async (_event, provider: string, apiKey: string) => {
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

  ipcMain.handle('api-key:test', async (_event, provider: string, apiKey: string) => {
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

  ipcMain.handle('api-key:status', async (_event, provider: string) => {
    const hasKey = keyStore.hasApiKey(provider)
    if (!hasKey) return { connected: false, message: 'No API key configured' }

    const prov = providerRegistry.get(provider)
    if (!prov || !prov.isInitialized()) {
      return { connected: false, message: 'Provider not initialized' }
    }

    return prov.testConnection()
  })

  ipcMain.handle('api-key:remove', async (_event, provider: string) => {
    keyStore.removeApiKey(provider)
    return { success: true }
  })

  ipcMain.handle('api-key:save-group', async (_event, group: string, apiKey: string) => {
    try {
      keyStore.saveGroupKey(group, apiKey)
      await providerRegistry.initializeGroup(group, apiKey)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Save failed' }
    }
  })

  ipcMain.handle('api-key:test-group', async (_event, group: string, apiKey: string) => {
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
  ipcMain.handle('provider:list', async () => {
    return providerRegistry.getProviderList()
  })

  ipcMain.handle('provider:set-active', async (_event, providerId: string) => {
    providerRegistry.setActive(providerId)
    keyStore.setActiveProvider(providerId)
    return { success: true }
  })

  ipcMain.handle('provider:get-active', async () => {
    return providerRegistry.getActiveId()
  })

  ipcMain.handle('provider:get-config', async (_event, providerId: string) => {
    const provider = providerRegistry.get(providerId)
    if (!provider) return null
    return provider.config
  })

  ipcMain.handle('models:get-enabled', async () => {
    return appStore.getEnabledModels()
  })

  ipcMain.handle('models:set-enabled', async (_event, ids: string[]) => {
    appStore.setEnabledModels(ids)
    return { success: true }
  })

  // ── Generation ──────────────────────────────────────────
  ipcMain.handle('gen:video', async (_event, job: EnqueueJobInput) => {
    return queueManager.enqueue(job)
  })

  ipcMain.handle('gen:image', async (_event, job: EnqueueJobInput) => {
    return queueManager.enqueue(job)
  })

  ipcMain.handle('gen:audio', async (_event, job: EnqueueJobInput) => {
    return queueManager.enqueue(job)
  })

  ipcMain.handle('queue:list', async () => {
    return queueManager.getQueueState()
  })

  ipcMain.handle('queue:pause', async () => {
    return queueManager.pause()
  })

  ipcMain.handle('queue:resume', async () => {
    return queueManager.resume()
  })

  ipcMain.handle('queue:cancel', async (_event, id: string) => {
    return queueManager.cancelJob(id)
  })

  ipcMain.handle('queue:retry', async (_event, id: string) => {
    return queueManager.retryJob(id)
  })

  ipcMain.handle('queue:reorder', async (_event, id: string, newPriority: number) => {
    return queueManager.reorderJob(id, newPriority)
  })

  ipcMain.handle('queue:clear-completed', async () => {
    return queueManager.clearCompleted()
  })

  ipcMain.handle('queue:delete', async (_event, id: string) => {
    return queueManager.deleteJob(id)
  })

  // ── History ─────────────────────────────────────────────
  ipcMain.handle('history:get', async () => {
    return appStore.getHistory()
  })

  ipcMain.handle('history:clear', async () => {
    appStore.clearHistory()
    return { success: true }
  })

  // ── Templates ───────────────────────────────────────────
  ipcMain.handle('templates:get', async () => {
    return appStore.getTemplates()
  })

  // ── Preferences ─────────────────────────────────────────
  ipcMain.handle('preferences:get', async () => {
    return appStore.getPreferences()
  })

  ipcMain.handle('preferences:set', async (_event, key: string, value: unknown) => {
    appStore.setPreference(key, value)
    return { success: true }
  })

  // ── File System ─────────────────────────────────────────
  ipcMain.handle('file:save', async (_event, data: string, filename: string) => {
    const mediaDir = join(app.getPath('userData'), 'media')
    await mkdir(mediaDir, { recursive: true })

    const filePath = join(mediaDir, filename)
    const buffer = Buffer.from(data, 'base64')
    await writeFile(filePath, buffer)

    return { path: filePath }
  })

  ipcMain.handle('file:open', async () => {
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

  ipcMain.handle('file:read', async (_event, path: string) => {
    const data = await readFile(path)
    return data.toString('base64')
  })

  // ── Assets ───────────────────────────────────────────────
  ipcMain.handle(
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

  ipcMain.handle(
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

  ipcMain.handle('asset:get', async (_event, id: string) => {
    return assetManager.getAsset(id)
  })

  ipcMain.handle('asset:read', async (_event, id: string) => {
    return assetManager.readAssetBase64(id)
  })

  ipcMain.handle('asset:delete', async (_event, id: string) => {
    return assetManager.deleteAsset(id)
  })

  ipcMain.handle('asset:import', async (_event, projectId?: string) => {
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
        console.warn(`[IPC] Failed to import ${filePath}:`, e)
      }
    }
    return imported
  })

  ipcMain.handle('asset:export', async (_event, ids: string[]) => {
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

  ipcMain.handle('asset:stats', async () => {
    return storageManager.getStorageBreakdown()
  })

  ipcMain.handle('asset:cleanup-cache', async () => {
    return storageManager.cleanupCache()
  })

  ipcMain.handle('storage:open-folder', async () => {
    shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle('storage:breakdown', async () => {
    return storageManager.getStorageBreakdown()
  })

  ipcMain.handle('storage:disk-info', async () => {
    return storageManager.getSystemDiskInfo()
  })

  ipcMain.handle('storage:cleanup-cache', async () => {
    return storageManager.cleanupCache()
  })

  ipcMain.handle('storage:get-policy', async () => {
    return storageManager.getRetentionPolicy()
  })

  ipcMain.handle('storage:set-policy', async (_event, policy) => {
    return storageManager.setRetentionPolicy(policy)
  })

  ipcMain.handle('storage:apply-policy', async (_event, policy) => {
    return storageManager.applyRetentionPolicy(policy)
  })

  // ── Projects ─────────────────────────────────────────────
  ipcMain.handle('project:list', async () => {
    return projectManager.listProjects()
  })

  ipcMain.handle(
    'project:create',
    async (
      _event,
      options: { name: string; description?: string; color?: string; icon?: string }
    ) => {
      return projectManager.createProject(options)
    }
  )

  ipcMain.handle(
    'project:update',
    async (
      _event,
      id: string,
      updates: { name?: string; description?: string; color?: string; icon?: string }
    ) => {
      return projectManager.updateProject(id, updates)
    }
  )

  ipcMain.handle('project:delete', async (_event, id: string) => {
    projectManager.deleteProject(id)
    return { success: true }
  })

  ipcMain.handle('project:colors', async () => {
    return projectManager.getColors()
  })
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
    } catch {
      console.warn(`Failed to initialize provider group ${groupId}`)
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
    } catch {
      console.warn(`Failed to initialize provider ${providerId}`)
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
