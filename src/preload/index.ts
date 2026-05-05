// ============================================================
// Manthan Studio — Preload Script
// Secure IPC bridge via contextBridge
// ============================================================

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Typed API exposed to the renderer process
const manthanAPI = {
  // ── API Keys ──────────────────────────────────────────────
  saveApiKey: (provider: string, key: string) => ipcRenderer.invoke('api-key:save', provider, key),
  testApiKey: (provider: string, key: string) => ipcRenderer.invoke('api-key:test', provider, key),
  getApiKeyStatus: (provider: string) => ipcRenderer.invoke('api-key:status', provider),
  removeApiKey: (provider: string) => ipcRenderer.invoke('api-key:remove', provider),
  saveGroupKey: (group: string, key: string) =>
    ipcRenderer.invoke('api-key:save-group', group, key),
  testGroupKey: (group: string, key: string) =>
    ipcRenderer.invoke('api-key:test-group', group, key),

  // ── Providers ─────────────────────────────────────────────
  getProviders: () => ipcRenderer.invoke('provider:list'),
  setActiveProvider: (id: string) => ipcRenderer.invoke('provider:set-active', id),
  getActiveProvider: () => ipcRenderer.invoke('provider:get-active'),
  getProviderConfig: (id: string) => ipcRenderer.invoke('provider:get-config', id),
  getEnabledModels: () => ipcRenderer.invoke('models:get-enabled'),
  setEnabledModels: (ids: string[]) => ipcRenderer.invoke('models:set-enabled', ids),

  // ── Generation ────────────────────────────────────────────
  generateVideo: (params: Record<string, unknown>) => ipcRenderer.invoke('gen:video', params),
  generateImage: (params: Record<string, unknown>) => ipcRenderer.invoke('gen:image', params),
  generateAudio: (params: Record<string, unknown>) => ipcRenderer.invoke('gen:audio', params),
  pollOperation: (opId: string) => ipcRenderer.invoke('gen:poll', opId),
  cancelOperation: (opId: string) => ipcRenderer.invoke('gen:cancel', opId),

  // ── History ───────────────────────────────────────────────
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // ── Templates ─────────────────────────────────────────────
  getTemplates: () => ipcRenderer.invoke('templates:get'),

  // ── Preferences ───────────────────────────────────────────
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  setPreference: (key: string, value: unknown) => ipcRenderer.invoke('preferences:set', key, value),

  // ── Files ─────────────────────────────────────────────────
  saveMedia: (data: string, filename: string, mimeType: string) =>
    ipcRenderer.invoke('file:save', data, filename, mimeType),
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),

  // ── Assets ────────────────────────────────────────────────
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
  deleteAsset: (id: string) => ipcRenderer.invoke('asset:delete', id),
  importAssets: (projectId?: string) => ipcRenderer.invoke('asset:import', projectId),
  getStorageStats: () => ipcRenderer.invoke('asset:stats'),
  cleanupCache: () => ipcRenderer.invoke('asset:cleanup-cache'),
  openStorageFolder: () => ipcRenderer.invoke('storage:open-folder'),

  // ── Projects ───────────────────────────────────────────────
  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (options: { name: string; description?: string; color?: string; icon?: string }) =>
    ipcRenderer.invoke('project:create', options),
  updateProject: (
    id: string,
    updates: { name?: string; description?: string; color?: string; icon?: string }
  ) => ipcRenderer.invoke('project:update', id, updates),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),
  getProjectColors: () => ipcRenderer.invoke('project:colors'),

  // ── Events ────────────────────────────────────────────────
  onGenerationProgress: (callback: (...args: unknown[]) => void) => {
    ipcRenderer.on('gen:progress', (_event, ...args) => callback(...args))
    return () => ipcRenderer.removeAllListeners('gen:progress')
  },
  onGenerationComplete: (callback: (...args: unknown[]) => void) => {
    ipcRenderer.on('gen:complete', (_event, ...args) => callback(...args))
    return () => ipcRenderer.removeAllListeners('gen:complete')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('manthan', manthanAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore: Electron injects these globals in the non-isolated fallback path.
  window.electron = electronAPI
  // @ts-ignore: Electron injects these globals in the non-isolated fallback path.
  window.manthan = manthanAPI
}
