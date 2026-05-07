import { type JSX, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Download,
  Image as ImageIcon,
  Music,
  RotateCcw,
  Star,
  Trash2,
  Video,
  X
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { VideoPlayer } from '../player/VideoPlayer'
import { AudioPlayer } from '../player/AudioPlayer'
import { VideoLightbox } from '../player/VideoLightbox'
import type { DashboardFeedItem } from '../../hooks/useDashboardFeed'
import type { GenerationJob } from '../../stores/generation-store'

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
      batchCount: 'batchCount' in config && typeof config.batchCount === 'number' ? config.batchCount : 1,
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

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DashboardVideoSurface({
  item,
  compact = false,
  autoPlay = false,
  className
}: {
  item: DashboardFeedItem
  compact?: boolean
  autoPlay?: boolean
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
      className={className}
    />
  )
}

function DashboardAudioSurface({
  item,
  compact = false,
  autoPlay = false,
  className
}: {
  item: DashboardFeedItem
  compact?: boolean
  autoPlay?: boolean
  className?: string
}): JSX.Element {
  const assetId = item.asset?.id ?? item.metadata.resultAssetId ?? null
  const [resolvedSrc, setResolvedSrc] = useState(item.previewSrc)

  useEffect(() => {
    let cancelled = false

    const loadAudio = async () => {
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
      src={resolvedSrc ?? ''}
      mimeType={item.asset?.mime_type}
      compact={compact}
      autoPlay={autoPlay}
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

  if (!isOpen) return null

  if (item.type === 'video' && generationJob) {
    return <VideoLightbox job={generationJob} isOpen={isOpen} onClose={onClose} />
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-bg-primary shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex max-h-[78vh] items-center justify-center bg-black/40 p-6">
              {item.type === 'video' ? (
                <DashboardVideoSurface item={item} autoPlay className="aspect-video w-full max-w-5xl" />
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
  onRerun?: () => void
  onDownload: () => void
}): JSX.Element {
  const isGenerating = item.status === 'generating' || item.status === 'queued'
  const isFailed = item.status === 'failed'

  const typeIcon =
    item.type === 'video' ? (
      <Video className="h-3.5 w-3.5" />
    ) : item.type === 'audio' ? (
      <Music className="h-3.5 w-3.5" />
    ) : (
      <ImageIcon className="h-3.5 w-3.5" />
    )

  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => {
          onSelect()
          if (!isGenerating) onOpen()
        }}
        className={cn(
          'group relative flex w-full flex-col overflow-hidden rounded-xl border bg-bg-elevated text-left transition-all',
          selected ? 'border-accent shadow-[0_0_0_1px_rgba(90,184,255,0.25)]' : 'border-border-subtle hover:border-border'
        )}
      >
        <div className={cn('relative overflow-hidden bg-bg-secondary', item.type === 'audio' ? 'h-28' : 'aspect-video')}>
          {item.type === 'video' ? (
            <DashboardVideoSurface item={item} compact className="h-full w-full" />
          ) : item.type === 'image' ? (
            <img
              src={item.thumbnailSrc ?? item.previewSrc ?? ''}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <DashboardAudioSurface item={item} compact className="h-full w-full" />
          )}

          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/25 to-transparent p-3">
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, item.progress)}%` }} />
              </div>
              <div className="text-[11px] font-medium text-white/85">{Math.round(item.progress)}%</div>
            </div>
          ) : null}

          {isFailed ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-3 text-center text-[11px] text-red-300">
              {item.generation?.error ?? 'Generation failed'}
            </div>
          ) : null}

          <div className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white/85 backdrop-blur-md">
            <span className="inline-flex items-center gap-1.5">
              {typeIcon}
              {item.type}
            </span>
          </div>

          <div className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[10px] capitalize text-white/80 backdrop-blur-md">
            {item.kind === 'generation' ? 'Generated' : item.source}
          </div>

          {item.kind === 'generation' ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleStar()
              }}
              className={cn(
                'absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors',
                item.starred ? 'bg-amber-400/20 text-amber-300' : 'bg-black/45 text-white/65 hover:text-white'
              )}
            >
              <Star className={cn('h-3.5 w-3.5', item.starred ? 'fill-current' : '')} />
            </button>
          ) : null}

          <div className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white/80 backdrop-blur-md">
            {item.type === 'audio'
              ? formatSize(item.metadata.sizeBytes)
              : item.metadata.duration
                ? `${item.metadata.duration}s`
                : formatSize(item.metadata.sizeBytes)}
          </div>
        </div>

        <div className="space-y-2 p-3">
          <p className="line-clamp-2 text-xs leading-5 text-text-secondary">{item.title}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-text-muted">{formatMetadata(item)}</span>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onDownload()
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              {item.kind === 'generation' && onRerun ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRerun()
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.button>

      <FeedItemModal item={item} isOpen={isOpen} onClose={onClose} />
    </>
  )
}
