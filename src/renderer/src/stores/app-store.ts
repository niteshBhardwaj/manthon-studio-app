// ============================================================
// Manthan Studio — App Store (Zustand)
// Global UI state management
// ============================================================

import { create } from 'zustand'

type SidebarTab = 'create' | 'queue' | 'history' | 'assets' | 'templates' | 'settings' | 'db-explorer' | 'api-logs'
type ModalType = 'settings' | 'api-keys' | 'prompt-builder' | null
type ToastTone = 'info' | 'success' | 'error'

export interface AppToast {
  id: string
  title: string
  message?: string
  tone: ToastTone
}

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean
  activeSidebarTab: SidebarTab
  toggleSidebar: () => void
  setSidebarTab: (tab: SidebarTab) => void
  historyHasUpdates: boolean
  setHistoryHasUpdates: (value: boolean) => void

  // Modals
  activeModal: ModalType
  openModal: (modal: ModalType) => void
  closeModal: () => void

  // Command palette
  commandPaletteOpen: boolean
  toggleCommandPalette: () => void

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Toasts
  toasts: AppToast[]
  addToast: (toast: Omit<AppToast, 'id'>) => void
  removeToast: (id: string) => void

  // Preferences
  playCompletionSound: boolean
  setPlayCompletionSound: (value: boolean) => void

  // Dev
  isDev: boolean
  setIsDev: (value: boolean) => void
  isDryRun: boolean
  setIsDryRun: (value: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Sidebar
  sidebarCollapsed: false,
  activeSidebarTab: 'create',
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarTab: (tab) =>
    set((state) => ({
      activeSidebarTab: tab,
      historyHasUpdates: tab === 'history' ? false : state.historyHasUpdates
    })),
  historyHasUpdates: false,
  setHistoryHasUpdates: (value) => set({ historyHasUpdates: value }),

  // Modals
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  // Command palette
  commandPaletteOpen: false,
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Toasts
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...toast
        }
      ]
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    })),

  // Preferences
  playCompletionSound: true,
  setPlayCompletionSound: (value) => set({ playCompletionSound: value }),

  // Dev
  isDev: false,
  setIsDev: (value) => set({ isDev: value }),
  isDryRun: false,
  setIsDryRun: (value) => set({ isDryRun: value })
}))
