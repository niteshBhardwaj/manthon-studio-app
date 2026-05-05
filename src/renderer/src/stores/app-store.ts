// ============================================================
// Manthan Studio — App Store (Zustand)
// Global UI state management
// ============================================================

import { create } from 'zustand'

type SidebarTab = 'create' | 'queue' | 'history' | 'assets' | 'templates' | 'settings'
type ModalType = 'settings' | 'api-keys' | 'prompt-builder' | null

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean
  activeSidebarTab: SidebarTab
  toggleSidebar: () => void
  setSidebarTab: (tab: SidebarTab) => void

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
}

export const useAppStore = create<AppState>((set) => ({
  // Sidebar
  sidebarCollapsed: false,
  activeSidebarTab: 'create',
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  // Modals
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  // Command palette
  commandPaletteOpen: false,
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query })
}))
