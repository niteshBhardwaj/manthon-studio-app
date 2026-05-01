// ============================================================
// Manthan Studio — Provider Base Interface
// Core abstraction layer for all AI generation providers
// ============================================================

export type Modality = 'video' | 'image' | 'audio'
export type InputType = 'text' | 'image' | 'video' | 'audio' | 'frames'

export type GenerationStatus = 'queued' | 'generating' | 'completed' | 'failed' | 'cancelled'

export interface ConnectionStatus {
  connected: boolean
  message: string
  model?: string
}

export interface ProviderConfig {
  models: ModelConfig[]
  defaultModel: string
}

export interface ModelConfig {
  id: string
  name: string
  description: string
  modality: Modality
  supportedInputs: InputType[]
  maxDuration?: number
  supportedAspectRatios?: string[]
  supportedResolutions?: string[]
}

export interface VideoGenParams {
  prompt: string
  negativePrompt?: string
  model?: string
  aspectRatio?: '16:9' | '9:16'
  resolution?: '720p' | '1080p' | '4k'
  duration?: number
  numberOfVideos?: number
  // Image inputs
  image?: { data: string; mimeType: string }
  lastFrame?: { data: string; mimeType: string }
  referenceImages?: Array<{ data: string; mimeType: string; referenceType: string }>
  // Video extension
  video?: { data: string; mimeType: string }
  // Audio
  enableAudio?: boolean
}

export interface ImageGenParams {
  prompt: string
  model?: string
  existingImage?: { data: string; mimeType: string }
  referenceImages?: Array<{ data: string; mimeType: string }>
  aspectRatio?: string
  resolution?: string
  thinkingLevel?: string
  includeThoughts?: boolean
  webSearchGrounding?: boolean
  imageSearchGrounding?: boolean
  thoughtSignature?: string
}

export interface AudioGenParams {
  prompt: string
  model?: string
  duration?: number
}

export interface GenerationOperation {
  id: string
  provider: string
  type: Modality
  status: GenerationStatus
  prompt: string
  progress?: number
  result?: GenerationResult
  error?: string
  startedAt: number
  completedAt?: number
  // Internal — the raw operation name for polling
  _operationName?: string
}

export interface GenerationResult {
  type: Modality
  data: string // base64 or file path
  mimeType: string
  uri?: string
  duration?: number
  metadata?: Record<string, unknown>
}

export interface MediaProvider {
  id: string
  name: string
  icon: string
  supportedModalities: Modality[]
  supportedInputs: InputType[]
  config: ProviderConfig

  // Lifecycle
  initialize(apiKey: string): Promise<void>
  testConnection(): Promise<ConnectionStatus>
  isInitialized(): boolean

  // Generation
  generateVideo?(params: VideoGenParams): Promise<GenerationOperation>
  generateImage?(params: ImageGenParams): Promise<GenerationResult>
  generateAudio?(params: AudioGenParams): Promise<GenerationResult>

  // Operations
  pollOperation?(operationId: string): Promise<GenerationOperation>
  cancelOperation?(operationId: string): Promise<void>
}
