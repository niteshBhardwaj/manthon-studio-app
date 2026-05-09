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
  | 'person_generation'
  | 'duration_seconds'
  | 'audio_format'

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
  youtubeLink?: string
  audioLink?: string
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
  supportsVideoExtension?: boolean
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
    supportsVideoExtension: true,
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
        type: 'person_generation',
        label: 'Person Generation',
        options: [
          { value: 'allow_all', label: 'Allow All', default: true },
          { value: 'allow_adult', label: 'Allow Adult' },
          { value: 'dont_allow', label: "Don't Allow" }
        ],
        defaultValue: 'allow_all'
      },
      {
        type: 'duration_seconds',
        label: 'Duration',
        options: [
          { value: '4', label: '4s' },
          { value: '6', label: '6s' },
          { value: '8', label: '8s', default: true }
        ],
        defaultValue: '8'
      }
    ],
    examples: [
      {
        title: 'Cinematic Realism (Drone Shot)',
        prompt:
          'Drone shot following a classic red convertible driven by a man along a winding coastal road at sunset, waves crashing against the rocks below. The convertible accelerates fast and the engine roars loudly.',
        imageName: 'hqdefault',
        youtubeLink: 'https://www.youtube.com/embed/SDqEif-qtyk',
        configOverrides: { resolution: '1080p', aspect_ratio: '16:9', audio_toggle: true }
      },
      {
        title: 'Dialogue & Sound Effects',
        prompt:
          "A close up of two people staring at a cryptic drawing on a wall, torchlight flickering. A man murmurs, 'This must be it. That's the secret code.' The woman looks at him and whispering excitedly, 'What did you find?'",
        imageName: 'hqdefault',
        youtubeLink: 'https://www.youtube.com/embed/rYj2zM5s95s',
        configOverrides: { resolution: '1080p', aspect_ratio: '16:9', audio_toggle: true }
      },
      {
        title: 'Cinematic Drone Shot (4K Landscape)',
        prompt:
          "A stunning drone view of the Grand Canyon during a flamboyant sunset that highlights the canyon's colors. The drone slowly flies towards the sun then accelerates, dives and flies inside the canyon.",
        imageName: 'hqdefault',
        youtubeLink: 'https://www.youtube.com/embed/4-kXyNJt_yg',
        configOverrides: { resolution: '4k', aspect_ratio: '16:9' }
      },
      {
        title: 'High-Fashion Reference',
        prompt:
          "The video opens with a medium, eye-level shot of a beautiful woman with dark hair and warm brown eyes. She wears a magnificent, high-fashion flamingo dress with layers of pink and fuchsia feathers, complemented by whimsical pink, heart-shaped sunglasses. She walks with serene confidence through the crystal-clear, shallow turquoise water of a sun-drenched lagoon. The camera slowly pulls back to a medium-wide shot, revealing the breathtaking scene as the dress's long train glides and floats gracefully on the water's surface behind her. The cinematic, dreamlike atmosphere is enhanced by the vibrant colors of the dress against the serene, minimalist landscape, capturing a moment of pure elegance and high-fashion fantasy.",
        imageName: 'hqdefault',
        youtubeLink: 'https://www.youtube.com/embed/SDqEif-qtyk',
        configOverrides: { activeMode: 'ingredients', resolution: '1080p' }
      },
      {
        title: 'Ghostly Frame Interpolation',
        prompt:
          'A cinematic, haunting video. A ghostly woman with long white hair and a flowing dress swings gently on a rope swing beneath a massive, gnarled tree in a foggy, moonlit clearing. The fog thickens and swirls around her, and she slowly fades away, vanishing completely. The empty swing is left swaying rhythmically on its own in the eerie silence.',
        imageName: 'hqdefault',
        youtubeLink: 'https://www.youtube.com/embed/Hvo89S-lgAo',
        configOverrides: { activeMode: 'frames', resolution: '1080p' }
      },
      {
        title: 'Video Extension',
        prompt:
          'Track the butterfly into the garden as it lands on an orange origami flower. A fluffy white puppy runs up and gently pats the flower.',
        imageName: 'hqdefault',
        youtubeLink: 'https://www.youtube.com/embed/eSF7-_B4ciA',
        configOverrides: { activeMode: 'ingredients', resolution: '720p' }
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
    supportsVideoExtension: true,
    capabilities: videoSharedCapabilities,
    examples: [
      {
        title: 'Portrait Product Montage',
        prompt:
          'A montage of pizza making: a chef tossing and flattening the floury dough, ladling rich red tomato sauce in a spiral, sprinkling mozzarella cheese and pepperoni, and a final shot of the bubbling golden-brown pizza, upbeat electronic music with a rhythmical beat is playing, high energy professional video.',
        imageName: 'hqdefault',
        youtubeLink: 'https://www.youtube.com/embed/rYj2zM5s95s',
        configOverrides: { resolution: '720p', aspect_ratio: '9:16', audio_toggle: true }
      }
    ],
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
    id: 'veo-3.1-lite-generate-preview',
    name: 'Veo 3.1 Lite',
    provider: 'google-veo',
    keyGroup: 'google',
    contentType: 'video',
    description: 'Fast, cost-effective video generation (max 1080p).',
    icon: 'video',
    capabilities: [
      ...videoSharedCapabilities,
      {
        type: 'resolution',
        label: 'Resolution',
        options: [
          { value: '720p', label: '720p' },
          { value: '1080p', label: '1080p', default: true }
        ],
        defaultValue: '1080p'
      },
      {
        type: 'person_generation',
        label: 'Person Generation',
        options: [
          { value: 'allow_all', label: 'Allow All', default: true },
          { value: 'allow_adult', label: 'Allow Adult' },
          { value: 'dont_allow', label: "Don't Allow" }
        ],
        defaultValue: 'allow_all'
      },
      {
        type: 'duration_seconds',
        label: 'Duration',
        options: [
          { value: '4', label: '4s' },
          { value: '6', label: '6s' },
          { value: '8', label: '8s', default: true }
        ],
        defaultValue: '8'
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
    id: 'gemini-3.1-flash-image-preview',
    name: 'Nano Banana 3.1 Flash Preview',
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
        prompt:
          'A portrait of a young woman with freckles, cinematic lighting, dramatic shadows, 85mm lens, photorealistic.',
        imageName: 'photorealistic_example',
        configOverrides: { aspect_ratio: '3:4' }
      },
      {
        title: 'Style Transfer (via Thinking)',
        prompt:
          'Generate a futuristic city. Thought process: 1. Start with a modern skyline. 2. Add flying cars and neon lights. 3. Apply a cyberpunk color palette.',
        imageName: 'city_style_transfer',
        configOverrides: { thinking_level: 'high', include_thoughts: true }
      },
      {
        title: 'Image Search Grounding',
        prompt:
          'Use image search to find accurate images of a resplendent quetzal bird. Create a beautiful 3:2 wallpaper of this bird, with a natural top to bottom gradient and minimal composition.',
        imageName: 'quetzal_bird_wallpaper',
        configOverrides: { image_search_grounding: true, aspect_ratio: '3:2' }
      },
      {
        title: 'Photorealistic Isometric',
        prompt:
          "Make a photo that is perfectly isometric. It is not a miniature, it is a captured photo that just happened to be perfectly isometric. It is a photo of a beautiful modern garden. There's a large 2 shaped pool and the words: Nano Banana 2.",
        imageName: 'isometric_garden',
        configOverrides: { aspect_ratio: '1:1' }
      }
    ]
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana 3 Pro Preview',
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
        prompt:
          'A portrait of a young woman with freckles, cinematic lighting, dramatic shadows, 85mm lens, photorealistic.',
        imageName: 'photorealistic_example',
        configOverrides: { aspect_ratio: '3:4', resolution: '4K' }
      },
      {
        title: 'Style Transfer (via Thinking)',
        prompt:
          'Generate a futuristic city. Thought process: 1. Start with a modern skyline. 2. Add flying cars and neon lights. 3. Apply a cyberpunk color palette.',
        imageName: 'city_style_transfer'
      },
      {
        title: 'Logo Design',
        prompt:
          "A minimalist logo for a coffee shop named 'Bean & Brew', featuring a simple coffee bean and a stylized cup, monochrome.",
        imageName: 'logo_example',
        configOverrides: { aspect_ratio: '1:1' }
      },
      {
        title: 'Multi-Image Composition',
        prompt:
          'A fashion shot of a model wearing [Image 1: sunglasses] and [Image 2: jacket] standing in [Image 3: street scene].',
        imageName: 'fashion_ecommerce_shot'
      },
      {
        title: 'Professional Product Shots',
        prompt:
          "A photo of a glossy magazine cover, the minimal blue cover has the large bold words Nano Banana. The text is in a serif font and fills the view. No other text. In front of the text there is a portrait of a person in a sleek and minimal dress. She is playfully holding the number 2, which is the focal point. Put the issue number and 'Feb 2026' date in the corner along with a barcode. The magazine is on a shelf against an orange plastered wall, within a designer store.",
        imageName: 'glossy_magazine_cover',
        configOverrides: { aspect_ratio: '3:4', resolution: '4K' }
      },
      {
        title: 'Search Grounded Isometric',
        prompt:
          "Present a clear, 45° top-down isometric miniature 3D cartoon scene of London, featuring its most iconic landmarks and architectural elements. Use soft, refined textures with realistic PBR materials and gentle, lifelike lighting and shadows. Integrate the current weather conditions directly into the city environment to create an immersive atmospheric mood. Use a clean, minimalistic composition with a soft, solid-colored background. At the top-center, place the title 'London' in large bold text, a prominent weather icon beneath it, then the date (small text) and temperature (medium text). All text must be centered with consistent spacing, and may subtly overlap the tops of the buildings.",
        imageName: 'london_weather_isometric',
        configOverrides: { web_search_grounding: true, aspect_ratio: '16:9', resolution: '4K' }
      },
      {
        title: 'Search Grounded Article',
        prompt:
          'Use search to find how the Gemini 3 Flash launch has been received. Use this information to write a short article about it (with headings). Return a photo of the article as it appeared in a design focused glossy magazine. It is a photo of a single folded over page, showing the article about Gemini 3 Flash. One hero photo. Headline in serif.',
        imageName: 'gemini_flash_article',
        configOverrides: { web_search_grounding: true, aspect_ratio: '3:4' }
      },
      {
        title: 'Mixed Artistic Styles',
        prompt:
          'A photo of an everyday scene at a busy cafe serving breakfast. In the foreground is an anime man with blue hair, one of the people is a pencil sketch, another is a claymation person',
        imageName: 'cafe_mixed_styles',
        configOverrides: { aspect_ratio: '16:9' }
      }
    ]
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana(2.5 Flash)',
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
    id: 'lyria-3-pro-preview',
    name: 'Lyria 3 Pro',
    provider: 'google-lyria',
    keyGroup: 'google',
    contentType: 'audio',
    description:
      'Full-length songs, timestamp control, and multimodal (image-to-audio) generation.',
    icon: 'music',
    maxImages: 10,
    capabilities: [
      {
        type: 'duration',
        label: 'Duration (Seconds)',
        min: 0,
        max: 184,
        step: 4,
        defaultValue: 0
      },
      {
        type: 'audio_format',
        label: 'Audio Format',
        options: [
          { value: 'mp3', label: 'MP3', default: true },
          { value: 'wav', label: 'WAV' }
        ],
        defaultValue: 'mp3'
      }
    ],
    examples: [
      {
        title: 'Epic Cinematic Orchestral',
        prompt:
          'An epic cinematic orchestral piece about a journey home. Starts with a solo piano intro, builds through sweeping strings, and climaxes with a massive wall of sound.',
        imageName: 'hqdefault',
        audioLink:
          'https://storage.googleapis.com/generativeai-downloads/songs/The%20Final%20Horizon.wav',
        configOverrides: { audio_format: 'wav', duration: 180 }
      },
      {
        title: 'Multi-modal Image Inspiration',
        prompt: 'An atmospheric ambient track inspired by the mood and colors in this image.',
        imageName: 'hqdefault',
        audioLink:
          'https://storage.googleapis.com/generativeai-downloads/songs/Purple%20Desert%20Haze.wav',
        configOverrides: { activeMode: 'ingredients' }
      },
      {
        title: 'Custom Lyrics (Dreamy Indie Pop)',
        prompt:
          "Create a dreamy indie pop song with the following lyrics:\n[Verse 1]\nWalking through the neon glow, city lights reflect below, every shadow tells a story, every corner, fading glory.\n[Chorus]\nWe are the echoes in the night, burning brighter than the light, hold on tight, don't let me go, we are the echoes down below.",
        imageName: 'hqdefault',
        audioLink:
          'https://storage.googleapis.com/generativeai-downloads/songs/Neon%20Echoes_Lyrics.webm'
      },
      {
        title: 'Timestamp Controlled Progression',
        prompt:
          '[0:00 - 0:10] Intro: Begin with a soft lo-fi beat and muffled vinyl crackle.\n[0:10 - 0:30] Verse 1: Add a warm Fender Rhodes piano melody and gentle vocals singing about a rainy morning.\n[0:30 - 0:50] Chorus: Full band with upbeat drums and soaring synth leads. The lyrics are hopeful and uplifting.\n[0:50 - 1:00] Outro: Fade out with the piano melody alone.',
        imageName: 'hqdefault',
        audioLink:
          'https://storage.googleapis.com/generativeai-downloads/songs/Blue%20Sky%20Breaking.wav'
      },
      {
        title: 'Cross-Language (French Pop)',
        prompt:
          'Crée une chanson pop romantique en français sur un coucher de soleil à Paris. Utilise du piano et de la guitare acoustique.',
        imageName: 'hqdefault',
        audioLink: 'https://storage.googleapis.com/generativeai-downloads/songs/Paris%20en%20Or.wav'
      },
      {
        title: 'Melancholic Jazz Fusion',
        prompt:
          'A melancholic jazz fusion track in D minor, featuring a smooth saxophone melody, walking bass line, and complex drum rhythms.',
        imageName: 'hqdefault',
        audioLink:
          'https://storage.googleapis.com/generativeai-downloads/songs/Silver%20City%20Soul.wav'
      }
    ],
    modes: [
      {
        id: 'ingredients',
        label: 'Ingredients',
        icon: 'ingredients',
        capabilities: [{ type: 'ingredients', label: 'Ingredients' }]
      }
    ]
  },
  {
    id: 'lyria-3-clip-preview',
    name: 'Lyria 3 Clip',
    provider: 'google-lyria',
    keyGroup: 'google',
    contentType: 'audio',
    description: 'Fast, fixed 30-second clips for short audio generation.',
    icon: 'music',
    capabilities: [
      {
        type: 'audio_format',
        label: 'Audio Format',
        options: [{ value: 'mp3', label: 'MP3', default: true }],
        defaultValue: 'mp3'
      }
    ],
    examples: [
      {
        title: 'Acoustic Folk',
        prompt: 'Create a 30-second cheerful acoustic folk song with guitar and harmonica.',
        imageName: 'hqdefault',
        audioLink:
          'https://storage.googleapis.com/generativeai-downloads/songs/Feels%20Sublime.wav',
        configOverrides: { audio_format: 'wav' }
      },
      {
        title: 'Instrumental Chiptune',
        prompt:
          'A bright chiptune melody in C Major, retro 8-bit video game style. Instrumental only, no vocals.',
        imageName: 'hqdefault',
        audioLink:
          'https://storage.googleapis.com/generativeai-downloads/songs/Pulse%20Wave%20Hero.wav'
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
