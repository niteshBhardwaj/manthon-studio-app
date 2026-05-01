import { create } from 'zustand'
import {
  getModelsByContentType,
  MODEL_REGISTRY,
  type ContentType,
  type ModelDescriptor
} from '../lib/model-capabilities'

interface ModelState {
  enabledModelIds: Set<string>
  loading: boolean

  toggleModel: (modelId: string) => Promise<void>
  enableModel: (modelId: string) => Promise<void>
  disableModel: (modelId: string) => Promise<void>
  isModelEnabled: (modelId: string) => boolean
  getEnabledModels: () => ModelDescriptor[]
  getEnabledModelsByType: (type: ContentType) => ModelDescriptor[]
  setEnabledModels: (ids: Iterable<string>) => void
  loadEnabledModels: () => Promise<void>
  saveEnabledModels: () => Promise<void>
}

const defaultEnabledModelIds = MODEL_REGISTRY.map((model) => model.id)

export const useModelStore = create<ModelState>((set, get) => ({
  enabledModelIds: new Set(defaultEnabledModelIds),
  loading: false,

  toggleModel: async (modelId) => {
    const nextIds = new Set(get().enabledModelIds)
    if (nextIds.has(modelId)) {
      nextIds.delete(modelId)
    } else {
      nextIds.add(modelId)
    }

    set({ enabledModelIds: nextIds })
    await get().saveEnabledModels()
  },
  enableModel: async (modelId) => {
    const nextIds = new Set(get().enabledModelIds)
    nextIds.add(modelId)
    set({ enabledModelIds: nextIds })
    await get().saveEnabledModels()
  },
  disableModel: async (modelId) => {
    const nextIds = new Set(get().enabledModelIds)
    nextIds.delete(modelId)
    set({ enabledModelIds: nextIds })
    await get().saveEnabledModels()
  },
  isModelEnabled: (modelId) => get().enabledModelIds.has(modelId),
  getEnabledModels: () => MODEL_REGISTRY.filter((model) => get().enabledModelIds.has(model.id)),
  getEnabledModelsByType: (type) => getModelsByContentType(type, get().enabledModelIds),
  setEnabledModels: (ids) => set({ enabledModelIds: new Set(ids) }),
  loadEnabledModels: async () => {
    if (typeof window === 'undefined' || !window.manthan?.getEnabledModels) {
      set({ enabledModelIds: new Set(defaultEnabledModelIds), loading: false })
      return
    }

    try {
      set({ loading: true })
      const ids = await window.manthan.getEnabledModels()
      set({
        enabledModelIds: new Set(ids.length > 0 ? ids : defaultEnabledModelIds),
        loading: false
      })
    } catch (error) {
      console.error('Failed to load enabled models:', error)
      set({ enabledModelIds: new Set(defaultEnabledModelIds), loading: false })
    }
  },
  saveEnabledModels: async () => {
    if (typeof window === 'undefined' || !window.manthan?.setEnabledModels) {
      return
    }

    try {
      await window.manthan.setEnabledModels(Array.from(get().enabledModelIds))
    } catch (error) {
      console.error('Failed to save enabled models:', error)
    }
  }
}))
