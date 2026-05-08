// ============================================================
// Manthan Studio — Generation Store (Zustand)
// Generation queue, active operations, and results
// ============================================================

import { create } from 'zustand'
import {
  getDefaultCapabilityValues,
  getDefaultModel,
  getModelById,
  type CapabilityValue,
  type ContentType
} from '../lib/model-capabilities'

export type GenerationStatus = 'idle' | 'queued' | 'generating' | 'completed' | 'failed'
export type GenerationType = ContentType
export type BinaryInput = { data: string; mimeType: string; metadata?: Record<string, unknown> }

const defaultImageModel = getDefaultModel('image')

export interface GenerationJob {
  id: string
  groupId?: string
  type: GenerationType
  status: GenerationStatus
  prompt: string
  negativePrompt?: string
  provider: string
  model: string
  config: {
    contentType: ContentType
    activeMode: string | null
    batchCount: number
    capabilityValues: Record<string, CapabilityValue>
  }
  // Inputs
  image?: BinaryInput
  lastFrame?: BinaryInput
  referenceImages?: Array<BinaryInput>
  // Result
  result?: {
    type: GenerationType
    data: string
    mimeType: string
    uri?: string
    assetId?: string
    thumbnailPath?: string | null
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
  contentType: ContentType
  capabilityValues: Record<string, CapabilityValue>
  activeMode: string | null
  batchCount: number
  selectedModel: string
  extendingJobId: string | null

  // Frame inputs
  startFrame: BinaryInput | null
  endFrame: BinaryInput | null
  videoInput: BinaryInput | null
  referenceImages: Array<BinaryInput>

  // Jobs
  jobs: GenerationJob[]
  activeJobId: string | null

  // Panel state
  panelExpanded: boolean

  // Actions
  setPrompt: (prompt: string) => void
  setNegativePrompt: (prompt: string) => void
  setContentType: (type: ContentType, enabledModelIds?: Iterable<string>) => void
  setCapabilityValue: (key: string, value: CapabilityValue) => void
  setActiveMode: (mode: string | null) => void
  setBatchCount: (batchCount: number) => void
  setSelectedModel: (model: string) => void
  setExtendingJobId: (jobId: string | null) => void

  setStartFrame: (frame: BinaryInput | null) => void
  setEndFrame: (frame: BinaryInput | null) => void
  setVideoInput: (video: BinaryInput | null) => void
  addReferenceImage: (img: BinaryInput) => void
  removeReferenceImage: (index: number) => void
  clearReferenceImages: () => void
  clearPromptMedia: () => void
  resetPromptAfterSubmit: () => void
  loadJobIntoPrompt: (job: GenerationJob, options?: { extend?: boolean; prompt?: string }) => void

  setPanelExpanded: (expanded: boolean) => void

  addJob: (job: GenerationJob) => void
  addJobs: (jobs: GenerationJob[]) => void
  updateJob: (id: string, updates: Partial<GenerationJob>) => void
  removeJob: (id: string) => void
  setActiveJob: (id: string | null) => void
  clearCompleted: () => void
}

export const useGenerationStore = create<GenerationState>((set) => ({
  // Current prompt state
  prompt: '',
  negativePrompt: '',
  contentType: defaultImageModel?.contentType ?? 'image',
  capabilityValues: defaultImageModel ? getDefaultCapabilityValues(defaultImageModel) : {},
  activeMode: defaultImageModel?.modes?.[0]?.id ?? null,
  batchCount: Number(
    getDefaultCapabilityValues(defaultImageModel ?? getModelById('gemini-3-pro-image-preview')!)
      .batch_count ?? 1
  ),
  selectedModel: defaultImageModel?.id ?? 'gemini-3-pro-image-preview',
  extendingJobId: null,

  // Frame inputs
  startFrame: null,
  endFrame: null,
  videoInput: null,
  referenceImages: [],

  // Jobs
  jobs: [],
  activeJobId: null,

  // Panel state
  panelExpanded: false,

  // Actions
  setPrompt: (prompt) => set({ prompt }),
  setNegativePrompt: (prompt) => set({ negativePrompt: prompt }),
  setContentType: (contentType, enabledModelIds) =>
    set((state) => {
      const model = getDefaultModel(contentType, enabledModelIds) ?? getDefaultModel(contentType)
      if (!model) return { contentType }

      const nextCapabilityValues = getDefaultCapabilityValues(model)
      const batchCount = Number(nextCapabilityValues.batch_count ?? 1)

      return {
        ...state,
        contentType,
        selectedModel: model.id,
        capabilityValues: nextCapabilityValues,
        activeMode: model.modes?.[0]?.id ?? null,
        batchCount
      }
    }),
  setCapabilityValue: (key, value) =>
    set((state) => ({
      capabilityValues: {
        ...state.capabilityValues,
        [key]: value
      }
    })),
  setActiveMode: (activeMode) => set({ activeMode }),
  setBatchCount: (batchCount) =>
    set((state) => ({
      batchCount,
      capabilityValues: {
        ...state.capabilityValues,
        batch_count: batchCount
      }
    })),
  setSelectedModel: (modelId) =>
    set((state) => {
      const model = getModelById(modelId)
      if (!model) return state

      const nextCapabilityValues = {
        ...getDefaultCapabilityValues(model),
        ...Object.fromEntries(
          Object.entries(state.capabilityValues).filter(([key]) =>
            [
              ...model.capabilities,
              ...(model.modes?.flatMap((mode) => mode.capabilities) ?? [])
            ].some((capability) => capability.type === key)
          )
        )
      }

      const batchCount = Number(nextCapabilityValues.batch_count ?? 1)

      return {
        ...state,
        contentType: model.contentType,
        selectedModel: model.id,
        capabilityValues: nextCapabilityValues,
        activeMode: model.modes?.some((mode) => mode.id === state.activeMode)
          ? state.activeMode
          : (model.modes?.[0]?.id ?? null),
        batchCount
      }
    }),
  setExtendingJobId: (extendingJobId) => set({ extendingJobId }),

  setStartFrame: (frame) => set({ startFrame: frame }),
  setEndFrame: (frame) => set({ endFrame: frame }),
  setVideoInput: (video) => set({ videoInput: video }),
  addReferenceImage: (img) =>
    set((s) => ({
      referenceImages: [...s.referenceImages, img]
    })),
  removeReferenceImage: (index) =>
    set((s) => ({
      referenceImages: s.referenceImages.filter((_, i) => i !== index)
    })),
  clearReferenceImages: () => set({ referenceImages: [] }),
  clearPromptMedia: () =>
    set({
      startFrame: null,
      endFrame: null,
      videoInput: null,
      referenceImages: []
    }),
  resetPromptAfterSubmit: () =>
    set({
      prompt: '',
      negativePrompt: '',
      startFrame: null,
      endFrame: null,
      videoInput: null,
      referenceImages: [],
      extendingJobId: null
    }),
  loadJobIntoPrompt: (job, options) =>
    set(() => ({
      prompt: options?.prompt ?? (options?.extend ? '' : job.prompt),
      negativePrompt: options?.extend ? '' : (job.negativePrompt ?? ''),
      contentType: job.config.contentType,
      selectedModel: job.model,
      capabilityValues: {
        ...job.config.capabilityValues,
        batch_count: job.config.batchCount
      },
      activeMode: options?.extend ? 'frames' : job.config.activeMode,
      batchCount: job.config.batchCount,
      startFrame: options?.extend ? null : (job.image ?? null),
      endFrame: job.lastFrame ?? null,
      videoInput: null,
      referenceImages: options?.extend ? [] : (job.referenceImages ?? []),
      extendingJobId: options?.extend ? job.id : null
    })),

  setPanelExpanded: (expanded) => set({ panelExpanded: expanded }),

  addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs.filter(j => j.id !== job.id)], activeJobId: job.id })),
  addJobs: (newJobs) =>
    set((s) => {
      const existingIds = new Set(s.jobs.map((j) => j.id))
      const uniqueNewJobs = newJobs.filter((j) => !existingIds.has(j.id))
      return {
        jobs: [...uniqueNewJobs, ...s.jobs]
      }
    }),
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
