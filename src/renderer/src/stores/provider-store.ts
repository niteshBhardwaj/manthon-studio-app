// ============================================================
// Manthan Studio — Provider Store (Zustand)
// Provider configuration and connection state
// ============================================================

import { create } from 'zustand'

interface ProviderInfo {
  id: string
  name: string
  icon: string
  modalities: string[]
  initialized: boolean
  connectionStatus: 'unknown' | 'connected' | 'failed' | 'testing'
  message?: string
}

interface ProviderState {
  providers: ProviderInfo[]
  activeProviderId: string | null
  loading: boolean

  setProviders: (providers: ProviderInfo[]) => void
  setActiveProvider: (id: string) => void
  updateProviderStatus: (
    id: string,
    status: ProviderInfo['connectionStatus'],
    message?: string
  ) => void
  setLoading: (loading: boolean) => void

  // Initialization
  fetchProviders: () => Promise<void>
}

export const useProviderStore = create<ProviderState>((set) => ({
  providers: [],
  activeProviderId: null,
  loading: true,

  setProviders: (providers) => set({ providers }),
  setActiveProvider: (id) => set({ activeProviderId: id }),
  updateProviderStatus: (id, status, message) =>
    set((s) => ({
      providers: s.providers.map((p) =>
        p.id === id ? { ...p, connectionStatus: status, message } : p
      )
    })),
  setLoading: (loading) => set({ loading }),

  fetchProviders: async () => {
    try {
      set({ loading: true })

      // Safety guard: window.manthan only exists inside Electron
      if (typeof window === 'undefined' || !window.manthan) {
        set({
          providers: [
            {
              id: 'google-veo',
              name: 'Google Veo 3.1',
              icon: 'video',
              modalities: ['video'],
              initialized: false,
              connectionStatus: 'unknown'
            },
            {
              id: 'google-imagen',
              name: 'Nano Banana',
              icon: 'image',
              modalities: ['image'],
              initialized: false,
              connectionStatus: 'unknown'
            },
            {
              id: 'google-lyria',
              name: 'Lyria 3',
              icon: 'music',
              modalities: ['audio'],
              initialized: false,
              connectionStatus: 'unknown'
            }
          ],
          activeProviderId: null,
          loading: false
        })
        return
      }

      const providers = await window.manthan.getProviders()
      const activeId = await window.manthan.getActiveProvider()

      set({
        providers: providers.map((p) => ({
          ...p,
          connectionStatus: p.initialized ? 'connected' : ('unknown' as const)
        })),
        activeProviderId: activeId,
        loading: false
      })
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      set({ loading: false })
    }
  }
}))
