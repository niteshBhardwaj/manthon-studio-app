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
  X,
  FileAudio,
  FileVideo,
  FileImage,
  Clock,
  Download,
  ZoomIn,
  ZoomOut,
  Info,
  Check
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '../lib/utils'
import { useProjectStore } from '../stores/project-store'
import { VideoPlayer } from '../components/player/VideoPlayer'
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogContainer,
  MorphingDialogClose,
  useMorphingDialog
} from '../components/motion-primitives/morphing-dialog'

interface Asset {
  id: string
  project_id: string | null
  filename: string
  mime_type: string
  size_bytes: number
  type: 'video' | 'image' | 'audio'
  source: 'generated' | 'imported' | 'uploaded'
  storage_path: string
  thumbnail_path: string | null
  metadata: Record<string, unknown>
  tags: string[]
  created_at: number
  updated_at: number
}

type FilterType = 'all' | 'video' | 'image' | 'audio'

function getAssetSrc(asset: Asset): string {
  return `asset:///${asset.storage_path.replace(/\\/g, '/')}`
}

function getAssetPoster(asset: Asset): string | undefined {
  if (!asset.thumbnail_path) return undefined
  return `asset:///${asset.thumbnail_path.replace(/\\/g, '/')}`
}

function AssetVideoSurface({
  asset,
  compact = false,
  className,
  autoPlay = false
}: {
  asset: Asset
  compact?: boolean
  className?: string
  autoPlay?: boolean
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string>(getAssetSrc(asset))

  useEffect(() => {
    let cancelled = false

    const loadVideoData = async () => {
      if (!window.manthan) return

      try {
        const base64 = await window.manthan.readAsset(asset.id)
        if (!cancelled && base64) {
          setResolvedSrc(`data:${asset.mime_type};base64,${base64}`)
        }
      } catch (error) {
        console.error('[AssetsPage] Failed to read video asset:', error)
      }
    }

    void loadVideoData()

    return () => {
      cancelled = true
    }
  }, [asset.id, asset.mime_type, asset.storage_path])

  return (
    <VideoPlayer
      src={resolvedSrc}
      mimeType={asset.mime_type}
      poster={getAssetPoster(asset)}
      compact={compact}
      autoPlay={autoPlay}
      className={className}
    />
  )
}

const MorphingMedia = ({ asset, className }: { asset: Asset; className?: string }) => {
  const { uniqueId } = useMorphingDialog()
  const src = getAssetSrc(asset)

  if (asset.type === 'image') {
    return (
      <motion.img
        src={src}
        layoutId={`dialog-media-${uniqueId}`}
        className={className}
        alt={asset.filename}
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }
  if (asset.type === 'video') {
    return (
      <motion.div layoutId={`dialog-media-${uniqueId}`} className={cn('h-full w-full', className)}>
        <AssetVideoSurface asset={asset} compact className="h-full w-full" />
      </motion.div>
    )
  }
  return (
    <motion.div
      layoutId={`dialog-media-${uniqueId}`}
      className={cn('flex items-center justify-center bg-bg-secondary', className)}
    >
      <FileAudio className="w-16 h-16 text-text-muted" />
    </motion.div>
  )
}

const AssetDetailModalContent = ({
  asset,
  onExport,
  onDelete
}: {
  asset: Asset
  onExport: () => void
  onDelete: () => void
}) => {
  const [showInfo, setShowInfo] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const { setIsOpen, uniqueId } = useMorphingDialog()
  const src = getAssetSrc(asset)

  return (
    <MorphingDialogContent className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white">
      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 h-24 pt-4 flex items-start justify-between px-6 z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <MorphingDialogClose className="p-2 hover:bg-white/10 rounded-full transition-colors pointer-events-auto mt-2">
          <X className="w-6 h-6" />
        </MorphingDialogClose>

        <div className="flex items-center gap-2 pointer-events-auto mt-2">
          {asset.type === 'image' && (
            <button 
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              onClick={() => setZoomScale(s => s === 1 ? 2 : 1)}
            >
              {zoomScale === 1 ? <ZoomIn className="w-5 h-5" /> : <ZoomOut className="w-5 h-5" />}
            </button>
          )}
          <button
            className={cn(
              'p-2 rounded-full transition-colors',
              showInfo ? 'bg-accent text-white' : 'hover:bg-white/10'
            )}
            onClick={() => setShowInfo(!showInfo)}
          >
            <Info className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full" onClick={onExport}>
            <Download className="w-5 h-5" />
          </button>
          <button
            className="p-2 hover:bg-white/10 rounded-full text-white/80 hover:text-red-400"
            onClick={() => {
              setIsOpen(false)
              onDelete()
            }}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden w-full h-full relative z-40">
        {/* Main Preview */}
        <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden">
          {asset.type === 'image' && (
            <motion.div 
              className="w-full h-full flex items-center justify-center cursor-zoom-in"
              onClick={() => setZoomScale(s => s === 1 ? 2 : 1)}
              style={{ cursor: zoomScale === 1 ? 'zoom-in' : 'zoom-out' }}
            >
              <motion.img
                src={src}
                layoutId={`dialog-media-${uniqueId}`}
                className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out origin-center"
                style={{ transform: `scale(${zoomScale})` }}
              />
            </motion.div>
          )}
          {asset.type === 'video' && (
            <motion.div
              layoutId={`dialog-media-${uniqueId}`}
              className="flex h-full w-full items-center justify-center"
            >
              <AssetVideoSurface asset={asset} autoPlay className="aspect-video w-full max-w-5xl" />
            </motion.div>
          )}
          {asset.type === 'audio' && (
            <motion.div
              layoutId={`dialog-media-${uniqueId}`}
              className="flex flex-col items-center gap-6"
            >
              <Music className="w-24 h-24 text-text-muted opacity-50" />
              <audio src={src} controls className="w-80" />
            </motion.div>
          )}
        </div>

        {/* Info Sidebar */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-white/10 bg-black/40 backdrop-blur-xl flex flex-col shrink-0 overflow-y-auto"
            >
              <div className="p-6 pt-24 flex flex-col gap-6 w-[360px]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Info</h3>
                  <button
                    className="p-1 hover:bg-white/10 rounded-full"
                    onClick={() => setShowInfo(false)}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <input
                  placeholder="Add a description"
                  className="bg-transparent border-b border-white/20 pb-2 focus:outline-none focus:border-accent text-sm"
                />

                <div className="flex flex-col gap-6 mt-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Details
                  </h4>

                  <div className="flex gap-4">
                    <Clock className="w-5 h-5 text-text-muted shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {new Date(asset.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(asset.created_at).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <ImageIcon className="w-5 h-5 text-text-muted shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm break-all">{asset.filename}</span>
                      <span className="text-xs text-text-muted">
                        {(asset.size_bytes / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Upload className="w-5 h-5 text-text-muted shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm capitalize">{asset.source}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MorphingDialogContent>
  )
}

export function AssetsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [assets, setAssets] = useState<Asset[]>([])
  const [total, setTotal] = useState(0)
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({
    video: 0,
    image: 0,
    audio: 0
  })
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null)
  const { activeProjectId } = useProjectStore()

  // Load assets
  const loadAssets = useCallback(async () => {
    if (!window.manthan) return
    setLoading(true)
    try {
      const opts = { projectId: activeProjectId, limit: 200 } as any
      if (filterType !== 'all') opts.type = filterType
      const result = await window.manthan.listAssets(opts)
      setAssets(result.assets as Asset[])
      
      // If we are showing 'all', the total returned is the project total
      // Otherwise, we use the typeCounts for individual labels
      if (filterType === 'all') {
        setTotal(result.total)
      }
      
      if (result.typeCounts) {
        setTypeCounts(result.typeCounts)
        // Ensure total is project-wide regardless of current filter
        const projectTotal = Object.values(result.typeCounts).reduce((a, b) => a + b, 0)
        setTotal(projectTotal)
      }
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

  // Export handler
  const handleExport = async (ids: string[]) => {
    if (!window.manthan) return
    const result = await window.manthan.exportAssets(ids)
    if (result.success) {
      setSelectedIds(new Set())
    }
  }

  // Toggle selection
  const toggleSelect = (id: string, event: React.MouseEvent) => {
    const next = new Set(selectedIds)
    if (event.ctrlKey || event.metaKey || selectedIds.size > 0) {
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
      case 'video':
        return <FileVideo className="w-4 h-4 text-blue-400" />
      case 'audio':
        return <FileAudio className="w-4 h-4 text-emerald-400" />
      default:
        return <FileImage className="w-4 h-4 text-amber-400" />
    }
  }

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
              onClick={() => {
                setFilterType(tab.key)
                setSelectedIds(new Set())
              }}
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
            const isPreviewOpen = previewAssetId === asset.id

            return (
              <MorphingDialog
                key={asset.id}
                isOpen={isPreviewOpen}
                setIsOpen={(val) => setPreviewAssetId(val ? asset.id : null)}
                transition={{ duration: 0.3, type: 'spring', bounce: 0.2 }}
              >
                <MorphingDialogTrigger
                  className={cn(
                    'group relative rounded-xl border bg-bg-elevated overflow-hidden cursor-pointer transition-all w-full text-left aspect-square flex flex-col',
                    isSelected
                      ? 'border-accent ring-1 ring-accent/30'
                      : 'border-border-subtle hover:border-border-focus'
                  )}
                >
                  {/* Selection Overlay Interceptor */}
                  {selectedIds.size > 0 && (
                    <div
                      className="absolute inset-0 z-10"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(asset.id, e)
                      }}
                    />
                  )}

                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelect(asset.id, e)
                    }}
                    className={cn(
                      'absolute top-2 left-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-all',
                      isSelected
                        ? 'bg-accent border-accent text-white'
                        : 'bg-black/20 border-white/40 text-transparent opacity-0 group-hover:opacity-100 hover:bg-black/40'
                    )}
                  >
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </button>

                  {/* Zoom Icon (only in selection mode) */}
                  {selectedIds.size > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewAssetId(asset.id)
                      }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 hover:scale-110"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  )}

                  {/* Preview area */}
                  <div className="flex-1 bg-bg-secondary flex items-center justify-center relative overflow-hidden">
                    <MorphingMedia asset={asset} className="w-full h-full object-cover" />

                    {/* Source badge */}
                    <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-md bg-bg-primary/80 text-text-muted backdrop-blur-sm z-0">
                      {asset.source}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-2.5 bg-bg-elevated shrink-0 z-0 relative">
                    <p className="text-[11px] font-medium text-text-primary truncate">
                      {asset.filename}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {formatSize(asset.size_bytes)} · {formatDate(asset.created_at)}
                    </p>
                  </div>
                </MorphingDialogTrigger>

                <MorphingDialogContainer>
                  <AssetDetailModalContent
                    asset={asset}
                    onExport={() => handleExport([asset.id])}
                    onDelete={() => handleDelete([asset.id])}
                  />
                </MorphingDialogContainer>
              </MorphingDialog>
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
                  isSelected ? 'border-accent/30 bg-accent/5' : 'border-transparent hover:bg-bg-hover'
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
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setPreviewAssetId(asset.id)
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-all hover:bg-bg-hover hover:text-text-secondary"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
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
              onClick={() => handleExport(Array.from(selectedIds))}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
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
