import { type JSX, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Copy,
  Download,
  Image as ImageIcon,
  ImageOff,
  MoreHorizontal,
  Music,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  Video,
  VideoOff,
  X
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { VideoPlayer } from '../player/VideoPlayer'
import { AudioPlayer } from '../player/AudioPlayer'
import { VideoLightbox } from '../player/VideoLightbox'
import type { DashboardFeedItem } from '../../hooks/useDashboardFeed'
import { useGenerationStore, type BinaryInput, type GenerationJob } from '../../stores/generation-store'
import { useSmoothProgress } from '../../hooks/useSmoothProgress'
import { useAppStore } from '../../stores/app-store'

const STUCK_GENERATION_MS = 5 * 60 * 1000

function formatMetadata(item: DashboardFeedItem): string {
  const parts: string[] = []
  const config = item.metadata.config

  if (item.metadata.model) parts.push(item.metadata.model)

  if (config && typeof config === 'object') {
    const capabilityValues =
      'capabilityValues' in config && typeof config.capabilityValues === 'object'
        ? (config.capabilityValues as Record<string, unknown>)
        : {}

    if (typeof capabilityValues.aspect_ratio === 'string') parts.push(capabilityValues.aspect_ratio)
    if (typeof capabilityValues.resolution === 'string') {
      parts.push(capabilityValues.resolution.toUpperCase())
    }
    if (typeof capabilityValues.duration === 'number') parts.push(`${capabilityValues.duration}s`)
  }

  if (parts.length === 0 && typeof item.metadata.sizeBytes === 'number') {
    const mb = item.metadata.sizeBytes / (1024 * 1024)
    parts.push(`${mb.toFixed(mb >= 10 ? 0 : 1)} MB`)
  }

  return parts.join(' · ')
}

export function dashboardItemToGenerationJob(item: DashboardFeedItem): GenerationJob | null {
  if (item.kind !== 'generation' || !item.generation) return null

  const config = item.generation.config ?? {}
  const capabilityValues =
    'capabilityValues' in config && typeof config.capabilityValues === 'object'
      ? (config.capabilityValues as Record<string, string | number | boolean>)
      : {}

  return {
    id: item.id,
    type: item.type,
    status: item.status,
    prompt: item.generation.prompt,
    negativePrompt: item.generation.negative_prompt || undefined,
    provider: item.generation.provider,
    model: item.generation.model,
    config: {
      contentType: item.type,
      activeMode:
        'activeMode' in config && typeof config.activeMode === 'string' ? config.activeMode : null,
      batchCount:
        'batchCount' in config && typeof config.batchCount === 'number' ? config.batchCount : 1,
      capabilityValues
    },
    progress: item.progress,
    startedAt: item.generation.started_at,
    completedAt: item.generation.completed_at ?? undefined,
    result: item.previewSrc
      ? {
        type: item.type,
        data: '',
        mimeType: item.asset?.mime_type ?? 'video/mp4',
        uri: item.previewSrc,
        assetId: item.asset?.id ?? item.metadata.resultAssetId ?? undefined
      }
      : undefined
  }
}

function DashboardVideoSurface({
  item,
  compact = false,
  autoPlay = false,
  isHovered = false,
  className
}: {
  item: DashboardFeedItem
  compact?: boolean
  autoPlay?: boolean
  isHovered?: boolean
  className?: string
}): JSX.Element {
  const assetId = item.asset?.id ?? item.metadata.resultAssetId ?? undefined

  return (
    <VideoPlayer
      src={item.previewSrc ?? ''}
      assetId={assetId}
      mimeType={item.asset?.mime_type}
      poster={item.thumbnailSrc ?? undefined}
      compact={compact}
      autoPlay={autoPlay}
      isHovered={isHovered}
      className={className}
    />
  )
}

function DashboardAudioSurface({
  item,
  compact = false,
  autoPlay = false,
  isHovered = false,
  className
}: {
  item: DashboardFeedItem
  compact?: boolean
  autoPlay?: boolean
  isHovered?: boolean
  className?: string
}): JSX.Element {
  const assetId = item.asset?.id ?? item.metadata.resultAssetId ?? null
  const [resolvedSrc, setResolvedSrc] = useState(item.previewSrc)

  useEffect(() => {
    let cancelled = false

    const loadAudio = async (): Promise<void> => {
      if (!window.manthan || !assetId) return
      const base64 = await window.manthan.readAsset(assetId)
      if (!cancelled && base64) {
        setResolvedSrc(`data:${item.asset?.mime_type ?? 'audio/mpeg'};base64,${base64}`)
      }
    }

    setResolvedSrc(item.previewSrc)
    void loadAudio()

    return () => {
      cancelled = true
    }
  }, [assetId, item.asset?.mime_type, item.previewSrc])

  return (
    <AudioPlayer
      id={item.id}
      src={resolvedSrc ?? ''}
      mimeType={item.asset?.mime_type}
      compact={compact}
      autoPlay={autoPlay}
      isHovered={isHovered}
      className={className}
    />
  )
}

function FeedItemModal({
  item,
  isOpen,
  onClose
}: {
  item: DashboardFeedItem
  isOpen: boolean
  onClose: () => void
}): JSX.Element | null {
  const generationJob = useMemo(() => dashboardItemToGenerationJob(item), [item])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  if (item.type === 'video' && generationJob) {
    return (
      <VideoLightbox
        job={generationJob}
        isOpen={isOpen}
        onClose={onClose}
        layoutId={`dashboard-card-${item.id}`}
      />
    )
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-110 flex items-center justify-center bg-black/85 p-6"
        >
          <motion.div
            layoutId={`dashboard-card-${item.id}`}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-bg-primary shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 transition-colors hover:bg-black/70 hover:text-white"
            >
              <X className="h-4 w-4" />
              <span className="absolute -bottom-6 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/70">
                Esc
              </span>
            </button>

            <div className="flex w-full max-h-[78vh] items-center justify-center bg-black/40 p-6">
              {item.type === 'video' ? (
                <DashboardVideoSurface
                  item={item}
                  autoPlay
                  className="aspect-video w-full max-w-5xl"
                />
              ) : item.type === 'image' ? (
                <img
                  src={item.previewSrc ?? item.thumbnailSrc ?? ''}
                  alt={item.title}
                  className="max-h-[72vh] w-full object-contain"
                />
              ) : (
                <DashboardAudioSurface item={item} autoPlay className="w-full max-w-2xl" />
              )}
            </div>

            <div className="border-t border-border-subtle p-5">
              <p className="text-sm text-text-secondary">{item.title}</p>
              <p className="mt-2 text-xs text-text-muted">{formatMetadata(item)}</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function DashboardCard({
  item,
  selected,
  isOpen,
  onOpen,
  onClose,
  onSelect,
  onToggleStar,
  onDelete,
  onCancel,
  onRerun,
  onDownload
}: {
  item: DashboardFeedItem
  selected: boolean
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: () => void
  onToggleStar: () => void
  onDelete: () => void
  onCancel?: () => void
  onRerun?: () => void
  onDownload: () => void
}): JSX.Element {
  const isGenerating = item.status === 'generating' || item.status === 'queued'
  const isFailed = item.status === 'failed'
  const displayProgress = useSmoothProgress(item.progress, isGenerating)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const lastProgressChangeAtRef = useRef(Date.now())
  const [now, setNow] = useState(() => Date.now())
  const addImageToPrompt = useGenerationStore((state) => state.addImageToPrompt)
  const { addToast } = useAppStore()
  const canOpen = !isGenerating && !isFailed
  const canDownload = !isFailed
  const canToggleStar = item.kind === 'generation' && !isFailed
  const canAddToPrompt = item.type === 'image' && !isFailed

  useEffect(() => {
    if (!isGenerating) return
    lastProgressChangeAtRef.current = Date.now()
  }, [item.progress, isGenerating])

  useEffect(() => {
    if (!isGenerating) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  const showStuckWarning = isGenerating && now - lastProgressChangeAtRef.current >= STUCK_GENERATION_MS

  const typeIcon =
    item.type === 'video' ? (
      <Video className="h-4 w-4" />
    ) : item.type === 'audio' ? (
      <Music className="h-4 w-4" />
    ) : (
      <ImageIcon className="h-4 w-4" />
    )

  const copyPrompt = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(item.title)
    } catch (error) {
      console.warn('Failed to copy prompt', error)
    }
  }

  const handleAddToPrompt = async (): Promise<void> => {
    if (!window.manthan || item.type !== 'image') return
    const assetId = item.asset?.id ?? item.metadata.resultAssetId ?? null
    if (!assetId) return

    try {
      const base64Data = await window.manthan.readAsset(assetId)
      if (!base64Data) throw new Error('Asset data is unavailable')

      const input: BinaryInput = {
        data: base64Data,
        mimeType: item.asset?.mime_type ?? 'image/png',
        metadata: { sourceAssetId: assetId }
      }
      const slotName = addImageToPrompt(input)

      if (!slotName) {
        addToast({
          title: 'Prompt slots full',
          message: 'Switch modes or clear an image before adding another.',
          tone: 'error'
        })
        return
      }

      addToast({
        title: `Added to prompt as ${slotName}`,
        tone: 'success'
      })

      window.setTimeout(() => {
        document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
      }, 80)
    } catch (error) {
      addToast({
        title: 'Could not add image',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error'
      })
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        layoutId={`dashboard-card-${item.id}`}
        role="button"
        tabIndex={0}
        onClick={() => {
          onSelect()
          if (canOpen) onOpen()
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onSelect()
          if (canOpen) onOpen()
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-xl border bg-bg-secondary text-left transition-all',
          !canOpen && 'cursor-default',
          selected
            ? 'border-accent shadow-[0_0_0_1px_rgba(90,184,255,0.25)]'
            : 'border-border-subtle hover:border-border'
        )}
      >
        <div className="absolute inset-0">
          {isFailed ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(180deg,rgba(42,12,16,0.92),rgba(14,13,18,0.98))] p-4 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-red-300/20 bg-red-400/10 text-red-200">
                {item.type === 'video' ? (
                  <VideoOff className="h-5 w-5" />
                ) : item.type === 'image' ? (
                  <ImageOff className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <span className="rounded-full bg-red-400/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-200">
                Failed
              </span>
              <p className="line-clamp-2 text-[11px] leading-4 text-red-100/75">
                {item.generation?.error ?? 'Generation failed'}
              </p>
              {onRerun ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRerun()
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-white/15"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </button>
              ) : null}
            </div>
          ) : item.type === 'video' ? (
            <DashboardVideoSurface
              item={item}
              compact
              isHovered={isHovered}
              className="h-full w-full"
            />
          ) : item.type === 'image' ? (
            <img
              src={item.thumbnailSrc ?? item.previewSrc ?? ''}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <DashboardAudioSurface item={item} compact isHovered={isHovered} />
          )}
        </div>

        {isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] bg-[length:200%_100%]" />
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative z-10 flex flex-col items-center gap-2 text-center">
              <div className=" shadow-[0_0_32px_rgba(255,255,255,0.08)]">
                <div className="text-xl font-bold text-white drop-shadow-lg">
                  {Math.round(displayProgress)}%
                </div>
              </div>
              {showStuckWarning ? (
                <div className="max-w-[11rem] rounded-lg border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-100">
                  Generation appears stuck
                </div>
              ) : null}
              {onCancel ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onCancel()
                  }}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors',
                    showStuckWarning
                      ? 'bg-red-500 text-white hover:bg-red-400'
                      : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white'
                  )}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div
          className={cn(
            'pointer-events-none absolute bottom-2 right-2 z-20 text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] transition-opacity duration-200',
            (item.type === 'audio' || item.type === 'video') && isHovered
              ? 'opacity-0'
              : 'opacity-100'
          )}
        >
          {typeIcon}
        </div>

        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/20 opacity-0 transition-opacity duration-200 pointer-events-none',
            menuOpen ? 'opacity-100' : 'group-hover:opacity-100'
          )}
        >
          <button
            type="button"
            aria-label="Open media actions"
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen((open) => !open)
            }}
            className={cn(
              'absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-all hover:bg-black/50 hover:text-white group-hover:opacity-100 pointer-events-auto',
              menuOpen ? 'opacity-100' : 'opacity-0'
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {canToggleStar ? (
            <button
              type="button"
              aria-label={item.starred ? 'Unstar media' : 'Star media'}
              onClick={(event) => {
                event.stopPropagation()
                onToggleStar()
              }}
              className={cn(
                'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 backdrop-blur-md transition-all hover:bg-black/50 group-hover:opacity-100 pointer-events-auto',
                menuOpen ? 'opacity-100' : 'opacity-0',
                item.starred ? 'text-amber-300' : 'text-white/80 hover:text-white'
              )}
            >
              <Star className={cn('h-4 w-4', item.starred ? 'fill-current' : '')} />
            </button>
          ) : null}

          <p className="absolute bottom-2 left-2 right-9 truncate text-xs font-medium text-white/90">
            {item.title}
          </p>
        </div>

        {menuOpen ? (
          <div
            className="absolute left-2 top-11 z-30 w-44 overflow-hidden rounded-lg border border-white/10 bg-[#111722]/95 py-1 text-xs text-white/85 shadow-2xl backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {canDownload ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onDownload()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            ) : null}
            {canAddToPrompt ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  void handleAddToPrompt()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Add to Prompt
              </button>
            ) : null}
            {item.kind === 'generation' && onRerun ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onRerun()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/10"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Re-run
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                void copyPrompt()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/10"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy prompt
            </button>
            {canToggleStar ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onToggleStar()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/10"
              >
                <Star
                  className={cn('h-3.5 w-3.5', item.starred ? 'fill-current text-amber-300' : '')}
                />
                {item.starred ? 'Unstar' : 'Star'}
              </button>
            ) : null}
            <div className="my-1 h-px bg-white/10" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                onDelete()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-300 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        ) : null}
      </motion.div>

      <FeedItemModal item={item} isOpen={isOpen} onClose={onClose} />
    </>
  )
}
