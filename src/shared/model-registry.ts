export type ContentType = 'video' | 'image' | 'audio'

export type CapabilityType =
  | 'aspect_ratio'
  | 'resolution'
  | 'batch_count'
  | 'audio_toggle'
  | 'frames'
  | 'ingredients'
  | 'style_select'
  | 'duration'
  | 'negative_prompt'

export type CapabilityValue = string | number | boolean

export interface CapabilityOption {
  value: string
  label: string
  icon?: string
  default?: boolean
}

export interface ModelCapability {
  type: CapabilityType
  label: string
  options?: CapabilityOption[]
  min?: number
  max?: number
  step?: number
  defaultValue?: CapabilityValue
}

export interface ModelModeDescriptor {
  id: string
  label: string
  icon: string
  capabilities: ModelCapability[]
}

export interface ModelDescriptor {
  id: string
  name: string
  provider: string
  keyGroup: string
  contentType: ContentType
  description: string
  icon: string
  capabilities: ModelCapability[]
  modes?: ModelModeDescriptor[]
}

export interface KeyGroupDescriptor {
  id: string
  label: string
  modelIds: string[]
  providerIds: string[]
}

const aspectRatioImageOptions: CapabilityOption[] = [
  { value: '16:9', label: '16:9', icon: 'landscape' },
  { value: '4:3', label: '4:3', icon: 'photo' },
  { value: '1:1', label: '1:1', icon: 'square', default: true },
  { value: '3:4', label: '3:4', icon: 'portrait' },
  { value: '9:16', label: '9:16', icon: 'phone' }
]

const aspectRatioVideoOptions: CapabilityOption[] = [
  { value: '9:16', label: '9:16', icon: 'phone' },
  { value: '16:9', label: '16:9', icon: 'landscape', default: true }
]

const batchCountOptions: CapabilityOption[] = [
  { value: '1', label: '1x', default: true },
  { value: '2', label: 'x2' },
  { value: '3', label: 'x3' },
  { value: '4', label: 'x4' }
]

const videoSharedCapabilities: ModelCapability[] = [
  {
    type: 'aspect_ratio',
    label: 'Aspect Ratio',
    options: aspectRatioVideoOptions,
    defaultValue: '16:9'
  },
  {
    type: 'batch_count',
    label: 'Batch Count',
    options: batchCountOptions,
    defaultValue: 1
  }
]

export const MODEL_REGISTRY: ModelDescriptor[] = [
  {
    id: 'veo-3.1-generate-preview',
    name: 'Veo 3.1',
    provider: 'google-veo',
    keyGroup: 'google',
    contentType: 'video',
    description: 'High-fidelity video generation with native audio.',
    icon: 'video',
    capabilities: [
      ...videoSharedCapabilities,
      {
        type: 'resolution',
        label: 'Resolution',
        options: [
          { value: '720p', label: '720p' },
          { value: '1080p', label: '1080p', default: true },
          { value: '4k', label: '4K' }
        ],
        defaultValue: '1080p'
      },
      {
        type: 'audio_toggle',
        label: 'Audio',
        defaultValue: true
      }
    ],
    modes: [
      {
        id: 'frames',
        label: 'Frames',
        icon: 'frames',
        capabilities: [{ type: 'frames', label: 'Frames' }]
      },
      {
        id: 'ingredients',
        label: 'Ingredients',
        icon: 'ingredients',
        capabilities: [{ type: 'ingredients', label: 'Ingredients' }]
      }
    ]
  },
  {
    id: 'veo-3.1-fast-generate-preview',
    name: 'Veo 3.1 Fast',
    provider: 'google-veo',
    keyGroup: 'google',
    contentType: 'video',
    description: 'Faster video generation with lighter controls.',
    icon: 'video',
    capabilities: videoSharedCapabilities,
    modes: [
      {
        id: 'frames',
        label: 'Frames',
        icon: 'frames',
        capabilities: [{ type: 'frames', label: 'Frames' }]
      }
    ]
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    provider: 'google-imagen',
    keyGroup: 'google',
    contentType: 'image',
    description: 'Professional asset production with advanced reasoning.',
    icon: 'image',
    capabilities: [
      {
        type: 'aspect_ratio',
        label: 'Aspect Ratio',
        options: aspectRatioImageOptions,
        defaultValue: '1:1'
      },
      {
        type: 'batch_count',
        label: 'Batch Count',
        options: batchCountOptions,
        defaultValue: 1
      },
      {
        type: 'style_select',
        label: 'Style',
        options: [
          { value: 'natural', label: 'Natural', default: true },
          { value: 'cinematic', label: 'Cinematic' },
          { value: 'editorial', label: 'Editorial' },
          { value: 'product', label: 'Product' },
          { value: 'illustration', label: 'Illustration' }
        ],
        defaultValue: 'natural'
      }
    ]
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Nano Banana 2',
    provider: 'google-imagen',
    keyGroup: 'google',
    contentType: 'image',
    description: 'High-efficiency image generation optimized for speed.',
    icon: 'image',
    capabilities: [
      {
        type: 'aspect_ratio',
        label: 'Aspect Ratio',
        options: aspectRatioImageOptions,
        defaultValue: '1:1'
      },
      {
        type: 'batch_count',
        label: 'Batch Count',
        options: batchCountOptions,
        defaultValue: 1
      }
    ]
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana Classic',
    provider: 'google-imagen',
    keyGroup: 'google',
    contentType: 'image',
    description: 'Fast and efficient for high-volume image tasks.',
    icon: 'image',
    capabilities: [
      {
        type: 'aspect_ratio',
        label: 'Aspect Ratio',
        options: aspectRatioImageOptions,
        defaultValue: '1:1'
      },
      {
        type: 'batch_count',
        label: 'Batch Count',
        options: batchCountOptions,
        defaultValue: 1
      }
    ]
  },
  {
    id: 'lyria-realtime-exp',
    name: 'Lyria Realtime',
    provider: 'google-lyria',
    keyGroup: 'google',
    contentType: 'audio',
    description: 'Prompt-driven audio generation with adjustable duration.',
    icon: 'music',
    capabilities: [
      {
        type: 'duration',
        label: 'Duration',
        min: 5,
        max: 30,
        step: 5,
        defaultValue: 15
      }
    ]
  }
]

export const CONTENT_TYPES: ContentType[] = ['image', 'video', 'audio']

export const KEY_GROUPS: KeyGroupDescriptor[] = [
  {
    id: 'google',
    label: 'Google AI',
    modelIds: MODEL_REGISTRY.filter((model) => model.keyGroup === 'google').map(
      (model) => model.id
    ),
    providerIds: Array.from(
      new Set(
        MODEL_REGISTRY.filter((model) => model.keyGroup === 'google').map((model) => model.provider)
      )
    )
  }
]

export const PROVIDER_GROUP_MAPPING = MODEL_REGISTRY.reduce<Record<string, string>>(
  (mapping, model) => {
    mapping[model.provider] = model.keyGroup
    return mapping
  },
  {}
)

export function getModelById(id: string): ModelDescriptor | undefined {
  return MODEL_REGISTRY.find((model) => model.id === id)
}

export function getModelsByContentType(
  type: ContentType,
  enabledModelIds?: Iterable<string>
): ModelDescriptor[] {
  const enabledSet = enabledModelIds ? new Set(enabledModelIds) : null
  return MODEL_REGISTRY.filter(
    (model) => model.contentType === type && (!enabledSet || enabledSet.has(model.id))
  )
}

export function getContentTypes(): ContentType[] {
  return [...CONTENT_TYPES]
}

export function getAvailableContentTypes(enabledModelIds?: Iterable<string>): ContentType[] {
  return CONTENT_TYPES.filter((type) => getModelsByContentType(type, enabledModelIds).length > 0)
}

export function getDefaultModel(
  type: ContentType,
  enabledModelIds?: Iterable<string>
): ModelDescriptor | undefined {
  return getModelsByContentType(type, enabledModelIds)[0]
}

export function getKeyGroups(): KeyGroupDescriptor[] {
  return KEY_GROUPS.map((group) => ({ ...group }))
}

export function getDefaultCapabilityValues(
  model: ModelDescriptor
): Record<string, CapabilityValue> {
  const values: Record<string, CapabilityValue> = {}

  const applyDefaults = (capabilities: ModelCapability[]): void => {
    capabilities.forEach((capability) => {
      if (capability.type === 'frames' || capability.type === 'ingredients') return

      if (capability.defaultValue !== undefined) {
        values[capability.type] = capability.defaultValue
        return
      }

      const defaultOption = capability.options?.find((option) => option.default)
      if (defaultOption) {
        values[capability.type] = defaultOption.value
      }
    })
  }

  applyDefaults(model.capabilities)
  model.modes?.forEach((mode) => applyDefaults(mode.capabilities))

  return values
}
