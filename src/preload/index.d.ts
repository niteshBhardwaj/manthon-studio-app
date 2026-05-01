// ============================================================
// Manthan Studio — Preload Type Declarations
// ============================================================

import { ElectronAPI } from '@electron-toolkit/preload'

interface ManthanAPI {
  // API Keys
  saveApiKey: (provider: string, key: string) => Promise<{ success: boolean; error?: string }>
  testApiKey: (
    provider: string,
    key: string
  ) => Promise<{ connected: boolean; message: string; model?: string }>
  getApiKeyStatus: (
    provider: string
  ) => Promise<{ connected: boolean; message: string; model?: string }>
  removeApiKey: (provider: string) => Promise<{ success: boolean }>
  saveGroupKey: (group: string, key: string) => Promise<{ success: boolean; error?: string }>
  testGroupKey: (
    group: string,
    key: string
  ) => Promise<{ connected: boolean; message: string; model?: string }>

  // Providers
  getProviders: () => Promise<
    Array<{
      id: string
      name: string
      icon: string
      modalities: string[]
      initialized: boolean
    }>
  >
  setActiveProvider: (id: string) => Promise<{ success: boolean }>
  getActiveProvider: () => Promise<string | null>
  getProviderConfig: (id: string) => Promise<{
    defaultModel: string
    models: Array<{
      id: string
      name: string
      description: string
      modality: string
      supportedInputs: string[]
      maxDuration?: number
      supportedAspectRatios?: string[]
      supportedResolutions?: string[]
    }>
  } | null>
  getEnabledModels: () => Promise<string[]>
  setEnabledModels: (ids: string[]) => Promise<{ success: boolean }>

  // Generation
  generateVideo: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  generateImage: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  generateAudio: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  pollOperation: (opId: string) => Promise<Record<string, unknown>>
  cancelOperation: (opId: string) => Promise<{ success: boolean }>

  // History
  getHistory: () => Promise<Record<string, unknown>[]>
  clearHistory: () => Promise<{ success: boolean }>

  // Templates
  getTemplates: () => Promise<Array<{ id: string; name: string; prompt: string; category: string }>>

  // Preferences
  getPreferences: () => Promise<Record<string, unknown>>
  setPreference: (key: string, value: unknown) => Promise<{ success: boolean }>

  // Files
  saveMedia: (data: string, filename: string, mimeType: string) => Promise<{ path: string }>
  openFile: () => Promise<{
    path: string
    data: string
    mimeType: string
  } | null>
  readFile: (path: string) => Promise<string>

  // Events
  onGenerationProgress: (callback: (...args: unknown[]) => void) => () => void
  onGenerationComplete: (callback: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    manthan: ManthanAPI
  }
}
