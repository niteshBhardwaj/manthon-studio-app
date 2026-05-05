// ============================================================
// Manthan Studio — Project Store (Zustand)
// Project workspace state management
// ============================================================

import { create } from 'zustand'

export interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string
  created_at: number
  updated_at: number
  archived: number
  generation_count?: number
  asset_count?: number
}

interface ProjectState {
  projects: Project[]
  activeProjectId: string
  loading: boolean

  // Actions
  loadProjects: () => Promise<void>
  createProject: (name: string, color?: string) => Promise<Project | null>
  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'color' | 'icon'>>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  switchProject: (id: string) => void
  getActiveProject: () => Project | undefined
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: 'default',
  loading: false,

  loadProjects: async () => {
    if (!window.manthan) return
    set({ loading: true })
    try {
      const projects = (await window.manthan.listProjects()) as Project[]
      set({ projects, loading: false })
    } catch (e) {
      console.error('[ProjectStore] Failed to load projects:', e)
      set({ loading: false })
    }
  },

  createProject: async (name: string, color?: string) => {
    if (!window.manthan) return null
    try {
      const project = (await window.manthan.createProject({ name, color })) as Project
      await get().loadProjects()
      set({ activeProjectId: project.id })
      return project
    } catch (e) {
      console.error('[ProjectStore] Failed to create project:', e)
      return null
    }
  },

  updateProject: async (id, updates) => {
    if (!window.manthan) return
    try {
      await window.manthan.updateProject(id, updates)
      await get().loadProjects()
    } catch (e) {
      console.error('[ProjectStore] Failed to update project:', e)
    }
  },

  deleteProject: async (id) => {
    if (!window.manthan || id === 'default') return
    try {
      await window.manthan.deleteProject(id)
      if (get().activeProjectId === id) {
        set({ activeProjectId: 'default' })
      }
      await get().loadProjects()
    } catch (e) {
      console.error('[ProjectStore] Failed to delete project:', e)
    }
  },

  switchProject: (id) => {
    set({ activeProjectId: id })
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get()
    return projects.find((p) => p.id === activeProjectId)
  }
}))
