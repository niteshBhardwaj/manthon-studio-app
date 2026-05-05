// ============================================================
// Manthan Studio — Assets Page
// Browse and manage locally saved media assets (project-scoped)
// ============================================================

import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen,
  Upload,
  Video,
  Image as ImageIcon,
  Music,
  Grid,
  List,
  Trash2,
  Download,
  X,
  FileAudio,
  FileVideo,
  FileImage,
  Clock
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '../lib/utils'
import { useProjectStore } from '../stores/project-store'

interface Asset {
  id: string
  project_id: string | null
  filename: string
  mime_type: string
  size_bytes: number
  type: 'video' | 'image' | 'audio'
  source: 'generated' | 'imported' | 'uploaded'
  storage_path: string
  tags: string[]
  created_at: number
}

type FilterType = 'all' | 'video' | 'image' | 'audio'

export function AssetsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [assets, setAssets] = useState<Asset[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { activeProjectId } = useProjectStore()

  // Load assets
  const loadAssets = useCallback(async () => {
    if (!window.manthan) return
    setLoading(true)
    try {
      const opts: Record<string, unknown> = { projectId: activeProjectId, limit: 200 }
      if (filterType !== 'all') opts.type = filterType
      const result = await window.manthan.listAssets(opts as any)
      setAssets(result.assets as Asset[])
      setTotal(result.total)
    } catch (e) {
      console.error('[AssetsPage] Failed to load:', e)
    }
    setLoading(false)
  }, [activeProjectId, filterType])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  // Import handler
  const handleImport = async () => {
    if (!window.manthan) return
    await window.manthan.importAssets(activeProjectId)
    loadAssets()
  }

  // Delete handler
  const handleDelete = async (ids: string[]) => {
    if (!window.manthan) return
    for (const id of ids) {
      await window.manthan.deleteAsset(id)
    }
    setSelectedIds(new Set())
    loadAssets()
  }

  // Toggle selection
  const toggleSelect = (id: string, event: React.MouseEvent) => {
    const next = new Set(selectedIds)
    if (event.ctrlKey || event.metaKey) {
      if (next.has(id)) next.delete(id)
      else next.add(id)
    } else {
      if (next.has(id) && next.size === 1) next.clear()
      else {
        next.clear()
        next.add(id)
      }
    }
    setSelectedIds(next)
  }

  // Format bytes
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  // Format date
  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // Type icon
  const TypeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'video': return <FileVideo className="w-4 h-4 text-blue-400" />
      case 'audio': return <FileAudio className="w-4 h-4 text-emerald-400" />
      default: return <FileImage className="w-4 h-4 text-amber-400" />
    }
  }

  // Filter counts
  const typeCounts = assets.reduce(
    (acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc },
    {} as Record<string, number>
  )

  const filterTabs: { key: FilterType; label: string; icon: any }[] = [
    { key: 'all', label: `All (${total})`, icon: FolderOpen },
    { key: 'video', label: `Video (${typeCounts.video ?? 0})`, icon: Video },
    { key: 'image', label: `Image (${typeCounts.image ?? 0})`, icon: ImageIcon },
    { key: 'audio', label: `Audio (${typeCounts.audio ?? 0})`, icon: Music }
  ]

  return (
    <div className="p-6 overflow-y-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-text-primary mb-0.5">Assets</h2>
          <p className="text-xs text-text-muted">
            {total} file{total !== 1 ? 's' : ''} in this project
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-bg-elevated rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-all',
                viewMode === 'grid'
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-all',
                viewMode === 'list'
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-all"
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 shrink-0">
        {filterTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => { setFilterType(tab.key); setSelectedIds(new Set()) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filterType === tab.key
                  ? 'bg-accent/15 text-accent border border-accent/20'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-transparent'
              )}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <EmptyState onImport={handleImport} />
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-4">
          {assets.map((asset) => {
            const isSelected = selectedIds.has(asset.id)
            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => toggleSelect(asset.id, e)}
                className={cn(
                  'group relative rounded-xl border bg-bg-elevated overflow-hidden cursor-pointer transition-all',
                  isSelected
                    ? 'border-accent ring-1 ring-accent/30'
                    : 'border-border-subtle hover:border-border-focus'
                )}
              >
                {/* Preview area */}
                <div className="aspect-square bg-bg-secondary flex items-center justify-center relative">
                  {asset.type === 'image' ? (
                    <img
                      src={`asset://${asset.storage_path}`}
                      alt={asset.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <TypeIcon type={asset.type} />
                  )}
                  {/* Source badge */}
                  <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-md bg-bg-primary/80 text-text-muted backdrop-blur-sm">
                    {asset.source}
                  </span>
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <p className="text-[11px] font-medium text-text-primary truncate">{asset.filename}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {formatSize(asset.size_bytes)} · {formatDate(asset.created_at)}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-1 pb-4">
          {assets.map((asset) => {
            const isSelected = selectedIds.has(asset.id)
            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={(e) => toggleSelect(asset.id, e)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all',
                  isSelected
                    ? 'border-accent/30 bg-accent/5'
                    : 'border-transparent hover:bg-bg-hover'
                )}
              >
                <TypeIcon type={asset.type} />
                <span className="flex-1 text-xs font-medium text-text-primary truncate">
                  {asset.filename}
                </span>
                <span className="text-[10px] text-text-muted">{formatSize(asset.size_bytes)}</span>
                <span className="text-[10px] text-text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(asset.created_at)}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">
                  {asset.source}
                </span>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-elevated/95 px-5 py-3 shadow-xl backdrop-blur-lg"
          >
            <span className="text-xs text-text-secondary font-medium">
              {selectedIds.size} selected
            </span>
            <div className="w-px h-4 bg-border-subtle" />
            <button
              onClick={() => handleDelete(Array.from(selectedIds))}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover transition-all"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ textAlign: 'center', width: '100%', maxWidth: '32rem', padding: '0 2rem' }}
      >
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{
              y: [0, -4, 0],
              boxShadow: [
                '0 0 0px oklch(0.7 0.18 250 / 0)',
                '0 0 20px oklch(0.7 0.18 250 / 0.15)',
                '0 0 0px oklch(0.7 0.18 250 / 0)'
              ]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-bg-elevated to-bg-secondary border border-border-subtle flex items-center justify-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-text-muted/5 blur-xl rounded-full" />
            <FolderOpen className="w-7 h-7 text-text-muted relative z-10" />
          </motion.div>
        </div>

        <h3 className="text-xl font-semibold text-text-primary tracking-tight mb-3">
          No assets yet
        </h3>
        <p className="text-sm text-text-muted/90 mx-auto leading-relaxed mb-10">
          Generated media will automatically appear here. You can also import your own images and
          videos.
        </p>

        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={onImport}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-hover shadow-glow transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" /> Import Media
        </motion.button>

        <div className="flex items-center justify-center gap-4 mt-8">
          {[
            { icon: Video, label: 'MP4, WebM' },
            { icon: ImageIcon, label: 'PNG, JPG, WebP' },
            { icon: Music, label: 'MP3, WAV' }
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted/60 bg-bg-secondary px-2.5 py-1 rounded-md border border-border-subtle/50"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
