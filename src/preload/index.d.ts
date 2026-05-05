// ============================================================
// Manthan Studio — Preload Type Declarations
// ============================================================

import { ElectronAPI } from '@electron-toolkit/preload'

interface ManthanAPI {
  // API Keys
  saveApiKey: (provider: string, key: string) => Promise<{ success: boolean; error?: string }>
  testApiKey: (
    provider: string,
    key: string
  ) => Promise<{ connected: boolean; message: string; model?: string }>
  getApiKeyStatus: (
    provider: string
  ) => Promise<{ connected: boolean; message: string; model?: string }>
  removeApiKey: (provider: string) => Promise<{ success: boolean }>
  saveGroupKey: (group: string, key: string) => Promise<{ success: boolean; error?: string }>
  testGroupKey: (
    group: string,
    key: string
  ) => Promise<{ connected: boolean; message: string; model?: string }>

  // Providers
  getProviders: () => Promise<
    Array<{
      id: string
      name: string
      icon: string
      modalities: string[]
      initialized: boolean
    }>
  >
  setActiveProvider: (id: string) => Promise<{ success: boolean }>
  getActiveProvider: () => Promise<string | null>
  getProviderConfig: (id: string) => Promise<{
    defaultModel: string
    models: Array<{
      id: string
      name: string
      description: string
      modality: string
      supportedInputs: string[]
      maxDuration?: number
      supportedAspectRatios?: string[]
      supportedResolutions?: string[]
    }>
  } | null>
  getEnabledModels: () => Promise<string[]>
  setEnabledModels: (ids: string[]) => Promise<{ success: boolean }>

  // Generation
  generateVideo: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  generateImage: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  generateAudio: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  pollOperation: (opId: string) => Promise<Record<string, unknown>>
  cancelOperation: (opId: string) => Promise<{ success: boolean }>

  // History
  getHistory: () => Promise<Record<string, unknown>[]>
  clearHistory: () => Promise<{ success: boolean }>

  // Templates
  getTemplates: () => Promise<Array<{ id: string; name: string; prompt: string; category: string }>>

  // Preferences
  getPreferences: () => Promise<Record<string, unknown>>
  setPreference: (key: string, value: unknown) => Promise<{ success: boolean }>

  // Files
  saveMedia: (data: string, filename: string, mimeType: string) => Promise<{ path: string }>
  openFile: () => Promise<{
    path: string
    data: string
    mimeType: string
  } | null>
  readFile: (path: string) => Promise<string>

  // Assets
  saveAsset: (options: {
    projectId?: string
    base64Data: string
    mimeType: string
    filename?: string
    source?: 'generated' | 'imported' | 'uploaded'
    metadata?: Record<string, unknown>
  }) => Promise<AssetInfo>
  listAssets: (options?: {
    projectId?: string
    type?: 'video' | 'image' | 'audio'
    source?: 'generated' | 'imported' | 'uploaded'
    limit?: number
    offset?: number
  }) => Promise<{ assets: AssetInfo[]; total: number }>
  getAsset: (id: string) => Promise<AssetInfo | null>
  readAsset: (id: string) => Promise<string | null>
  deleteAsset: (id: string) => Promise<boolean>
  importAssets: (projectId?: string) => Promise<AssetInfo[]>
  getStorageStats: () => Promise<{
    video: number
    image: number
    audio: number
    cache: number
    database: number
    total: number
  }>
  cleanupCache: () => Promise<number>
  openStorageFolder: () => Promise<void>

  // Events
  onGenerationProgress: (callback: (...args: unknown[]) => void) => () => void
  onGenerationComplete: (callback: (...args: unknown[]) => void) => () => void
}

interface AssetInfo {
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

declare global {
  interface Window {
    electron: ElectronAPI
    manthan: ManthanAPI
  }
}
