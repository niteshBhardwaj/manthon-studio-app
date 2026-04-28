// ============================================================
// Manthan Studio — Generation Store (Zustand)
// Generation queue, active operations, and results
// ============================================================

import { create } from 'zustand'

export type GenerationStatus = 'idle' | 'queued' | 'generating' | 'completed' | 'failed'
export type GenerationType = 'video' | 'image' | 'audio'
export type AspectRatio = '16:9' | '9:16' | '1:1'
export type Resolution = '720p' | '1080p' | '4k'

export interface GenerationJob {
  id: string
  type: GenerationType
  status: GenerationStatus
  prompt: string
  negativePrompt?: string
  provider: string
  model: string
  config: {
    aspectRatio: AspectRatio
    resolution: Resolution
    duration?: number
    enableAudio?: boolean
  }
  // Inputs
  image?: { data: string; mimeType: string }
  lastFrame?: { data: string; mimeType: string }
  referenceImages?: Array<{ data: string; mimeType: string }>
  // Result
  result?: {
    type: GenerationType
    data: string
    mimeType: string
    uri?: string
  }
  error?: string
  progress: number
  startedAt: number
  completedAt?: number
}

interface GenerationState {
  // Current prompt state
  prompt: string
  negativePrompt: string
  aspectRatio: AspectRatio
  resolution: Resolution
  duration: number
  enableAudio: boolean
  selectedModel: string

  // Frame inputs
  startFrame: { data: string; mimeType: string } | null
  endFrame: { data: string; mimeType: string } | null
  referenceImages: Array<{ data: string; mimeType: string }>

  // Jobs
  jobs: GenerationJob[]
  activeJobId: string | null

  // Panel state
  panelExpanded: boolean
  generationMode: 'text' | 'image' | 'frames' | 'extend'

  // Actions
  setPrompt: (prompt: string) => void
  setNegativePrompt: (prompt: string) => void
  setAspectRatio: (ratio: AspectRatio) => void
  setResolution: (res: Resolution) => void
  setDuration: (duration: number) => void
  setEnableAudio: (enabled: boolean) => void
  setSelectedModel: (model: string) => void

  setStartFrame: (frame: { data: string; mimeType: string } | null) => void
  setEndFrame: (frame: { data: string; mimeType: string } | null) => void
  addReferenceImage: (img: { data: string; mimeType: string }) => void
  removeReferenceImage: (index: number) => void
  clearReferenceImages: () => void

  setPanelExpanded: (expanded: boolean) => void
  setGenerationMode: (mode: 'text' | 'image' | 'frames' | 'extend') => void

  addJob: (job: GenerationJob) => void
  updateJob: (id: string, updates: Partial<GenerationJob>) => void
  removeJob: (id: string) => void
  setActiveJob: (id: string | null) => void
  clearCompleted: () => void
}

export const useGenerationStore = create<GenerationState>((set) => ({
  // Current prompt state
  prompt: '',
  negativePrompt: '',
  aspectRatio: '16:9',
  resolution: '1080p',
  duration: 8,
  enableAudio: true,
  selectedModel: 'veo-3.1-generate-preview',

  // Frame inputs
  startFrame: null,
  endFrame: null,
  referenceImages: [],

  // Jobs
  jobs: [],
  activeJobId: null,

  // Panel state
  panelExpanded: false,
  generationMode: 'text',

  // Actions
  setPrompt: (prompt) => set({ prompt }),
  setNegativePrompt: (prompt) => set({ negativePrompt: prompt }),
  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
  setResolution: (res) => set({ resolution: res }),
  setDuration: (duration) => set({ duration }),
  setEnableAudio: (enabled) => set({ enableAudio: enabled }),
  setSelectedModel: (model) => set({ selectedModel: model }),

  setStartFrame: (frame) => set({ startFrame: frame }),
  setEndFrame: (frame) => set({ endFrame: frame }),
  addReferenceImage: (img) =>
    set((s) => ({
      referenceImages: s.referenceImages.length < 3 ? [...s.referenceImages, img] : s.referenceImages
    })),
  removeReferenceImage: (index) =>
    set((s) => ({
      referenceImages: s.referenceImages.filter((_, i) => i !== index)
    })),
  clearReferenceImages: () => set({ referenceImages: [] }),

  setPanelExpanded: (expanded) => set({ panelExpanded: expanded }),
  setGenerationMode: (mode) => set({ generationMode: mode }),

  addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs], activeJobId: job.id })),
  updateJob: (id, updates) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j))
    })),
  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
  setActiveJob: (id) => set({ activeJobId: id }),
  clearCompleted: () =>
    set((s) => ({
      jobs: s.jobs.filter((j) => j.status !== 'completed' && j.status !== 'failed')
    }))
}))
