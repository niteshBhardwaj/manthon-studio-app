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
  | 'thinking_level'
  | 'include_thoughts'
  | 'web_search_grounding'
  | 'image_search_grounding'

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

export interface PromptExample {
  title: string
  prompt: string
  imageName: string
  configOverrides?: Record<string, unknown>
}

export interface ModelDescriptor {
  id: string
  name: string
  provider: string
  keyGroup: string
  contentType: ContentType
  description: string
  icon: string
  maxImages?: number
  capabilities: ModelCapability[]
  modes?: ModelModeDescriptor[]
  examples?: PromptExample[]
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

const aspectRatioImageExtendedOptions: CapabilityOption[] = [
  ...aspectRatioImageOptions,
  { value: '1:4', label: '1:4' },
  { value: '4:1', label: '4:1' },
  { value: '1:8', label: '1:8' },
  { value: '8:1', label: '8:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:2', label: '3:2' },
  { value: '4:5', label: '4:5' },
  { value: '5:4', label: '5:4' },
  { value: '21:9', label: '21:9' }
]

const imageResolutionOptions: CapabilityOption[] = [
  { value: '1K', label: '1K', default: true },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' }
]

const imageResolutionExtendedOptions: CapabilityOption[] = [
  { value: '512', label: '512' },
  ...imageResolutionOptions
]

const thinkingLevelOptions: CapabilityOption[] = [
  { value: 'minimal', label: 'Minimal', default: true },
  { value: 'high', label: 'High' }
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
    maxImages: 14,
    capabilities: [
      {
        type: 'aspect_ratio',
        label: 'Aspect Ratio',
        options: aspectRatioImageOptions,
        defaultValue: '1:1'
      },
      {
        type: 'resolution',
        label: 'Resolution',
        options: imageResolutionOptions,
        defaultValue: '1K'
      },
      {
        type: 'batch_count',
        label: 'Batch Count',
        options: batchCountOptions,
        defaultValue: 1
      },
      {
        type: 'include_thoughts',
        label: 'Thinking',
        defaultValue: true
      },
      {
        type: 'web_search_grounding',
        label: 'Web Search Grounding',
        defaultValue: false
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
    ],
    examples: [
      {
        title: 'Photorealism / Lighting',
        prompt: 'A portrait of a young woman with freckles, cinematic lighting, dramatic shadows, 85mm lens, photorealistic.',
        imageName: 'photorealistic_example',
        configOverrides: { aspect_ratio: '3:4', resolution: '4K' }
      },
      {
        title: 'Style Transfer (via Thinking)',
        prompt: 'Generate a futuristic city. Thought process: 1. Start with a modern skyline. 2. Add flying cars and neon lights. 3. Apply a cyberpunk color palette.',
        imageName: 'city_style_transfer',
        configOverrides: { thinking_level: 'high', include_thoughts: true }
      },
      {
        title: 'Logo Design',
        prompt: "A minimalist logo for a coffee shop named 'Bean & Brew', featuring a simple coffee bean and a stylized cup, monochrome.",
        imageName: 'logo_example',
        configOverrides: { aspect_ratio: '1:1' }
      },
      {
        title: 'Multi-Image Composition',
        prompt: 'A fashion shot of a model wearing [Image 1: sunglasses] and [Image 2: jacket] standing in [Image 3: street scene].',
        imageName: 'fashion_ecommerce_shot'
      },
      {
        title: 'Professional Product Shots',
        prompt: "A photo of a glossy magazine cover, the minimal blue cover has the large bold words Nano Banana. The text is in a serif font and fills the view. No other text. In front of the text there is a portrait of a person in a sleek and minimal dress. She is playfully holding the number 2, which is the focal point. Put the issue number and 'Feb 2026' date in the corner along with a barcode. The magazine is on a shelf against an orange plastered wall, within a designer store.",
        imageName: 'glossy_magazine_cover',
        configOverrides: { aspect_ratio: '3:4', resolution: '4K' }
      },
      {
        title: 'Search Grounded Isometric',
        prompt: "Present a clear, 45° top-down isometric miniature 3D cartoon scene of London, featuring its most iconic landmarks and architectural elements. Use soft, refined textures with realistic PBR materials and gentle, lifelike lighting and shadows. Integrate the current weather conditions directly into the city environment to create an immersive atmospheric mood. Use a clean, minimalistic composition with a soft, solid-colored background. At the top-center, place the title 'London' in large bold text, a prominent weather icon beneath it, then the date (small text) and temperature (medium text). All text must be centered with consistent spacing, and may subtly overlap the tops of the buildings.",
        imageName: 'london_weather_isometric',
        configOverrides: { web_search_grounding: true, aspect_ratio: '16:9', resolution: '4K' }
      },
      {
        title: 'Search Grounded Article',
        prompt: 'Use search to find how the Gemini 3 Flash launch has been received. Use this information to write a short article about it (with headings). Return a photo of the article as it appeared in a design focused glossy magazine. It is a photo of a single folded over page, showing the article about Gemini 3 Flash. One hero photo. Headline in serif.',
        imageName: 'gemini_flash_article',
        configOverrides: { web_search_grounding: true, aspect_ratio: '3:4' }
      },
      {
        title: 'Mixed Artistic Styles',
        prompt: 'A photo of an everyday scene at a busy cafe serving breakfast. In the foreground is an anime man with blue hair, one of the people is a pencil sketch, another is a claymation person',
        imageName: 'cafe_mixed_styles',
        configOverrides: { aspect_ratio: '16:9' }
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
    maxImages: 14,
    capabilities: [
      {
        type: 'aspect_ratio',
        label: 'Aspect Ratio',
        options: aspectRatioImageExtendedOptions,
        defaultValue: '1:1'
      },
      {
        type: 'resolution',
        label: 'Resolution',
        options: imageResolutionExtendedOptions,
        defaultValue: '1K'
      },
      {
        type: 'batch_count',
        label: 'Batch Count',
        options: batchCountOptions,
        defaultValue: 1
      },
      {
        type: 'thinking_level',
        label: 'Thinking Level',
        options: thinkingLevelOptions,
        defaultValue: 'minimal'
      },
      {
        type: 'web_search_grounding',
        label: 'Web Search Grounding',
        defaultValue: false
      },
      {
        type: 'image_search_grounding',
        label: 'Image Search Grounding',
        defaultValue: false
      }
    ],
    examples: [
      {
        title: 'Simple Subject + Context',
        prompt: 'A red panda sticker with a white border, cartoon style, cute.',
        imageName: 'red_panda_sticker',
        configOverrides: { aspect_ratio: '1:1' }
      },
      {
        title: 'Photorealism / Lighting',
        prompt: 'A portrait of a young woman with freckles, cinematic lighting, dramatic shadows, 85mm lens, photorealistic.',
        imageName: 'photorealistic_example',
        configOverrides: { aspect_ratio: '3:4' }
      },
      {
        title: 'Style Transfer (via Thinking)',
        prompt: 'Generate a futuristic city. Thought process: 1. Start with a modern skyline. 2. Add flying cars and neon lights. 3. Apply a cyberpunk color palette.',
        imageName: 'city_style_transfer',
        configOverrides: { thinking_level: 'high', include_thoughts: true }
      },
      {
        title: 'Image Search Grounding',
        prompt: 'Use image search to find accurate images of a resplendent quetzal bird. Create a beautiful 3:2 wallpaper of this bird, with a natural top to bottom gradient and minimal composition.',
        imageName: 'quetzal_bird_wallpaper',
        configOverrides: { image_search_grounding: true, aspect_ratio: '3:2' }
      },
      {
        title: 'Photorealistic Isometric',
        prompt: "Make a photo that is perfectly isometric. It is not a miniature, it is a captured photo that just happened to be perfectly isometric. It is a photo of a beautiful modern garden. There's a large 2 shaped pool and the words: Nano Banana 2.",
        imageName: 'isometric_garden',
        configOverrides: { aspect_ratio: '1:1' }
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
    maxImages: 3,
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
    ],
    examples: [
      {
        title: 'Simple Subject + Context',
        prompt: 'A red panda sticker with a white border, cartoon style, cute.',
        imageName: 'red_panda_sticker'
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
