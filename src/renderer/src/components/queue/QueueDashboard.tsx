import { type JSX, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, Reorder, motion } from 'framer-motion'
import {
  CheckCircle2,
  ChevronDown,
  GripVertical,
  ListOrdered,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Video,
  Image as ImageIcon,
  Music,
  XCircle,
  ExternalLink
} from 'lucide-react'
import type { QueueJob } from '../../../../main/queue/types'
import { useQueueStore } from '../../stores/queue-store'
import { useAppStore } from '../../stores/app-store'
import { useGenerationStore } from '../../stores/generation-store'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Just now'
  const diffMs = Math.max(0, Date.now() - timestamp)
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return new Date(timestamp).toLocaleDateString()
}

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return 'Waiting'
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}

function mediaIcon(type: QueueJob['type']): JSX.Element {
  if (type === 'video') return <Video className="h-4 w-4" />
  if (type === 'audio') return <Music className="h-4 w-4" />
  return <ImageIcon className="h-4 w-4" />
}

function trimPrompt(prompt: string): string {
  return prompt.length > 96 ? `${prompt.slice(0, 93)}...` : prompt
}

function toFileUrl(path: string): string {
  return `asset:///${path.replace(/\\/g, '/')}`
}

function isProtectedGoogleMediaUri(uri?: string): boolean {
  return Boolean(uri?.includes('generativelanguage.googleapis.com/download/'))
}

async function ensureRenderableResult(job: QueueJob): Promise<{
  data: string
  mimeType: string
  uri?: string
} | null> {
  if (!job.result?.mimeType) return null

  if ((job.type === 'video' || job.type === 'audio') && job.result.assetPath) {
    return {
      data: '',
      mimeType: job.result.mimeType,
      uri: toFileUrl(job.result.assetPath)
    }
  }

  if (job.result.data) {
    return {
      data: job.result.data,
      mimeType: job.result.mimeType
    }
  }

  if (job.result.assetId && window.manthan) {
    const base64 = await window.manthan.readAsset(job.result.assetId)
    if (base64) {
      return {
        data: base64,
        mimeType: job.result.mimeType
      }
    }
  }

  if (job.result.uri && !isProtectedGoogleMediaUri(job.result.uri)) {
    return {
      data: '',
      mimeType: job.result.mimeType,
      uri: job.result.uri
    }
  }

  return null
}

function CompletedJobPreview({ job }: { job: QueueJob }): JSX.Element {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      if (!job.result) {
        setPreview(null)
        return
      }

      if (job.type === 'video' || job.type === 'audio') {
        if (job.result.assetPath) {
          setPreview(toFileUrl(job.result.assetPath))
          return
        }
      }

      if (job.result.data) {
        setPreview(`data:${job.result.mimeType};base64,${job.result.data}`)
        return
      }

      if (job.result.assetId && window.manthan) {
        const base64 = await window.manthan.readAsset(job.result.assetId)
        if (!cancelled && base64) {
          setPreview(`data:${job.result.mimeType};base64,${base64}`)
          return
        }
      }

      if (job.result.uri && !isProtectedGoogleMediaUri(job.result.uri)) {
        setPreview(job.result.uri)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [job])

  if (!preview) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated text-text-muted">
        {mediaIcon(job.type)}
      </div>
    )
  }

  if (job.type === 'video') {
    return <video src={preview} className="h-14 w-14 rounded-2xl object-cover" muted playsInline />
  }

  if (job.type === 'audio') {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
        <Music className="h-5 w-5" />
      </div>
    )
  }

  return <img src={preview} alt={job.prompt} className="h-14 w-14 rounded-2xl object-cover" />
}

export function QueueDashboard(): JSX.Element {
  const {
    jobs,
    isPaused,
    pauseQueue,
    resumeQueue,
    cancelJob,
    retryJob,
    clearCompleted,
    deleteJob
  } = useQueueStore()
  const { setSidebarTab } = useAppStore()
  const { jobs: mediaJobs, addJob, setActiveJob } = useGenerationStore()
  const [completedOpen, setCompletedOpen] = useState(true)
  const [failedOpen, setFailedOpen] = useState(true)
  const [pendingOrder, setPendingOrder] = useState<QueueJob[]>([])

  const runningJobs = useMemo(() => jobs.filter((job) => job.status === 'running'), [jobs])
  const pendingJobs = useMemo(
    () =>
      [...jobs]
        .filter((job) => job.status === 'pending')
        .sort((a, b) => b.priority - a.priority || a.created_at - b.created_at),
    [jobs]
  )
  const completedJobs = useMemo(
    () =>
      [...jobs]
        .filter((job) => job.status === 'completed')
        .sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0)),
    [jobs]
  )
  const failedJobs = useMemo(
    () =>
      [...jobs]
        .filter((job) => job.status === 'failed')
        .sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0)),
    [jobs]
  )

  const pendingSignature = pendingJobs.map((job) => job.id).join(',')
  const pendingOrderSignature = pendingOrder.map((job) => job.id).join(',')
  const orderedPendingJobs = pendingSignature === pendingOrderSignature ? pendingOrder : pendingJobs

  const summary = `${pendingJobs.length} pending · ${runningJobs.length} running · ${completedJobs.length} completed`

  const handleView = async (job: QueueJob): Promise<void> => {
    const existing = mediaJobs.find((item) => item.id === job.id)
    if (existing) {
      setActiveJob(job.id)
      setSidebarTab('create')
      return
    }

    const renderable = await ensureRenderableResult(job)
    if (!renderable) return

    addJob({
      id: job.id,
      type: job.type,
      status: 'completed',
      prompt: job.prompt,
      negativePrompt: job.negative_prompt || undefined,
      provider: job.provider,
      model: job.model,
      config: {
        contentType: job.config.contentType,
        activeMode: job.config.activeMode,
        batchCount: job.config.batchCount,
        capabilityValues: job.config.capabilityValues as Record<string, string | number | boolean>
      },
      progress: 100,
      startedAt: job.started_at ?? job.created_at,
      completedAt: job.completed_at ?? Date.now(),
      result: {
        type: job.type,
        data: renderable.data,
        mimeType: renderable.mimeType,
        uri: renderable.uri
      }
    })
    setActiveJob(job.id)
    setSidebarTab('create')
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-border-subtle bg-bg-elevated/60 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <ListOrdered className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Queue</h2>
              <p className="text-xs text-text-muted">{summary}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void (isPaused ? resumeQueue() : pauseQueue())}
            >
              {isPaused ? (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Pause className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void clearCompleted()}>
              Clear Completed
            </Button>
          </div>
        </div>

        <section className="rounded-[28px] border border-border-subtle bg-bg-secondary/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Running</h3>
            <span className="text-xs text-text-muted">{runningJobs.length}</span>
          </div>

          <div className="space-y-3">
            {runningJobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-muted">
                Nothing is running right now.
              </div>
            ) : (
              runningJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border border-border-subtle bg-bg-elevated/60 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
                        {mediaIcon(job.type)}
                        <span className="capitalize">{job.type}</span>
                        <span>·</span>
                        <span>{job.model}</span>
                      </div>
                      <p className="text-sm text-text-primary">{trimPrompt(job.prompt)}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        Elapsed {formatElapsed(job.started_at)} · {Math.round(job.progress ?? 0)}%
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => void cancelJob(job.id)}>
                      Cancel
                    </Button>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-primary">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      animate={{ width: `${Math.max(4, job.progress ?? 4)}%` }}
                      transition={{ type: 'spring', stiffness: 180, damping: 28 }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-border-subtle bg-bg-secondary/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Pending</h3>
            <span className="text-xs text-text-muted">{pendingJobs.length}</span>
          </div>

          {orderedPendingJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-muted">
              The queue is clear.
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={orderedPendingJobs}
              onReorder={setPendingOrder}
              className="space-y-3"
            >
              <AnimatePresence initial={false}>
                {orderedPendingJobs.map((job) => (
                  <Reorder.Item
                    key={job.id}
                    value={job}
                    onDragEnd={() => {
                      if (!window.manthan) return
                      void Promise.all(
                        orderedPendingJobs.map((pendingJob, index) =>
                          window.manthan.reorderQueueJob(
                            pendingJob.id,
                            orderedPendingJobs.length - index
                          )
                        )
                      )
                    }}
                    className="group list-none rounded-2xl border border-border-subtle bg-bg-elevated/60 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="cursor-grab pt-0.5 text-text-muted group-active:cursor-grabbing">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2 text-xs text-text-muted">
                          {mediaIcon(job.type)}
                          <span className="capitalize">{job.type}</span>
                          <span>·</span>
                          <span>{job.model}</span>
                        </div>
                        <p className="text-sm text-text-primary">{trimPrompt(job.prompt)}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          Queued {formatRelativeTime(job.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => void cancelJob(job.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </section>

        <section className="rounded-[28px] border border-border-subtle bg-bg-secondary/40 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setCompletedOpen((open) => !open)}
          >
            <div>
              <h3 className="text-left text-sm font-semibold text-text-primary">Completed</h3>
              <p className="text-left text-xs text-text-muted">{completedJobs.length} finished</p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-text-muted transition-transform',
                completedOpen && 'rotate-180'
              )}
            />
          </button>

          {completedOpen && (
            <div className="mt-4 space-y-3">
              {completedJobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-muted">
                  Completed jobs will land here.
                </div>
              ) : (
                completedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-4 rounded-2xl border border-border-subtle bg-bg-elevated/60 p-3"
                  >
                    <CompletedJobPreview job={job} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 text-xs text-text-muted">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="capitalize">{job.type}</span>
                        <span>·</span>
                        <span>{job.model}</span>
                      </div>
                      <p className="text-sm text-text-primary">{trimPrompt(job.prompt)}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        {job.result?.duration ? `${job.result.duration}s` : 'Ready'} · completed{' '}
                        {formatRelativeTime(job.completed_at)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void handleView(job)}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-border-subtle bg-bg-secondary/40 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setFailedOpen((open) => !open)}
          >
            <div>
              <h3 className="text-left text-sm font-semibold text-text-primary">Failed</h3>
              <p className="text-left text-xs text-text-muted">
                {failedJobs.length} need attention
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-text-muted transition-transform',
                failedOpen && 'rotate-180'
              )}
            />
          </button>

          {failedOpen && (
            <div className="mt-4 space-y-3">
              {failedJobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-muted">
                  No failed jobs right now.
                </div>
              ) : (
                failedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-start gap-4 rounded-2xl border border-error/20 bg-error/5 p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-error/10 text-error">
                      <XCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 text-xs text-text-muted">
                        {mediaIcon(job.type)}
                        <span className="capitalize">{job.type}</span>
                        <span>·</span>
                        <span>{job.model}</span>
                      </div>
                      <p className="text-sm text-text-primary">{trimPrompt(job.prompt)}</p>
                      <p className="mt-1 text-xs text-error">{job.error || 'Generation failed'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => void retryJob(job.id)}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Retry
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void deleteJob(job.id)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
