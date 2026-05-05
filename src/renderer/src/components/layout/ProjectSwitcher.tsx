// ============================================================
// Manthan Studio — Project Switcher
// Dropdown to switch between project workspaces
// ============================================================

import { useState, useRef, useEffect, type JSX } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus, Check, Trash2 } from 'lucide-react'
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
  const { projects, activeProjectId, switchProject, loadProjects, createProject, deleteProject } =
    useProjectStore()

  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId)

  // Load projects on mount
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsCreating(false)
        setConfirmDelete(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus input when creating
  useEffect(() => {
    if (isCreating) inputRef.current?.focus()
  }, [isCreating])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    await createProject(name, selectedColor)
    setNewName('')
    setIsCreating(false)
    setSelectedColor(PROJECT_COLORS[0])
  }

  const handleDelete = async (id: string) => {
    await deleteProject(id)
    setConfirmDelete(null)
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          setIsCreating(false)
          setConfirmDelete(null)
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

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated shadow-xl backdrop-blur-lg"
          >
            {/* Project List */}
            <div className="max-h-[280px] overflow-y-auto p-1.5">
              {projects.map((project) => (
                <div key={project.id} className="group relative">
                  <button
                    onClick={() => {
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
                    <span className="flex-1 truncate font-medium">{project.name}</span>
                    <span className="text-[10px] text-text-muted">
                      {(project.generation_count ?? 0) + (project.asset_count ?? 0)}
                    </span>
                    {project.id === activeProjectId && (
                      <Check className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
                    )}
                  </button>

                  {/* Delete button — only on hover, not for default project */}
                  {project.id !== 'default' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDelete(confirmDelete === project.id ? null : project.id)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}

                  {/* Delete Confirmation */}
                  {confirmDelete === project.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mx-2 mb-1 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-1.5"
                    >
                      <span className="text-[10px] text-red-400">Delete this project?</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
                        >
                          No
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/30"
                        >
                          Yes
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-border-subtle" />

            {/* Create New */}
            {isCreating ? (
              <div className="p-2.5">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Project name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') {
                      setIsCreating(false)
                      setNewName('')
                    }
                  }}
                  className="mb-2 h-7 w-full rounded-lg border border-border-subtle bg-bg-input px-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none"
                />
                {/* Color picker */}
                <div className="mb-2 flex items-center gap-1.5">
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`h-5 w-5 rounded-full border-2 transition-all ${
                        selectedColor === color
                          ? 'border-text-primary scale-110'
                          : 'border-transparent'
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
                    onClick={handleCreate}
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
    </div>
  )
}
