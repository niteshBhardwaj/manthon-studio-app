// ============================================================
// Manthan Studio - Preload Script
// Secure IPC bridge via contextBridge
// ============================================================

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const manthanAPI = {
  saveApiKey: (provider: string, key: string) => ipcRenderer.invoke('api-key:save', provider, key),
  testApiKey: (provider: string, key: string) => ipcRenderer.invoke('api-key:test', provider, key),
  getApiKeyStatus: (provider: string) => ipcRenderer.invoke('api-key:status', provider),
  removeApiKey: (provider: string) => ipcRenderer.invoke('api-key:remove', provider),
  saveGroupKey: (group: string, key: string) =>
    ipcRenderer.invoke('api-key:save-group', group, key),
  testGroupKey: (group: string, key: string) =>
    ipcRenderer.invoke('api-key:test-group', group, key),

  getProviders: () => ipcRenderer.invoke('provider:list'),
  setActiveProvider: (id: string) => ipcRenderer.invoke('provider:set-active', id),
  getActiveProvider: () => ipcRenderer.invoke('provider:get-active'),
  getProviderConfig: (id: string) => ipcRenderer.invoke('provider:get-config', id),
  getEnabledModels: () => ipcRenderer.invoke('models:get-enabled'),
  setEnabledModels: (ids: string[]) => ipcRenderer.invoke('models:set-enabled', ids),

  generateVideo: (job: Record<string, unknown>) => ipcRenderer.invoke('gen:video', job),
  generateImage: (job: Record<string, unknown>) => ipcRenderer.invoke('gen:image', job),
  generateAudio: (job: Record<string, unknown>) => ipcRenderer.invoke('gen:audio', job),

  listQueue: () => ipcRenderer.invoke('queue:list'),
  pauseQueue: () => ipcRenderer.invoke('queue:pause'),
  resumeQueue: () => ipcRenderer.invoke('queue:resume'),
  cancelQueueJob: (id: string) => ipcRenderer.invoke('queue:cancel', id),
  retryQueueJob: (id: string) => ipcRenderer.invoke('queue:retry', id),
  reorderQueueJob: (id: string, newPriority: number) =>
    ipcRenderer.invoke('queue:reorder', id, newPriority),
  clearCompletedQueueJobs: () => ipcRenderer.invoke('queue:clear-completed'),
  deleteQueueJob: (id: string) => ipcRenderer.invoke('queue:delete', id),

  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  listGenerations: (options?: Record<string, unknown>) => ipcRenderer.invoke('generation:list', options),
  starGeneration: (id: string) => ipcRenderer.invoke('generation:star', id),
  deleteGeneration: (id: string) => ipcRenderer.invoke('generation:delete', id),

  getTemplates: () => ipcRenderer.invoke('templates:get'),

  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  setPreference: (key: string, value: unknown) => ipcRenderer.invoke('preferences:set', key, value),

  authenticateGoogle: () => ipcRenderer.invoke('backup:authenticate'),
  isGoogleAuthenticated: () => ipcRenderer.invoke('backup:is-authenticated'),
  disconnectGoogle: () => ipcRenderer.invoke('backup:disconnect'),
  createBackup: (options: { encrypt: boolean; password?: string }) =>
    ipcRenderer.invoke('backup:create', options),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  deleteBackup: (driveFileId: string) => ipcRenderer.invoke('backup:delete', driveFileId),
  restoreBackup: (driveFileId: string, password?: string) =>
    ipcRenderer.invoke('backup:restore', driveFileId, password),
  getBackupSettings: () => ipcRenderer.invoke('backup:get-settings'),
  setBackupSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('backup:set-settings', settings),

  getStorageBreakdown: () => ipcRenderer.invoke('storage:breakdown'),
  getSystemDiskInfo: () => ipcRenderer.invoke('storage:disk-info'),
  cleanupCache: () => ipcRenderer.invoke('storage:cleanup-cache'),
  getRetentionPolicy: () => ipcRenderer.invoke('storage:get-policy'),
  setRetentionPolicy: (policy: Record<string, unknown>) =>
    ipcRenderer.invoke('storage:set-policy', policy),
  applyRetentionPolicy: (policy?: Record<string, unknown>) =>
    ipcRenderer.invoke('storage:apply-policy', policy),

  saveMedia: (data: string, filename: string, mimeType: string) =>
    ipcRenderer.invoke('file:save', data, filename, mimeType),
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),

  saveAsset: (options: {
    projectId?: string
    base64Data: string
    mimeType: string
    filename?: string
    source?: 'generated' | 'imported' | 'uploaded'
    metadata?: Record<string, unknown>
  }) => ipcRenderer.invoke('asset:save', options),
  listAssets: (options?: {
    projectId?: string
    type?: 'video' | 'image' | 'audio'
    source?: 'generated' | 'imported' | 'uploaded'
    limit?: number
    offset?: number
  }) => ipcRenderer.invoke('asset:list', options),
  getAsset: (id: string) => ipcRenderer.invoke('asset:get', id),
  readAsset: (id: string) => ipcRenderer.invoke('asset:read', id),
  generateThumbnail: (assetId: string, base64Thumbnail: string, mimeType?: string) =>
    ipcRenderer.invoke('asset:generate-thumbnail', assetId, base64Thumbnail, mimeType),
  deleteAsset: (id: string) => ipcRenderer.invoke('asset:delete', id),
  importAssets: (projectId?: string) => ipcRenderer.invoke('asset:import', projectId),
  importAssetPaths: (projectId: string | undefined, paths: string[]) =>
    ipcRenderer.invoke('asset:import-paths', projectId, paths),
  exportAssets: (ids: string[]) => ipcRenderer.invoke('asset:export', ids),
  getStorageStats: () => ipcRenderer.invoke('asset:stats'),
  openStorageFolder: () => ipcRenderer.invoke('storage:open-folder'),

  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (options: { name: string; description?: string; color?: string; icon?: string }) =>
    ipcRenderer.invoke('project:create', options),
  updateProject: (
    id: string,
    updates: { name?: string; description?: string; color?: string; icon?: string }
  ) => ipcRenderer.invoke('project:update', id, updates),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),
  getProjectColors: () => ipcRenderer.invoke('project:colors'),

  onQueueUpdate: (callback: (payload: unknown) => void) => subscribe('queue:update', callback),
  onQueueJobProgress: (callback: (payload: unknown) => void) =>
    subscribe('queue:job-progress', callback),
  onQueueJobComplete: (callback: (payload: unknown) => void) =>
    subscribe('queue:job-complete', callback),
  onQueueJobFailed: (callback: (payload: unknown) => void) =>
    subscribe('queue:job-failed', callback),

  // ── Dev Tools ───────────────────────────────────────────
  onBackupProgress: (callback: (payload: unknown) => void) =>
    subscribe('backup:progress', callback),
  onRestoreProgress: (callback: (payload: unknown) => void) =>
    subscribe('restore:progress', callback),

  isDev: () => ipcRenderer.invoke('dev:is-dev'),
  getLogLevel: () => ipcRenderer.invoke('dev:get-log-level'),
  setLogLevel: (level: string) => ipcRenderer.invoke('dev:set-log-level', level),
  getDbTables: () => ipcRenderer.invoke('dev:db-tables'),
  queryDb: (sql: string) => ipcRenderer.invoke('dev:db-query', sql),
  getDbTableInfo: (table: string) => ipcRenderer.invoke('dev:db-table-info', table),
  getDbPath: () => ipcRenderer.invoke('dev:db-path'),
  listApiLogs: (limit?: number) => ipcRenderer.invoke('dev:list-api-logs', limit),
  clearApiLogs: () => ipcRenderer.invoke('dev:clear-api-logs')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('manthan', manthanAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore - Electron injects these globals in the non-isolated fallback path.
  window.electron = electronAPI
  // @ts-ignore - Electron injects these globals in the non-isolated fallback path.
  window.manthan = manthanAPI
}
