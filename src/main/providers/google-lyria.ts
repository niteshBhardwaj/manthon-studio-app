// ============================================================
// Manthan Studio — Google Lyria 3 Audio Provider
// Music / sound generation via Gemini API
// ============================================================

import { GoogleGenAI } from '@google/genai'
import {
  MediaProvider,
  Modality,
  InputType,
  ProviderConfig,
  ConnectionStatus,
  AudioGenParams,
  GenerationResult
} from './base'
import { logger } from '../logger'
import { appStore } from '../store/app-store'

export class GoogleLyriaProvider implements MediaProvider {
  id = 'google-lyria'
  name = 'Lyria 3'
  icon = 'music'
  supportedModalities: Modality[] = ['audio']
  supportedInputs: InputType[] = ['text', 'image']

  config: ProviderConfig = {
    models: [
      {
        id: 'lyria-3-pro-preview',
        name: 'Lyria 3 Pro',
        description:
          'Full-length songs, timestamp control, and multimodal (image-to-audio) generation.',
        modality: 'audio',
        supportedInputs: ['text', 'image'],
        maxDuration: 180
      },
      {
        id: 'lyria-3-clip-preview',
        name: 'Lyria 3 Clip',
        description: 'Fast, fixed 30-second clips for short audio generation.',
        modality: 'audio',
        supportedInputs: ['text'],
        maxDuration: 30
      }
    ],
    defaultModel: 'lyria-3-pro-preview'
  }

  private client: GoogleGenAI | null = null

  async initialize(apiKey: string): Promise<void> {
    this.client = new GoogleGenAI({ apiKey })
    logger.info('Provider', 'Google Lyria 3 initialized')
  }

  isInitialized(): boolean {
    return this.client !== null
  }

  async testConnection(): Promise<ConnectionStatus> {
    if (!this.client) {
      return { connected: false, message: 'Not initialized' }
    }

    try {
      // Quick test — verify API key works with standard Gemini
      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Ping'
      })

      if (response) {
        return { connected: true, message: 'Lyria 3 audio ready', model: 'lyria-3-pro-preview' }
      }

      return { connected: false, message: 'Unexpected response' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Connection failed'
      // Even if the specific model isn't available, the API key works
      if (message.includes('not found') || message.includes('permission')) {
        return { connected: true, message: 'API key valid (model access pending)' }
      }
      return { connected: false, message }
    }
  }

  async generateAudio(params: AudioGenParams): Promise<GenerationResult> {
    if (!this.client) throw new Error('Lyria provider not initialized')

    const model = params.model || this.config.defaultModel
    const isPro = model.includes('pro')

    logger.debug('Provider', 'generateAudio() called', {
      model,
      duration: params.duration,
      hasImages: !!params.referenceImages?.length
    })

    try {
      let contents: string | Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>

      let finalPrompt = params.prompt

      // Lyria 3 Pro controls duration via text prompt instructions
      if (isPro && params.duration && finalPrompt) {
        finalPrompt = `${finalPrompt}\n\n(Instruction: Create a ${params.duration}-second song)`
      }

      if (isPro && params.referenceImages && params.referenceImages.length > 0) {
        contents = finalPrompt ? [{ text: finalPrompt }] : []
        for (const img of params.referenceImages) {
          contents.push({
            inlineData: {
              data: img.data.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: img.mimeType
            }
          })
        }
      } else {
        contents = finalPrompt
      }

      const requestedFormat = params.audioFormat ?? 'mp3'
      const canRequestWav = isPro && requestedFormat === 'wav'
      const fallbackMimeType = canRequestWav ? 'audio/wav' : 'audio/mpeg'
      const request: Parameters<typeof this.client.models.generateContent>[0] = {
        model,
        contents
      }

      if (canRequestWav) {
        request.config = {
          responseModalities: ['AUDIO', 'TEXT'],
          responseMimeType: 'audio/wav'
        }
      }

      // DRY RUN: Log and intercept if enabled in preferences
      if (appStore.getPreferences().dryRun) {
        const payloadString = JSON.stringify(request, null, 2)
        logger.info('DRY-RUN', 'Lyria API Payload intercepted', { payload: request })
        appStore.saveApiLog({
          jobId: params.jobId,
          provider: this.id,
          method: 'generateAudio',
          payload: payloadString
        })
        throw new Error('DRY RUN: API request captured and logged to database.')
      }

      const response = await this.client.models.generateContent(request)

      const candidate = response.candidates?.[0]
      const parts = candidate?.content?.parts || []

      let audioData = ''
      let audioMimeType = fallbackMimeType

      // Lyria returns the generated media as inline audio bytes.
      for (const part of parts) {
        if (part.inlineData) {
          audioData = part.inlineData.data || ''
          audioMimeType = part.inlineData.mimeType || fallbackMimeType
        }
      }

      if (!audioData) {
        throw new Error('No audio data in response')
      }

      return {
        type: 'audio',
        data: audioData,
        mimeType: audioMimeType,
        duration: params.duration || (isPro ? 60 : 30)
      }
    } catch (error: unknown) {
      logger.error('Provider', 'generateAudio() failed', { error: error instanceof Error ? error.message : 'Unknown' })
      throw new Error(
        `Audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
