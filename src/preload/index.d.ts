// ============================================================
// Manthan Studio - Preload Type Declarations
// ============================================================

import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  EnqueueJobInput,
  QueueJob,
  QueueJobCompletePayload,
  QueueJobFailedPayload,
  QueueJobProgressPayload,
  QueueState
} from '../main/queue/types'
import type {
  DiskInfo,
  RetentionPolicy,
  RetentionResult,
  StorageReport
} from '../main/store/storage-manager'

interface ManthanAPI {
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

  generateVideo: (job: EnqueueJobInput) => Promise<QueueJob>
  generateImage: (job: EnqueueJobInput) => Promise<QueueJob>
  generateAudio: (job: EnqueueJobInput) => Promise<QueueJob>

  listQueue: () => Promise<QueueState>
  pauseQueue: () => Promise<{ success: boolean }>
  resumeQueue: () => Promise<{ success: boolean }>
  cancelQueueJob: (id: string) => Promise<{ success: boolean }>
  retryQueueJob: (id: string) => Promise<{ success: boolean }>
  reorderQueueJob: (id: string, newPriority: number) => Promise<{ success: boolean }>
  clearCompletedQueueJobs: () => Promise<{ success: boolean }>
  deleteQueueJob: (id: string) => Promise<{ success: boolean }>

  getHistory: () => Promise<Record<string, unknown>[]>
  clearHistory: () => Promise<{ success: boolean }>
  listGenerations: (options?: {
    projectId?: string | null
    groupId?: string | null
    type?: 'video' | 'image' | 'audio'
    limit?: number
    offset?: number
  }) => Promise<{ items: GenerationRecord[]; total: number }>
  starGeneration: (id: string) => Promise<GenerationRecord | null>
  deleteGeneration: (id: string) => Promise<{ success: boolean }>

  getTemplates: () => Promise<Array<{ id: string; name: string; prompt: string; category: string }>>

  getPreferences: () => Promise<Record<string, unknown>>
  setPreference: (key: string, value: unknown) => Promise<{ success: boolean }>

  getStorageBreakdown: () => Promise<StorageReport>
  getSystemDiskInfo: () => Promise<DiskInfo>
  cleanupCache: () => Promise<number>
  getRetentionPolicy: () => Promise<RetentionPolicy>
  setRetentionPolicy: (policy: RetentionPolicy) => Promise<{ success: boolean }>
  applyRetentionPolicy: (policy?: RetentionPolicy) => Promise<RetentionResult>

  saveMedia: (data: string, filename: string, mimeType: string) => Promise<{ path: string }>
  openFile: () => Promise<{
    path: string
    data: string
    mimeType: string
  } | null>
  readFile: (path: string) => Promise<string>

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
  }) => Promise<{ assets: AssetInfo[]; total: number; typeCounts: Record<string, number> }>
  getAsset: (id: string) => Promise<AssetInfo | null>
  readAsset: (id: string) => Promise<string | null>
  deleteAsset: (id: string) => Promise<boolean>
  importAssets: (projectId?: string) => Promise<AssetInfo[]>
  importAssetPaths: (projectId: string | undefined, paths: string[]) => Promise<AssetInfo[]>
  exportAssets: (ids: string[]) => Promise<{ success: boolean; count?: number; error?: string }>
  getStorageStats: () => Promise<StorageReport>
  openStorageFolder: () => Promise<void>

  listProjects: () => Promise<ProjectInfo[]>
  createProject: (options: {
    name: string
    description?: string
    color?: string
    icon?: string
  }) => Promise<ProjectInfo>
  updateProject: (
    id: string,
    updates: { name?: string; description?: string; color?: string; icon?: string }
  ) => Promise<ProjectInfo | null>
  deleteProject: (id: string) => Promise<{ success: boolean }>
  getProjectColors: () => Promise<string[]>

  onQueueUpdate: (callback: (payload: QueueState) => void) => () => void
  onQueueJobProgress: (callback: (payload: QueueJobProgressPayload) => void) => () => void
  onQueueJobComplete: (callback: (payload: QueueJobCompletePayload) => void) => () => void
  onQueueJobFailed: (callback: (payload: QueueJobFailedPayload) => void) => () => void

  // ── Dev Tools ───────────────────────────────────────────
  isDev: () => Promise<boolean>
  getLogLevel: () => Promise<string>
  setLogLevel: (level: string) => Promise<{ success: boolean }>
  getDbTables: () => Promise<Array<{ name: string; row_count: number }>>
  queryDb: (sql: string) => Promise<any[]>
  getDbTableInfo: (table: string) => Promise<any[]>
  getDbPath: () => Promise<string>
  listApiLogs: (limit?: number) => Promise<Array<{ id: string; provider: string; method: string; payload: string; created_at: number }>>
  clearApiLogs: () => Promise<{ success: boolean }>
}

interface ProjectInfo {
  id: string
  name: string
  description: string
  color: string
  icon: string
  created_at: number
  updated_at: number
  archived: number
  generation_count?: number
  asset_count?: number
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

interface GenerationRecord {
  id: string
  project_id: string | null
  type: 'video' | 'image' | 'audio'
  status: string
  prompt: string
  negative_prompt: string
  provider: string
  model: string
  config: Record<string, unknown>
  result_asset_id: string | null
  error: string | null
  progress: number
  started_at: number
  completed_at: number | null
  starred: number
  cost_estimate: number
  created_at: number
}

declare global {
  interface Window {
    electron: ElectronAPI
    manthan: ManthanAPI
  }
}
