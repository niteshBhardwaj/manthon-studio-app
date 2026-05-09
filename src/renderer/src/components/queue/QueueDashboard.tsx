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

type Tab = 'all' | 'active' | 'completed' | 'failed'

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
  const [activeTab, setActiveTab] = useState<Tab>('all')

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

  const activeJobs = useMemo(() => [...runningJobs, ...pendingJobs], [runningJobs, pendingJobs])

  const allJobs = useMemo(() => {
    return [...runningJobs, ...pendingJobs, ...completedJobs, ...failedJobs].sort((a, b) => {
      if (a.status === 'running' && b.status !== 'running') return -1
      if (b.status === 'running' && a.status !== 'running') return 1

      if (a.status === 'pending' && b.status === 'pending') {
        return b.priority - a.priority || a.created_at - b.created_at
      }
      if (a.status === 'pending' && (b.status === 'completed' || b.status === 'failed')) return -1
      if (b.status === 'pending' && (a.status === 'completed' || a.status === 'failed')) return 1

      const timeA = a.completed_at ?? a.created_at
      const timeB = b.completed_at ?? b.created_at
      return timeB - timeA
    })
  }, [runningJobs, pendingJobs, completedJobs, failedJobs])

  const filteredJobs = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return activeJobs
      case 'completed':
        return completedJobs
      case 'failed':
        return failedJobs
      default:
        return allJobs
    }
  }, [activeTab, activeJobs, completedJobs, failedJobs, allJobs])

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

  const tabs: { id: Tab; label: string; count?: number; icon: any }[] = [
    { id: 'all', label: 'All Items', count: allJobs.length, icon: ListOrdered },
    { id: 'active', label: 'Active', count: activeJobs.length, icon: RefreshCw },
    { id: 'completed', label: 'Completed', count: completedJobs.length, icon: CheckCircle2 },
    { id: 'failed', label: 'Failed', count: failedJobs.length, icon: XCircle }
  ]

  return (
    <div className="h-full overflow-y-auto px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Queue</h1>
            <p className="text-text-muted">Manage and track your media generation tasks in real-time.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-border-subtle bg-bg-elevated/50 px-4 backdrop-blur-sm"
              onClick={() => void (isPaused ? resumeQueue() : pauseQueue())}
            >
              {isPaused ? (
                <Play className="mr-2 h-4 w-4 fill-current" />
              ) : (
                <Pause className="mr-2 h-4 w-4 fill-current" />
              )}
              {isPaused ? 'Resume Queue' : 'Pause Queue'}
            </Button>
            {completedJobs.length > 0 && (activeTab === 'all' || activeTab === 'completed') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 rounded-xl text-text-muted hover:bg-bg-elevated/50 hover:text-text-primary"
                onClick={() => void clearCompleted()}
              >
                Clear Completed
              </Button>
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-4 overflow-x-auto rounded-2xl border border-border-subtle bg-bg-elevated/30 p-1 backdrop-blur-md">
          <div className="flex flex-1 items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative flex h-10 flex-1 items-center justify-center gap-2 px-4 text-sm font-medium transition-all duration-200',
                    isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive && 'text-accent')} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={cn(
                        'ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                        isActive ? 'bg-accent text-accent-foreground' : 'bg-bg-elevated text-text-muted'
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 z-[-1] rounded-xl bg-bg-elevated/60 shadow-sm"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-border-subtle bg-bg-secondary/20 py-20 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated/50 text-text-muted">
                <ListOrdered className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-base font-medium text-text-secondary">No items found</p>
              <p className="text-sm text-text-muted">
                {activeTab === 'all'
                  ? 'Your queue is empty. Start generating media to see them here.'
                  : `No ${activeTab} items to display.`}
              </p>
            </motion.div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {filteredJobs.map((job) => (
                  <JobItem
                    key={job.id}
                    job={job}
                    onView={() => void handleView(job)}
                    onCancel={() => void cancelJob(job.id)}
                    onRetry={() => void retryJob(job.id)}
                    onDelete={() => void deleteJob(job.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function JobItem({
  job,
  onView,
  onCancel,
  onRetry,
  onDelete
}: {
  job: QueueJob
  onView: () => void
  onCancel: () => void
  onRetry: () => void
  onDelete: () => void
}): JSX.Element {
  const isRunning = job.status === 'running'
  const isPending = job.status === 'pending'
  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn(
        'group relative overflow-hidden rounded-[24px] border border-border-subtle bg-bg-elevated/40 p-4 transition-all hover:bg-bg-elevated/60',
        isRunning && 'border-accent/30 bg-accent/5',
        isFailed && 'border-error/30 bg-error/5'
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          {isCompleted ? (
            <CompletedJobPreview job={job} />
          ) : (
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-elevated transition-colors group-hover:bg-bg-elevated/80',
                isRunning && 'bg-accent/10 text-accent',
                isFailed && 'bg-error/10 text-error'
              )}
            >
              {isRunning ? (
                <RefreshCw className="h-6 w-6 animate-spin" style={{ animationDuration: '3s' }} />
              ) : isFailed ? (
                <XCircle className="h-6 w-6" />
              ) : (
                mediaIcon(job.type)
              )}
            </div>
          )}
          {isRunning && (
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-lg bg-accent text-[10px] font-bold text-accent-foreground shadow-lg">
              {Math.round(job.progress ?? 0)}%
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
            <span
              className={cn(
                'flex items-center gap-1 capitalize',
                isRunning && 'text-accent',
                isFailed && 'text-error',
                isCompleted && 'text-emerald-400'
              )}
            >
              {isCompleted && <CheckCircle2 className="h-3 w-3" />}
              {isFailed && <XCircle className="h-3 w-3" />}
              {isRunning && (
                <RefreshCw
                  className="h-3 w-3 animate-spin"
                  style={{ animationDuration: '3s' }}
                />
              )}
              {isPending && <ListOrdered className="h-3 w-3" />}
              {job.status}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              {mediaIcon(job.type)}
              {job.type}
            </span>
            <span>·</span>
            <span>{job.model}</span>
          </div>

          <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">
            {job.prompt}
          </p>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            {isRunning ? (
              <span>Started {formatElapsed(job.started_at)}</span>
            ) : isCompleted ? (
              <span>Finished {formatRelativeTime(job.completed_at)}</span>
            ) : isFailed ? (
              <div className="flex items-center gap-2">
                <span>Failed {formatRelativeTime(job.completed_at)}</span>
                <span>·</span>
                <span className="text-error">{job.error || 'Generation failed'}</span>
              </div>
            ) : (
              <span>Queued {formatRelativeTime(job.created_at)}</span>
            )}
            {job.result?.duration && <span>· {job.result.duration}s</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
          {isCompleted && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-border-subtle bg-bg-elevated/50 hover:bg-accent hover:text-accent-foreground"
              onClick={onView}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              View
            </Button>
          )}

          {isFailed && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-border-subtle bg-bg-elevated/50 hover:bg-accent hover:text-accent-foreground"
                onClick={onRetry}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-xl p-0 text-text-muted hover:bg-error/10 hover:text-error"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}

          {(isRunning || isPending) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl text-text-muted hover:bg-error/10 hover:text-error"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {isRunning && (
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-accent/10">
          <motion.div
            className="h-full bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, job.progress ?? 0)}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
        </div>
      )}
    </motion.div>
  )
}

