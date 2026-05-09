// ============================================================
// Manthan Studio — Google Nano Banana (Imagen) Provider
// Image generation using Gemini's native image generation
// ============================================================

import { GoogleGenAI } from '@google/genai'
import {
  MediaProvider,
  Modality,
  InputType,
  ProviderConfig,
  ConnectionStatus,
  ImageGenParams,
  GenerationResult
} from './base'
import { logger } from '../logger'
import { appStore } from '../store/app-store'

export class GoogleImagenProvider implements MediaProvider {
  id = 'google-imagen'
  name = 'Nano Banana'
  icon = 'image'
  supportedModalities: Modality[] = ['image']
  supportedInputs: InputType[] = ['text', 'image']

  config: ProviderConfig = {
    defaultModel: 'gemini-3.1-flash-image-preview',
    models: [
      {
        id: 'gemini-3.1-flash-image-preview',
        name: 'Nano Banana 2',
        description: 'High-efficiency image generation optimized for speed',
        modality: 'image',
        supportedInputs: ['text', 'image']
      },
      {
        id: 'gemini-3-pro-image-preview',
        name: 'Nano Banana Pro',
        description: 'Professional asset production with advanced reasoning',
        modality: 'image',
        supportedInputs: ['text', 'image']
      },
      {
        id: 'gemini-2.5-flash-image',
        name: 'Nano Banana Classic',
        description: 'Fast and efficient for high-volume tasks',
        modality: 'image',
        supportedInputs: ['text', 'image']
      }
    ]
  }

  private client: GoogleGenAI | null = null

  isInitialized(): boolean {
    return this.client !== null
  }

  async initialize(apiKey: string): Promise<void> {
    this.client = new GoogleGenAI({ apiKey })
    logger.info('Provider', 'Google Nano Banana initialized')
  }

  async testConnection(): Promise<ConnectionStatus> {
    if (!this.client) {
      return { connected: false, message: 'Not initialized. Add your API key.' }
    }

    try {
      // Simple test — generate a tiny content request
      const response = await this.client.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: 'Say "hello" in one word only.'
      })

      if (response) {
        return {
          connected: true,
          message: 'Connected — Nano Banana available',
          model: 'gemini-3.1-flash-image-preview'
        }
      }
      return { connected: false, message: 'Unexpected response' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Connection failed'
      return { connected: false, message }
    }
  }

  async generateImage(params: ImageGenParams): Promise<GenerationResult> {
    if (!this.client) throw new Error('Provider not initialized')

    const model = params.model || this.config.defaultModel

    logger.debug('Provider', 'generateImage() called', {
      model,
      prompt: params.prompt.length > 100 ? params.prompt.substring(0, 100) + '...' : params.prompt,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution
    })

    try {
      const contents: any[] = [{ text: params.prompt }]

      if (params.existingImage) {
        contents.push({
          inlineData: {
            mimeType: params.existingImage.mimeType,
            data: params.existingImage.data
          }
        })
      }

      if (params.referenceImages && params.referenceImages.length > 0) {
        for (const img of params.referenceImages) {
          contents.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.data
            }
          })
        }
      }

      if (params.thoughtSignature) {
        contents.push({
          thoughtSignature: params.thoughtSignature
        })
      }

      const config: any = {
        responseModalities: ['Image']
      }

      if (params.aspectRatio || params.resolution) {
        config.imageConfig = {}
        if (params.aspectRatio) config.imageConfig.aspectRatio = params.aspectRatio
        if (params.resolution) config.imageConfig.imageSize = params.resolution
      }

      if (params.thinkingLevel) {
        config.thinkingConfig = { thinkingLevel: params.thinkingLevel }
      }

      if (params.webSearchGrounding || params.imageSearchGrounding) {
        config.tools = config.tools || []
        config.tools.push({
          googleSearch: {
            searchTypes: {
              ...(params.webSearchGrounding ? { webSearch: {} } : {}),
              ...(params.imageSearchGrounding ? { imageSearch: {} } : {})
            }
          }
        })
      }

      // DRY RUN: Log and intercept if enabled in preferences
      if (appStore.getPreferences().dryRun) {
        const requestPayload = { model, contents, config }
        const payloadString = JSON.stringify(requestPayload, null, 2)
        logger.info('DRY-RUN', 'Imagen API Payload intercepted', { payload: requestPayload })
        appStore.saveApiLog({
          jobId: params.jobId,
          provider: this.id,
          method: 'generateImage',
          payload: payloadString
        })
        throw new Error('DRY RUN: API request captured and logged to database.')
      }

      const response = await this.client.models.generateContent({
        model,
        contents,
        config
      })

      const parts = response.candidates?.[0]?.content?.parts || []
      const images: Array<{ data: string; mimeType: string }> = []
      let thoughtSignature: string | undefined
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata

      for (const part of parts) {
        if (part.inlineData) {
          images.push({
            data: part.inlineData.data || '',
            mimeType: part.inlineData.mimeType || 'image/png'
          })
        }
        if (part.thoughtSignature) {
          thoughtSignature = part.thoughtSignature
        }
      }

      if (images.length > 0) {
        const finalImage = images[images.length - 1]
        logger.info('Provider', 'generateImage() completed', {
          partsCount: parts.length,
          imagesCount: images.length,
          finalSize: Math.round(finalImage.data.length * 0.75)
        })
        return {
          type: 'image',
          data: finalImage.data,
          mimeType: finalImage.mimeType,
          metadata: {
            images,
            thoughtSignature,
            groundingMetadata
          }
        }
      }

      throw new Error('No image in response')
    } catch (error: unknown) {
      throw new Error(
        `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
