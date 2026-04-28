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

    try {
      let response

      if (params.existingImage) {
        // Image editing — pass existing image + prompt
        response = await this.client.models.generateContent({
          model,
          contents: [
            { text: params.prompt },
            {
              inlineData: {
                mimeType: params.existingImage.mimeType,
                data: params.existingImage.data
              }
            }
          ]
        })
      } else {
        // Text-to-image
        response = await this.client.models.generateContent({
          model,
          contents: params.prompt
        })
      }

      // Extract image from response
      const parts = response.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        if (part.inlineData) {
          return {
            type: 'image',
            data: part.inlineData.data || '',
            mimeType: part.inlineData.mimeType || 'image/png'
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
