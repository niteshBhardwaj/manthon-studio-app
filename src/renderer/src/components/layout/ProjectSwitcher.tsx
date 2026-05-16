// ============================================================
// Manthan Studio - Project Switcher
// Dropdown to switch between project workspaces
// ============================================================

import { useState, useRef, useEffect, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ChevronDown, Plus, Check, Pencil, Trash2, X } from 'lucide-react'
import { useProjectStore } from '../../stores/project-store'

const PROJECT_COLORS = [
  '#6366f1',
  '#f43f5e',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#8b5cf6',
  '#f97316',
  '#64748b'
]

export function ProjectSwitcher(): JSX.Element {
  const {
    projects,
    activeProjectId,
    switchProject,
    loadProjects,
    createProject,
    updateProject,
    deleteProject
  } = useProjectStore()

  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0])
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const deleteCandidate = projects.find((project) => project.id === deleteCandidateId) ?? null

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsCreating(false)
        setEditingProjectId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (isCreating) inputRef.current?.focus()
  }, [isCreating])

  const handleCreate = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    await createProject(name, selectedColor)
    setNewName('')
    setIsCreating(false)
    setSelectedColor(PROJECT_COLORS[0])
  }

  const beginEdit = (id: string, name: string): void => {
    if (id === 'default') return
    setEditingProjectId(id)
    setEditingName(name)
  }

  const commitEdit = async (): Promise<void> => {
    if (!editingProjectId) return
    const name = editingName.trim()
    if (name) {
      await updateProject(editingProjectId, { name })
    }
    setEditingProjectId(null)
    setEditingName('')
  }

  const handleDelete = async (id: string): Promise<void> => {
    await deleteProject(id)
    setDeleteCandidateId(null)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          setIsCreating(false)
          setEditingProjectId(null)
        }}
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 hover:bg-bg-hover hover:text-text-primary"
      >
        <span
          className="h-2.5 w-2.5 rounded-full shadow-sm"
          style={{ backgroundColor: activeProject?.color ?? '#6366f1' }}
        />
        <span className="max-w-[120px] truncate">{activeProject?.name ?? 'Personal'}</span>
        <ChevronDown
          className={`h-3 w-3 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated shadow-xl"
          >
            <div className="max-h-[280px] overflow-y-auto p-1.5">
              {projects.map((project) => (
                <div key={project.id} className="group relative">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (editingProjectId) return
                      switchProject(project.id)
                      setIsOpen(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || editingProjectId) return
                      switchProject(project.id)
                      setIsOpen(false)
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-all duration-150 ${
                      project.id === activeProjectId
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    {editingProjectId === project.id ? (
                      <input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => void commitEdit()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void commitEdit()
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            setEditingProjectId(null)
                            setEditingName('')
                          }
                        }}
                        autoFocus
                        className="h-6 min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-input px-2 text-xs text-text-primary outline-none focus:border-accent/50"
                      />
                    ) : (
                      <span className="flex-1 truncate font-medium">{project.name}</span>
                    )}
                    <span className="text-[10px] text-text-muted">
                      {(project.generation_count ?? 0) + (project.asset_count ?? 0)}
                    </span>
                    {project.id === activeProjectId && (
                      <Check className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
                    )}
                  </div>

                  {project.id !== 'default' && editingProjectId !== project.id ? (
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          beginEdit(project.id, project.name)
                        }}
                        className="rounded-md p-1 text-text-muted transition-all hover:bg-white/10 hover:text-text-primary"
                        aria-label="Rename project"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleteCandidateId(project.id)
                        }}
                        className="rounded-md p-1 text-text-muted transition-all hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="border-t border-border-subtle" />

            {isCreating ? (
              <div className="p-2.5">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Project name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreate()
                    if (e.key === 'Escape') {
                      setIsCreating(false)
                      setNewName('')
                    }
                  }}
                  className="mb-2 h-7 w-full rounded-lg border border-border-subtle bg-bg-input px-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none"
                />
                <div className="mb-2 flex items-center gap-1.5">
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`h-5 w-5 rounded-full border-2 transition-all ${
                        selectedColor === color ? 'scale-110 border-text-primary' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setIsCreating(false)
                      setNewName('')
                    }}
                    className="flex-1 rounded-lg py-1.5 text-[11px] text-text-muted hover:bg-bg-hover hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleCreate()}
                    disabled={!newName.trim()}
                    className="flex-1 rounded-lg bg-accent/20 py-1.5 text-[11px] font-medium text-accent transition-all hover:bg-accent/30 disabled:opacity-40"
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                New Project
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {deleteCandidate
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6">
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="w-full max-w-md rounded-2xl border border-red-300/20 bg-bg-primary p-5 shadow-2xl"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: deleteCandidate.color }}
                    />
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">
                        Delete {deleteCandidate.name}?
                      </h2>
                      <p className="mt-1 text-xs text-text-muted">
                        {(deleteCandidate.generation_count ?? 0).toLocaleString()} generations,{' '}
                        {(deleteCandidate.asset_count ?? 0).toLocaleString()} assets will be permanently deleted.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteCandidateId(null)}
                    className="rounded-lg p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary"
                    aria-label="Close delete project dialog"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-300/15 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  This action cannot be undone.
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteCandidateId(null)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(deleteCandidate.id)}
                    className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-400"
                  >
                    Delete Project
                  </button>
                </div>
              </motion.div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
