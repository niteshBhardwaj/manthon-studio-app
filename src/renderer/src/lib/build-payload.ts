import type { AudioGenParams, ImageGenParams, VideoGenParams } from '../../../main/providers/base'
import { getModelById, type CapabilityValue, type ModelDescriptor } from './model-capabilities'

type BinaryInput = { data: string; mimeType: string; metadata?: Record<string, unknown> }

interface BuildPayloadArgs {
  prompt: string
  negativePrompt?: string
  selectedModel: string | ModelDescriptor
  capabilityValues: Record<string, CapabilityValue>
  startFrame: BinaryInput | null
  endFrame: BinaryInput | null
  videoInput: BinaryInput | null
  referenceImages: BinaryInput[]
  batchCount?: number
  activeMode?: string | null
}

export type BuiltPayload =
  | { contentType: 'video'; providerId: string; params: VideoGenParams }
  | { contentType: 'image'; providerId: string; params: ImageGenParams }
  | { contentType: 'audio'; providerId: string; params: AudioGenParams }

function asString(value: CapabilityValue | undefined, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`)
  }
  return value
}

function asNumber(value: CapabilityValue | undefined, label: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  throw new Error(`${label} must be a number`)
}

function asBoolean(value: CapabilityValue | undefined, label: string): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`)
  }
  return value
}

function assertOptionValue(
  model: ModelDescriptor,
  capabilityType: string,
  value: string | undefined
): string | undefined {
  if (!value) return value

  const capabilities = [
    ...model.capabilities,
    ...(model.modes?.flatMap((mode) => mode.capabilities) ?? [])
  ]
  const capability = capabilities.find((entry) => entry.type === capabilityType)
  if (!capability?.options?.length) return value

  const option = capability.options.find((entry) => entry.value === value)
  if (!option) {
    throw new Error(`${model.name} does not support ${capability.label.toLowerCase()} "${value}"`)
  }

  return option.value
}

export function buildPayload({
  prompt,
  negativePrompt,
  selectedModel,
  capabilityValues,
  startFrame,
  endFrame,
  videoInput,
  referenceImages,
  batchCount,
  activeMode
}: BuildPayloadArgs): BuiltPayload {
  const model = typeof selectedModel === 'string' ? getModelById(selectedModel) : selectedModel

  if (!model) {
    throw new Error('Selected model not found')
  }

  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    throw new Error('Prompt is required')
  }

  const resolvedBatchCount =
    batchCount ?? asNumber(capabilityValues.batch_count, 'Batch count') ?? 1

  if (model.contentType === 'video') {
    const aspectRatio = assertOptionValue(
      model,
      'aspect_ratio',
      asString(capabilityValues.aspect_ratio, 'Aspect ratio')
    ) as VideoGenParams['aspectRatio'] | undefined
    const resolution = assertOptionValue(
      model,
      'resolution',
      asString(capabilityValues.resolution, 'Resolution')
    ) as VideoGenParams['resolution'] | undefined
    const durationSeconds = asNumber(capabilityValues.duration_seconds, 'Duration')
    const personGeneration = assertOptionValue(
      model,
      'person_generation',
      asString(capabilityValues.person_generation, 'Person Generation')
    ) as VideoGenParams['personGeneration'] | undefined

    const params: VideoGenParams = {
      prompt: trimmedPrompt,
      model: model.id,
      aspectRatio,
      resolution,
      numberOfVideos: 1,
      durationSeconds,
      personGeneration
    }

    const normalizedNegativePrompt = negativePrompt?.trim()
    if (normalizedNegativePrompt) {
      params.negativePrompt = normalizedNegativePrompt
    }

    // Video extension (true Veo extend) — overrides everything
    if (videoInput) {
      params.video = videoInput
      params.resolution = '720p'
    } else if (activeMode === 'frames') {
      if (startFrame) params.image = startFrame
      if (endFrame) params.lastFrame = endFrame
    }

    if (activeMode === 'ingredients' && referenceImages.length > 0) {
      params.referenceImages = referenceImages.map((image) => ({
        ...image,
        referenceType: 'asset'
      }))
    }

    return {
      contentType: 'video',
      providerId: model.provider,
      params
    }
  }

  if (model.contentType === 'image') {
    const aspectRatio = assertOptionValue(
      model,
      'aspect_ratio',
      asString(capabilityValues.aspect_ratio, 'Aspect ratio')
    )
    const style = assertOptionValue(
      model,
      'style_select',
      asString(capabilityValues.style_select, 'Style')
    )

    const resolution = assertOptionValue(
      model,
      'resolution',
      asString(capabilityValues.resolution, 'Resolution')
    )
    const thinkingLevel = assertOptionValue(
      model,
      'thinking_level',
      asString(capabilityValues.thinking_level, 'Thinking Level')
    )
    const includeThoughts = asBoolean(capabilityValues.include_thoughts, 'Thinking Toggle')
    const webSearchGrounding = asBoolean(
      capabilityValues.web_search_grounding,
      'Web Search Grounding'
    )
    const imageSearchGrounding = asBoolean(
      capabilityValues.image_search_grounding,
      'Image Search Grounding'
    )

    const styledPrompt =
      style && style !== 'natural' ? `${trimmedPrompt}. Style: ${style}.` : trimmedPrompt

    const params: ImageGenParams = {
      prompt: styledPrompt,
      model: model.id,
      aspectRatio,
      resolution,
      thinkingLevel,
      includeThoughts,
      webSearchGrounding,
      imageSearchGrounding
    }

    if (startFrame) {
      params.existingImage = startFrame
      if (startFrame.metadata?.thoughtSignature) {
        params.thoughtSignature = startFrame.metadata.thoughtSignature as string
      }
    }

    if (referenceImages && referenceImages.length > 0) {
      params.referenceImages = referenceImages

      const sig = referenceImages.find((img) => img.metadata?.thoughtSignature)?.metadata
        ?.thoughtSignature
      if (sig) {
        params.thoughtSignature = sig as string
      }
    }

    return {
      contentType: 'image',
      providerId: model.provider,
      params
    }
  }

  const duration = asNumber(capabilityValues.duration, 'Duration')
  const audioFormat = assertOptionValue(
    model,
    'audio_format',
    asString(capabilityValues.audio_format, 'Audio format')
  ) as AudioGenParams['audioFormat'] | undefined

  const params: AudioGenParams = {
    prompt: trimmedPrompt,
    model: model.id,
    duration,
    audioFormat
  }

  if (activeMode === 'ingredients' && referenceImages.length > 0) {
    params.referenceImages = referenceImages
  }

  return {
    contentType: 'audio',
    providerId: model.provider,
    params
  }
}
