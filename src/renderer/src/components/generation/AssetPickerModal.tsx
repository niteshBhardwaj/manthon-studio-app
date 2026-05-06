import { type JSX, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Upload,
  Check,
  X,
  File as FileIcon
} from 'lucide-react'
import {
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogClose,
  useMorphingDialog
} from '../motion-primitives/morphing-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { useAssetPicker } from '../../hooks/useAssetPicker'
import { useProjectStore } from '../../stores/project-store'
import { cn } from '../../lib/utils'
import type { AssetInfo } from '../../../../preload/index.d'

interface AssetPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (assets: AssetInfo[]) => void
  currentContentType: string
}

export function AssetPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentContentType
}: AssetPickerModalProps): JSX.Element {
  const { projects } = useProjectStore()
  const {
    assets,
    loading,
    selectedIds,
    previewAsset,
    projectFilter,
    typeFilter,
    searchQuery,
    sortBy,
    setProjectFilter,
    setTypeFilter,
    setSearchQuery,
    setSortBy,
    toggleSelect,
    setPreview,
    getSelectedAssets,
    addAsset
  } = useAssetPicker()

  const [searchInput, setSearchInput] = useState(searchQuery)
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchInput, setSearchQuery])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [currentContentType, isOpen])

  const { setIsOpen: setMorphingOpen } = useMorphingDialog()

  useEffect(() => {
    // Keep internal MorphingDialog open state in sync if controlled via props
    // We actually don't need this if we just use onClose from props, or if we use setMorphingOpen(false) to close.
    // When onClose is called, the parent sets isAssetPickerOpen to false, which propagates down via MorphingDialog's controlled state.
  }, [isOpen])

  const handleClose = () => {
    setMorphingOpen(false)
    onClose()
  }

  const handleUpload = async () => {
    if (!window.manthan) return
    const file = await window.manthan.openFile()
    if (!file) return

    try {
      const savedAsset = await window.manthan.saveAsset({
        base64Data: file.data,
        mimeType: file.mimeType,
        source: 'uploaded',
        projectId: projectFilter === 'all' ? undefined : projectFilter
      })
      addAsset(savedAsset)
    } catch (e) {
      console.error('Failed to save uploaded asset:', e)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // If we are not open, we still render MorphingDialogContainer because AnimatePresence is inside it.
  return (
    <MorphingDialogContainer>
      {isOpen && (
        <MorphingDialogContent
          className="flex h-[80vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-bg-primary shadow-[0_16px_64px_rgba(0,0,0,0.5)] border border-white/10"
        >
          {/* Header */}
          <div className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 px-4 bg-bg-elevated">
            <div className="w-[180px]">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="bg-black/20 border-white/10 text-white">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search for Assets..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-10 w-full rounded-lg bg-black/20 pl-10 pr-4 text-base text-text-primary placeholder:text-text-muted border border-white/10 focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="flex items-center gap-1 ml-auto">
              {['all', 'image', 'audio', 'video'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
                    typeFilter === type ? "bg-white/10 text-white" : "text-text-secondary hover:text-white hover:bg-white/5"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="w-[140px]">
              <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                <SelectTrigger className="bg-black/20 border-white/10 text-white">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="used">Most Used</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <MorphingDialogClose onClick={handleClose} className="p-1.5 text-text-muted hover:text-white rounded-md hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </MorphingDialogClose>
          </div>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Panel: Grid */}
              <div className="w-[40%] flex flex-col border-r border-white/10 bg-bg-primary">
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {loading ? (
                    <div className="flex h-full items-center justify-center text-text-muted">Loading assets...</div>
                  ) : assets.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-text-muted text-sm">No assets found</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {assets.map((asset, i) => (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          key={asset.id}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                              toggleSelect(asset.id, true)
                            } else {
                              toggleSelect(asset.id, false)
                              setPreview(asset)
                            }
                          }}
                          className={cn(
                            "group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-all",
                            selectedIds.has(asset.id)
                              ? "border-primary"
                              : previewAsset?.id === asset.id ? "border-white/30" : "border-transparent hover:border-white/10"
                          )}
                        >
                          {asset.type === 'image' || asset.thumbnail_path ? (
                            <img
                              src={`asset:///${(asset.thumbnail_path || asset.storage_path).replace(/\\/g, '/')}`}
                              alt={asset.filename}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-black/40">
                              {asset.type === 'video' ? <VideoIcon className="h-8 w-8 text-text-muted" /> :
                               asset.type === 'audio' ? <Music className="h-8 w-8 text-text-muted" /> :
                               <FileIcon className="h-8 w-8 text-text-muted" />}
                            </div>
                          )}

                          {selectedIds.has(asset.id) && (
                            <div className="absolute inset-0 bg-primary/20">
                              <div className="absolute top-2 right-2 rounded-full bg-primary p-0.5 text-white shadow-sm">
                                <Check className="h-3 w-3" />
                              </div>
                            </div>
                          )}

                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4">
                            <p className="truncate text-xs text-white/90 font-medium">{asset.filename}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Preview */}
              <div className="w-[60%] flex flex-col bg-black/20 p-6">
                {previewAsset ? (
                  <div className="flex h-full flex-col">
                    <div className="flex-1 min-h-0 flex items-center justify-center rounded-xl overflow-hidden bg-black/40 border border-white/5 relative">
                      {previewAsset.type === 'image' ? (
                        <img
                          src={`asset:///${previewAsset.storage_path.replace(/\\/g, '/')}`}
                          alt={previewAsset.filename}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : previewAsset.type === 'video' ? (
                        <video
                          src={`asset:///${previewAsset.storage_path.replace(/\\/g, '/')}`}
                          controls
                          className="max-h-full max-w-full"
                          poster={previewAsset.thumbnail_path ? `asset:///${previewAsset.thumbnail_path.replace(/\\/g, '/')}` : undefined}
                        />
                      ) : previewAsset.type === 'audio' ? (
                        <div className="flex flex-col items-center gap-4 text-text-muted">
                          <Music className="h-16 w-16 opacity-50" />
                          <audio src={`asset:///${previewAsset.storage_path.replace(/\\/g, '/')}`} controls className="w-64" />
                        </div>
                      ) : (
                        <FileIcon className="h-16 w-16 text-text-muted" />
                      )}
                    </div>

                    <div className="mt-6 flex flex-col gap-2 shrink-0">
                      <h3 className="text-lg font-medium text-text-primary break-all">{previewAsset.filename}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-muted">
                        <span>{formatSize(previewAsset.size_bytes)}</span>
                        <span>&middot;</span>
                        <span className="capitalize">{previewAsset.source}</span>
                        <span>&middot;</span>
                        <span>{formatDate(previewAsset.created_at)}</span>
                        {previewAsset.project_id && (
                          <>
                            <span>&middot;</span>
                            <span>{projects.find(p => p.id === previewAsset.project_id)?.name || 'Unknown Project'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-text-muted">
                    <ImageIcon className="h-12 w-12 opacity-20 mb-4" />
                    <p>Select an asset to preview</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex h-16 shrink-0 items-center justify-between border-t border-white/10 px-6 bg-bg-elevated backdrop-blur-md">
              <button
                onClick={handleUpload}
                className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/10"
              >
                <Upload className="h-4 w-4" />
                Upload new
              </button>

              <div className="flex items-center gap-4">
                <span className="text-sm text-text-muted">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => onSelect(getSelectedAssets())}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-2 rounded-lg bg-white px-6 py-2 text-sm font-medium text-black transition-all hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Attach {selectedIds.size > 0 && `(${selectedIds.size})`}
                </button>
              </div>
            </div>
          </MorphingDialogContent>
      )}
    </MorphingDialogContainer>
  )
}
