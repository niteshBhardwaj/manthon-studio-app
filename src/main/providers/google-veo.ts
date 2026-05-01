// ============================================================
// Manthan Studio — Google Veo 3.1 Provider
// Video generation using Google's Veo 3.1 API via @google/genai
// ============================================================

import { GoogleGenAI } from '@google/genai'
import {
  MediaProvider,
  Modality,
  InputType,
  ProviderConfig,
  ConnectionStatus,
  VideoGenParams,
  GenerationOperation,
  GenerationStatus
} from './base'

export class GoogleVeoProvider implements MediaProvider {
  id = 'google-veo'
  name = 'Google Veo 3.1'
  icon = 'video'
  supportedModalities: Modality[] = ['video']
  supportedInputs: InputType[] = ['text', 'image', 'frames', 'video']

  config: ProviderConfig = {
    defaultModel: 'veo-3.1-generate-preview',
    models: [
      {
        id: 'veo-3.1-generate-preview',
        name: 'Veo 3.1',
        description: 'High-fidelity video generation with native audio',
        modality: 'video',
        supportedInputs: ['text', 'image', 'frames', 'video'],
        maxDuration: 8,
        supportedAspectRatios: ['16:9', '9:16'],
        supportedResolutions: ['720p', '1080p', '4k']
      },
      {
        id: 'veo-3.1-fast-generate-preview',
        name: 'Veo 3.1 Fast',
        description: 'Faster video generation with good quality',
        modality: 'video',
        supportedInputs: ['text', 'image', 'frames'],
        maxDuration: 8,
        supportedAspectRatios: ['16:9', '9:16'],
        supportedResolutions: ['720p', '1080p']
      }
    ]
  }

  private client: GoogleGenAI | null = null
  private operations: Map<string, unknown> = new Map()

  isInitialized(): boolean {
    return this.client !== null
  }

  async initialize(apiKey: string): Promise<void> {
    this.client = new GoogleGenAI({ apiKey })
  }

  async testConnection(): Promise<ConnectionStatus> {
    if (!this.client) {
      return { connected: false, message: 'Not initialized. Add your API key.' }
    }

    try {
      // Try a lightweight call to verify the key works
      const models = await this.client.models.list()
      const hasVeo = models.page?.some((m) => m.name?.includes('veo'))
      return {
        connected: true,
        message: hasVeo ? 'Connected — Veo 3.1 available' : 'Connected — checking model access',
        model: 'veo-3.1-generate-preview'
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Connection failed'
      return { connected: false, message }
    }
  }

  async generateVideo(params: VideoGenParams): Promise<GenerationOperation> {
    if (!this.client) throw new Error('Provider not initialized')

    const operationId = `veo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const model = params.model || this.config.defaultModel

    const operation: GenerationOperation = {
      id: operationId,
      provider: this.id,
      type: 'video',
      status: 'generating',
      prompt: params.prompt,
      startedAt: Date.now()
    }

    try {
      // Build the generation request
      const genConfig: Record<string, unknown> = {}

      if (params.aspectRatio) genConfig.aspectRatio = params.aspectRatio
      if (params.resolution) genConfig.resolution = params.resolution
      if (params.numberOfVideos) genConfig.numberOfVideos = params.numberOfVideos

      // Build request params
      const requestParams: Record<string, unknown> = {
        model,
        prompt: params.prompt
      }

      // Image input (first frame)
      if (params.image) {
        requestParams.image = {
          imageBytes: params.image.data,
          mimeType: params.image.mimeType
        }
      }

      // Last frame for interpolation
      if (params.lastFrame) {
        genConfig.lastFrame = {
          imageBytes: params.lastFrame.data,
          mimeType: params.lastFrame.mimeType
        }
      }

      // Reference images (ingredients)
      if (params.referenceImages && params.referenceImages.length > 0) {
        genConfig.referenceImages = params.referenceImages.map((ref) => ({
          image: {
            imageBytes: ref.data,
            mimeType: ref.mimeType
          },
          referenceType: ref.referenceType || 'asset'
        }))
      }

      // Video extension
      if (params.video) {
        requestParams.video = {
          videoBytes: params.video.data,
          mimeType: params.video.mimeType
        }
        genConfig.numberOfVideos = 1
        genConfig.resolution = '720p'
      }

      if (Object.keys(genConfig).length > 0) {
        requestParams.config = genConfig
      }

      // Start the generation
      const rawOperation = await this.client.models.generateVideos(
        requestParams as unknown as Parameters<typeof this.client.models.generateVideos>[0]
      )

      // Store the raw operation for polling
      this.operations.set(operationId, rawOperation)
      operation._operationName = (rawOperation as { name?: string }).name

      return operation
    } catch (error: unknown) {
      operation.status = 'failed'
      operation.error = error instanceof Error ? error.message : 'Generation failed'
      operation.completedAt = Date.now()
      return operation
    }
  }

  async pollOperation(operationId: string): Promise<GenerationOperation> {
    if (!this.client) throw new Error('Provider not initialized')

    const rawOperation = this.operations.get(operationId)
    if (!rawOperation) {
      return {
        id: operationId,
        provider: this.id,
        type: 'video',
        status: 'failed',
        prompt: '',
        error: 'Operation not found',
        startedAt: 0
      }
    }

    try {
      const updated = await this.client.operations.getVideosOperation({
        operation: rawOperation as Parameters<
          typeof this.client.operations.getVideosOperation
        >[0]['operation']
      })

      this.operations.set(operationId, updated)

      const done = (updated as { done?: boolean }).done
      const response = (
        updated as { response?: { generatedVideos?: Array<{ video?: { uri?: string } }> } }
      ).response

      if (done && response?.generatedVideos?.[0]) {
        const video = response.generatedVideos[0].video

        return {
          id: operationId,
          provider: this.id,
          type: 'video',
          status: 'completed' as GenerationStatus,
          prompt: '',
          startedAt: 0,
          completedAt: Date.now(),
          result: {
            type: 'video',
            data: '',
            mimeType: 'video/mp4',
            uri: video?.uri || ''
          }
        }
      }

      return {
        id: operationId,
        provider: this.id,
        type: 'video',
        status: 'generating' as GenerationStatus,
        prompt: '',
        startedAt: 0
      }
    } catch (error: unknown) {
      return {
        id: operationId,
        provider: this.id,
        type: 'video',
        status: 'failed' as GenerationStatus,
        prompt: '',
        error: error instanceof Error ? error.message : 'Poll failed',
        startedAt: 0
      }
    }
  }

  async cancelOperation(operationId: string): Promise<void> {
    this.operations.delete(operationId)
  }
}
