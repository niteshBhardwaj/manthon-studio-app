import { type JSX, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Copy,
  Download,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  Music,
  RotateCcw,
  Trash2,
  Video,
  VideoOff,
  X
} from 'lucide-react'
import { useGenerationStore, type GenerationJob } from '../../stores/generation-store'
import { useQueueStore } from '../../stores/queue-store'
import { useAppStore } from '../../stores/app-store'
import { cn } from '../../lib/utils'
import { Tilt } from '../motion-primitives/tilt'
import { VideoPlayer } from '../player/VideoPlayer'
import { AudioPlayer } from '../player/AudioPlayer'
import { VideoLightbox } from '../player/VideoLightbox'
import { useSmoothProgress } from '../../hooks/useSmoothProgress'

function formatJobConfig(job: GenerationJob): string {
  const parts: string[] = []
  const values = job.config.capabilityValues

  if (typeof values.aspect_ratio === 'string' && values.aspect_ratio)
    parts.push(values.aspect_ratio)
  if (typeof values.resolution === 'string' && values.resolution)
    parts.push(values.resolution.toUpperCase())
  if (typeof values.duration === 'number') parts.push(`${values.duration}s`)
  if (job.config.batchCount > 1) parts.push(`x${job.config.batchCount}`)

  return parts.join(' · ')
}

function getJobSrc(job: GenerationJob): string {
  if (!job.result) return ''
  if (job.result.data) return `data:${job.result.mimeType};base64,${job.result.data}`
  if (job.result.uri?.includes('generativelanguage.googleapis.com/download/')) return ''
  return job.result.uri || ''
}

function formatElapsed(startedAt: number, now: number): string {
  const total = Math.max(0, Math.floor((now - startedAt) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function estimateRemaining(job: GenerationJob, now: number): string {
  if (job.progress <= 3) return 'Estimating...'
  const elapsedMs = now - job.startedAt
  const remainingMs = (elapsedMs / job.progress) * (100 - job.progress)
  const totalSeconds = Math.max(0, Math.round(remainingMs / 1000))
  if (totalSeconds < 60) return `~${totalSeconds}s remaining`
  return `~${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, '0')}s remaining`
}

function ImageLightbox({
  job,
  isOpen,
  onClose
}: {
  job: GenerationJob
  isOpen: boolean
  onClose: () => void
}): JSX.Element {
  return (
    <AnimatePresence>
      {isOpen && job.result ? (
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
            className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-bg-primary shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={`data:${job.result.mimeType};base64,${job.result.data}`}
              alt={job.prompt}
              className="max-h-[78vh] w-full object-contain bg-black/40"
            />
            <div className="border-t border-border-subtle p-5">
              <p className="text-sm text-text-secondary">{job.prompt}</p>
              <p className="mt-2 text-xs text-text-muted">
                {job.provider} · {job.model} · {formatJobConfig(job)}
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function MediaAudioSurface({
  job,
  compact = false,
  autoPlay = false,
  isHovered = false,
  className
}: {
  job: GenerationJob
  compact?: boolean
  autoPlay?: boolean
  isHovered?: boolean
  className?: string
}): JSX.Element {
  const [resolvedSrc, setResolvedSrc] = useState<string>(getJobSrc(job))

  useEffect(() => {
    let cancelled = false

    const loadAudioData = async () => {
      if (!window.manthan || !job.result?.assetId || job.result.data) return

      try {
        const base64 = await window.manthan.readAsset(job.result.assetId)
        if (!cancelled && base64) {
          setResolvedSrc(`data:${job.result.mimeType};base64,${base64}`)
        }
      } catch (error) {
        console.error('[MediaGrid] Failed to read audio asset:', error)
      }
    }

    setResolvedSrc(getJobSrc(job))
    void loadAudioData()

    return () => {
      cancelled = true
    }
  }, [job.result?.assetId, job.result?.data, job.result?.mimeType])

  return (
    <AudioPlayer
      id={job.id}
      src={resolvedSrc}
      mimeType={job.result?.mimeType}
      compact={compact}
      autoPlay={autoPlay}
      isHovered={isHovered}
      className={className}
    />
  )
}

function MediaCard({ job }: { job: GenerationJob }): JSX.Element {
  const { removeJob, loadJobIntoPrompt } = useGenerationStore()
  const { cancelJob } = useQueueStore()
  const { setSidebarTab, addToast } = useAppStore()
  const [videoOpen, setVideoOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const isGenerating = job.status === 'generating' || job.status === 'queued'
  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const [isHovered, setIsHovered] = useState(false)
  const displayProgress = useSmoothProgress(job.progress, isGenerating)

  useEffect(() => {
    if (!isGenerating) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [isGenerating])

  const handleDownload = async (): Promise<void> => {
    if (!job.result || !window.manthan) return
    const ext = job.result.mimeType.split('/')[1] || 'bin'
    const filename = `manthan-${job.type}-${Date.now()}.${ext}`
    await window.manthan.saveMedia(job.result.data, filename, job.result.mimeType)
    addToast({ title: 'Media downloaded', tone: 'success' })
  }

  const handleRerun = (): void => {
    loadJobIntoPrompt(job)
    setSidebarTab('create')
    window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
    }, 120)
  }

  const typeIcon =
    job.type === 'video' ? (
      <Video className="h-3.5 w-3.5" />
    ) : job.type === 'audio' ? (
      <Music className="h-3.5 w-3.5" />
    ) : (
      <ImageIcon className="h-3.5 w-3.5" />
    )

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Tilt rotationFactor={8} isRevese>
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              'group relative overflow-hidden rounded-[1.25rem] border bg-bg-elevated transition-all',
              isGenerating
                ? 'border-accent/40 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_30px_rgba(90,184,255,0.08)]'
                : 'border-border-subtle hover:border-border'
            )}
          >
            <button
              type="button"
              onClick={() => {
                if (job.type === 'video' && isCompleted) setVideoOpen(true)
                if (job.type === 'image' && isCompleted) setImageOpen(true)
              }}
              className="block w-full text-left"
            >
              <div
                className={cn(
                  'relative overflow-hidden',
                  job.type === 'audio' ? 'h-44' : 'aspect-video'
                )}
              >
                {isGenerating ? (
                  <div className="absolute inset-0 flex flex-col justify-between bg-[radial-gradient(circle_at_top,rgba(90,184,255,0.18),transparent_45%),linear-gradient(180deg,rgba(9,13,20,0.92),rgba(9,13,20,0.98))] p-5">
                    <div className="flex items-center justify-between">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-accent">
                        {typeIcon}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold text-text-primary">
                          {Math.round(displayProgress)}%
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                          {job.status === 'queued' ? 'Queued' : 'Rendering'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm text-text-primary">
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                        Generating with {job.model}...
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/8">
                        <motion.div
                          className="h-full rounded-full bg-accent"
                          initial={{ width: '4%' }}
                          animate={{ width: `${Math.max(4, displayProgress)}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                        <span>Elapsed: {formatElapsed(job.startedAt, now)}</span>
                        <span>{estimateRemaining(job, now)}</span>
                      </div>
                      <p className="mt-4 line-clamp-2 text-xs leading-5 text-text-secondary">
                        {job.prompt}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <span className="text-[11px] text-text-muted">{formatJobConfig(job)}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void cancelJob(job.id)
                        }}
                        className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-text-secondary transition-colors hover:border-white/20 hover:text-text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {isCompleted && job.result ? (
                  <>
                    {job.type === 'video' ? (
                      <VideoPlayer
                        src={getJobSrc(job)}
                        assetId={job.result.assetId}
                        mimeType={job.result.mimeType}
                        compact
                        isHovered={isHovered}
                        className="h-full w-full"
                      />
                    ) : job.type === 'audio' ? (
                      <MediaAudioSurface
                        job={job}
                        compact
                        isHovered={isHovered}
                        className="h-full w-full"
                      />
                    ) : (
                      <img
                        src={`data:${job.result.mimeType};base64,${job.result.data}`}
                        alt={job.prompt}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </>
                ) : null}

                {isFailed ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,rgba(40,8,12,0.9),rgba(16,10,12,0.98))] px-4 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-red-300/20 bg-error/10 text-error">
                      {job.type === 'video' ? (
                        <VideoOff className="h-5 w-5" />
                      ) : job.type === 'image' ? (
                        <ImageOff className="h-5 w-5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5" />
                      )}
                    </div>
                    <span className="rounded-full bg-red-400/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-200">
                      Failed
                    </span>
                    <span className="text-xs text-error">{job.error || 'Generation failed'}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleRerun()
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-white/15"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                  </div>
                ) : null}

                <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] text-white/85 backdrop-blur-md">
                  <span className="inline-flex items-center gap-1.5">
                    {typeIcon}
                    {job.type}
                  </span>
                </div>

                {job.type === 'video' && !isGenerating ? (
                  <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur-md">
                    {typeof job.config.capabilityValues.duration === 'number'
                      ? job.config.capabilityValues.duration
                      : 8}
                    s
                  </div>
                ) : null}
              </div>
            </button>

            <div className="space-y-3 p-4">
              <p className="line-clamp-2 text-sm leading-6 text-text-secondary">{job.prompt}</p>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-text-muted">{formatJobConfig(job)}</span>
                <div className="flex items-center gap-1">
                  {isCompleted ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleDownload()}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(job.prompt)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleRerun}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-subtle px-2.5 text-[11px] text-text-secondary transition-colors hover:bg-bg-hover"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Re-run
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeJob(job.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-error/5 hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Tilt>
      </motion.div>

      {job.type === 'video' ? (
        <VideoLightbox job={job} isOpen={videoOpen} onClose={() => setVideoOpen(false)} />
      ) : null}
      {job.type === 'image' ? (
        <ImageLightbox job={job} isOpen={imageOpen} onClose={() => setImageOpen(false)} />
      ) : null}
    </>
  )
}

export function MediaGrid(): JSX.Element | null {
  const { jobs, activeJobId } = useGenerationStore()
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!activeJobId) return
    const node = cardRefs.current[activeJobId]
    node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeJobId, jobs.length])

  if (jobs.length === 0) return null

  return (
    <div
      className="grid gap-4 p-6"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))'
      }}
    >
      {jobs.map((job) => (
        <div key={job.id} ref={(node) => void (cardRefs.current[job.id] = node)}>
          <MediaCard job={job} />
        </div>
      ))}
    </div>
  )
}
