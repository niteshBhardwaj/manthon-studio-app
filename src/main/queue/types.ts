import type {
  AudioGenParams,
  GenerationResult,
  Modality,
  VideoGenParams,
  ImageGenParams
} from '../providers/base'

export type QueueJobType = Modality
export type QueueJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface QueueJobInputAsset {
  data?: string
  filePath?: string
  mimeType: string
  metadata?: Record<string, unknown>
  referenceType?: string
}

export interface QueueJobConfigPayload {
  contentType: QueueJobType
  activeMode: string | null
  batchCount: number
  capabilityValues: Record<string, unknown>
  providerParams: VideoGenParams | ImageGenParams | AudioGenParams
}

export interface QueueJobResult extends Partial<GenerationResult> {
  type: QueueJobType
  assetId?: string
  assetPath?: string
  thumbnailPath?: string | null
  filename?: string
}

export interface QueueJob {
  id: string
  group_id?: string
  project_id: string | null
  type: QueueJobType
  priority: number
  status: QueueJobStatus
  prompt: string
  negative_prompt: string
  provider: string
  model: string
  config: QueueJobConfigPayload
  input_assets: QueueJobInputAsset[]
  result: QueueJobResult | null
  error: string | null
  retry_count: number
  max_retries: number
  created_at: number
  started_at: number | null
  completed_at: number | null
  progress?: number
}

export interface QueueState {
  jobs: QueueJob[]
  grouped: Record<QueueJobStatus, QueueJob[]>
  isPaused: boolean
  counts: Record<QueueJobStatus, number>
}

export interface EnqueueJobInput {
  projectId?: string | null
  groupId?: string
  type: QueueJobType
  priority?: number
  prompt: string
  negativePrompt?: string
  provider: string
  model: string
  config: QueueJobConfigPayload
  inputAssets?: QueueJobInputAsset[]
  maxRetries?: number
}

export interface QueueConfig {
  concurrency: { video: number; image: number; audio: number }
  maxRetries: number
  retryDelayMs: number
}

export interface QueueJobProgressPayload {
  jobId: string
  progress: number
  status: QueueJobStatus
}

export interface QueueJobCompletePayload {
  jobId: string
  job: QueueJob
  result: QueueJobResult
}

export interface QueueJobFailedPayload {
  jobId: string
  job: QueueJob
  error: string
}
