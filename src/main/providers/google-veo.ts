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
import { logger } from '../logger'

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
        name: 'Veo 3.1 Preview',
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
        supportedInputs: ['text', 'image', 'frames', 'video'],
        maxDuration: 8,
        supportedAspectRatios: ['16:9', '9:16'],
        supportedResolutions: ['720p', '1080p']
      },
      {
        id: 'veo-3.1-lite-generate-preview',
        name: 'Veo 3.1 Lite',
        description: 'Fast, cost-effective video generation (max 1080p)',
        modality: 'video',
        supportedInputs: ['text', 'image'],
        maxDuration: 8,
        supportedAspectRatios: ['16:9', '9:16'],
        supportedResolutions: ['720p', '1080p']
      }
    ]
  }

  private client: GoogleGenAI | null = null
  private apiKey: string | null = null
  private operations: Map<string, unknown> = new Map()

  isInitialized(): boolean {
    return this.client !== null
  }

  async initialize(apiKey: string): Promise<void> {
    this.client = new GoogleGenAI({ apiKey })
    this.apiKey = apiKey
    logger.info('Provider', 'Google Veo 3.1 initialized with API key')
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

    const isVideoExtension = !!params.video
    logger.debug('Provider', `generateVideo() called [${isVideoExtension ? 'EXTENSION' : 'STANDARD'}]`, {
      model: params.model || this.config.defaultModel,
      prompt: params.prompt.length > 100 ? params.prompt.substring(0, 100) + '...' : params.prompt,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      durationSeconds: params.durationSeconds,
      personGeneration: params.personGeneration,
      hasImage: !!params.image,
      hasVideo: isVideoExtension
    })

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

      // Always 1 video per request (Veo hard limit)
      genConfig.numberOfVideos = 1

      if (params.aspectRatio) genConfig.aspectRatio = params.aspectRatio
      if (params.resolution) genConfig.resolution = params.resolution
      if (params.durationSeconds) genConfig.durationSeconds = params.durationSeconds
      if (params.personGeneration) genConfig.personGeneration = params.personGeneration

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

      // Video extension — overrides resolution to 720p
      if (isVideoExtension) {
        requestParams.video = {
          videoBytes: params.video!.data,
          mimeType: params.video!.mimeType
        }
        genConfig.resolution = '720p'
        // Remove capabilities not applicable to extension
        delete genConfig.durationSeconds
        delete genConfig.personGeneration
        logger.info('Provider', 'Video extension mode — forcing 720p, numberOfVideos=1')
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

      logger.info('Provider', 'generateVideo() operation started', {
        operationId,
        operationName: operation._operationName
      })

      return operation
    } catch (error: unknown) {
      operation.status = 'failed'
      operation.error = error instanceof Error ? error.message : 'Generation failed'
      operation.completedAt = Date.now()
      logger.error('Provider', 'generateVideo() failed', { error: operation.error })
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
        updated as {
          response?: {
            generatedVideos?: Array<{
              video?: { uri?: string; videoBytes?: string; mimeType?: string }
            }>
          }
        }
      ).response

      if (done && response?.generatedVideos?.[0]) {
        const video = response.generatedVideos[0].video
        let data = video?.videoBytes || ''
        let mimeType = video?.mimeType || 'video/mp4'

        if (!data && video?.uri) {
          const downloaded = await this.downloadGeneratedVideo(video.uri)
          data = downloaded.data
          mimeType = downloaded.mimeType
        }

        if (!data) {
          throw new Error('Generated video did not include downloadable media data')
        }

        logger.info('Provider', 'pollOperation() result - completed', {
          operationId,
          videoUri: video?.uri
        })

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
            data,
            mimeType,
            metadata: video?.uri ? { sourceUri: video.uri } : undefined
          }
        }
      }

      logger.debug('Provider', 'pollOperation() result - generating', { operationId })

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

  private async downloadGeneratedVideo(uri: string): Promise<{ data: string; mimeType: string }> {
    if (!this.apiKey) {
      throw new Error('Google Veo API key is not available for video download')
    }

    const downloadUrl = new URL(uri)
    downloadUrl.searchParams.set('key', this.apiKey)

    const response = await fetch(downloadUrl.toString())

    if (!response.ok) {
      throw new Error(`Failed to download generated video: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'video/mp4'

    return {
      data: Buffer.from(arrayBuffer).toString('base64'),
      mimeType
    }
  }
}
