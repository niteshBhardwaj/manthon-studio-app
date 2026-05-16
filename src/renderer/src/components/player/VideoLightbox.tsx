import { type JSX, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Copy, Download, Film, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { GenerationJob } from '../../stores/generation-store'
import { useGenerationStore } from '../../stores/generation-store'
import { VideoPlayer } from './VideoPlayer'
import { PromptInput } from '../generation/PromptInput'
import { enqueueGeneration } from '../../lib/enqueue-generation'
import { extractFrameAtTime } from '../../lib/thumbnail-utils'
import { useProjectStore } from '../../stores/project-store'
import { useAppStore } from '../../stores/app-store'
import { cn } from '../../lib/utils'
import { getModelById } from '../../lib/model-capabilities'

function formatJobConfig(job: GenerationJob): string {
  const values = job.config.capabilityValues
  const parts = [job.provider, job.model]

  if (typeof values.aspect_ratio === 'string') parts.push(values.aspect_ratio)
  if (typeof values.resolution === 'string') parts.push(values.resolution.toUpperCase())
  if (typeof values.duration === 'number') parts.push(`${values.duration}s`)

  return parts.join(' · ')
}

function getJobSrc(job: GenerationJob): string {
  if (!job.result) return ''
  if (job.result.data) return `data:${job.result.mimeType};base64,${job.result.data}`
  if (job.result.uri?.includes('generativelanguage.googleapis.com/download/')) return ''
  return job.result.uri || ''
}

async function resolveJobSrc(job: GenerationJob): Promise<string> {
  const src = getJobSrc(job)
  if (src) return src

  if (job.result?.assetId && window.manthan?.readAsset) {
    const base64 = await window.manthan.readAsset(job.result.assetId)
    if (base64) return `data:${job.result.mimeType || 'video/mp4'};base64,${base64}`
  }

  return ''
}

function getJobDurationSeconds(job: GenerationJob): number {
  const resultDuration = (job.result as { duration?: unknown } | undefined)?.duration
  if (typeof resultDuration === 'number' && resultDuration > 0) return resultDuration

  const configuredDuration =
    job.config.capabilityValues.duration_seconds ?? job.config.capabilityValues.duration
  if (typeof configuredDuration === 'number' && configuredDuration > 0) return configuredDuration
  if (typeof configuredDuration === 'string') {
    const parsed = Number(configuredDuration.replace(/[^\d.]/g, ''))
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return 10
}

function buildTimelineTimes(durationSeconds: number): number[] {
  const duration = Math.max(0.5, durationSeconds)
  const lastFrame = Math.max(0.1, duration - 0.05)
  const wholeSeconds = Math.max(1, Math.ceil(duration))

  return Array.from({ length: wholeSeconds }, (_, index) => Math.min(lastFrame, index))
}

function formatFrameTime(timeSeconds: number): string {
  if (timeSeconds < 1) return '0s'
  return `${Math.round(timeSeconds)}s`
}

export function VideoLightbox({
  job,
  isOpen,
  onClose,
  layoutId
}: {
  job: GenerationJob
  isOpen: boolean
  onClose: () => void
  layoutId?: string
}): JSX.Element {
  const jobs = useGenerationStore((state) => state.jobs)
  const { activeProjectId } = useProjectStore()
  const { addToast } = useAppStore()
  const [displayJobId, setDisplayJobId] = useState(job.id)
  const [submitting, setSubmitting] = useState(false)
  const [localPrompt, setLocalPrompt] = useState('')
  const [localModel, setLocalModel] = useState(job.model)
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState('')
  const [resolvingVideoSrc, setResolvingVideoSrc] = useState(false)
  const [timelineFrames, setTimelineFrames] = useState<
    Array<{ timeSeconds: number; base64: string }>
  >([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [seekTo, setSeekTo] = useState<number | null>(null)

  const displayJob = useMemo(
    () => jobs.find((item) => item.id === displayJobId) ?? job,
    [displayJobId, job, jobs]
  )

  const groupJobs = useMemo(() => {
    const rootId = displayJob.groupId || displayJob.id
    return jobs
      .filter((j) => j.id === rootId || j.groupId === rootId)
      .sort((a, b) => a.startedAt - b.startedAt)
  }, [displayJob, jobs])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    setResolvingVideoSrc(true)
    setResolvedVideoSrc('')
    void resolveJobSrc(displayJob)
      .then((src) => {
        if (!cancelled) setResolvedVideoSrc(src)
      })
      .catch(() => {
        if (!cancelled) setResolvedVideoSrc('')
      })
      .finally(() => {
        if (!cancelled) setResolvingVideoSrc(false)
      })

    return () => {
      cancelled = true
    }
  }, [displayJob, isOpen])

  useEffect(() => {
    if (!isOpen || !timelineOpen || displayJob.status !== 'completed' || !resolvedVideoSrc) {
      const resetTimer = window.setTimeout((): void => {
        setTimelineFrames([])
        setTimelineLoading(false)
      }, 0)
      return () => window.clearTimeout(resetTimer)
    }

    let cancelled = false
    const times = buildTimelineTimes(getJobDurationSeconds(displayJob))

    const loadTimelineFrames = async (): Promise<void> => {
      setTimelineLoading(true)
      setTimelineFrames([])

      for (const timeSeconds of times) {
        try {
          const base64 = await extractFrameAtTime(resolvedVideoSrc, timeSeconds)
          if (cancelled) break
          setTimelineFrames((frames) => [...frames, { timeSeconds, base64 }])
        } catch (error) {
          console.warn('Failed to extract timeline frame', error)
        }
      }

      if (!cancelled) setTimelineLoading(false)
    }

    void loadTimelineFrames()

    return () => {
      cancelled = true
    }
  }, [displayJob.id, displayJob.status, isOpen, resolvedVideoSrc, timelineOpen])

  // Determine if the video supports true Veo extension
  const isVeoExtendable = useMemo(() => {
    if (displayJob.status !== 'completed') return false
    const modelDescriptor = getModelById(displayJob.model)
    const providerLooksLikeVeo = displayJob.provider.toLowerCase().includes('veo')
    const modelLooksLikeVeo = displayJob.model.toLowerCase().includes('veo')
    if (!providerLooksLikeVeo && !modelLooksLikeVeo) return false
    if (modelDescriptor?.supportsVideoExtension === undefined) return modelLooksLikeVeo
    return modelDescriptor.supportsVideoExtension === true
  }, [displayJob.model, displayJob.provider, displayJob.status])

  useEffect(() => {
    if (!isOpen) return

    const resetTimer = window.setTimeout(() => {
      setDisplayJobId(job.id)
      setLocalPrompt('')
      setLocalModel(job.model)
      setTimelineFrames([])
      setTimelineLoading(false)
      setTimelineOpen(false)
      setSeekTo(null)
      setSubmitting(false)
    }, 0)

    // Fetch siblings if this job is part of a group
    const rootId = job.groupId || job.id
    if (window.manthan?.listGenerations) {
      window.manthan.listGenerations({ groupId: rootId }).then((results) => {
        const items = results?.items ?? []
        if (items.length > 0) {
          // Map StoredGeneration to GenerationJob
          const groupJobs = items.map((g) => {
            const storedConfig = g.config as Partial<GenerationJob['config']>
            return {
              id: g.id,
              groupId: g.group_id ?? undefined,
              type: g.type,
              status: g.status as GenerationJob['status'],
              prompt: g.prompt,
              negativePrompt: g.negative_prompt,
              provider: g.provider,
              model: g.model,
              config: {
                contentType: storedConfig.contentType ?? g.type,
                activeMode: storedConfig.activeMode ?? null,
                batchCount: storedConfig.batchCount ?? 1,
                capabilityValues: storedConfig.capabilityValues ?? {}
              },
              result: g.result_asset_id
                ? {
                    type: g.type,
                    data: '',
                    assetId: g.result_asset_id,
                    mimeType:
                      g.type === 'audio'
                        ? 'audio/mpeg'
                        : g.type === 'image'
                          ? 'image/png'
                          : 'video/mp4'
                  }
                : undefined,
              progress: g.progress,
              startedAt: g.started_at,
              completedAt: g.completed_at ?? undefined
            }
          })
          useGenerationStore.getState().addJobs(groupJobs)
        }
      })
    }

    return () => window.clearTimeout(resetTimer)
  }, [isOpen, job])

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

  const handleDownload = async (): Promise<void> => {
    if (!displayJob.result || !window.manthan) return
    const data =
      displayJob.result.data ||
      (displayJob.result.assetId ? await window.manthan.readAsset(displayJob.result.assetId) : null)
    if (!data) return
    const ext = displayJob.result.mimeType.split('/')[1] || 'bin'
    await window.manthan.saveMedia(
      data,
      buildMediaFilename(`manthan-${displayJob.type}`, displayJob.id, ext),
      displayJob.result.mimeType
    )
    addToast({
      title: 'Video downloaded',
      tone: 'success'
    })
  }

  function buildMediaFilename(prefix: string, id: string, ext: string): string {
    return `${prefix}-${id.replace(/[^a-z0-9-]/gi, '-')}.${ext}`
  }

  // True Veo extension — sends full video binary
  const handleExtendVideo = async (): Promise<void> => {
    if (!localPrompt.trim() || !displayJob.result) return

    setSubmitting(true)
    try {
      let videoBase64 = displayJob.result.data
      if (!videoBase64 && displayJob.result.assetId && window.manthan?.readAsset) {
        try {
          const assetData = await window.manthan.readAsset(displayJob.result.assetId)
          if (assetData) videoBase64 = assetData
        } catch (e) {
          console.warn('Could not read asset from disk', e)
        }
      }

      if (!videoBase64) {
        throw new Error('Video data is unavailable for extension.')
      }

      const createdJobs = await enqueueGeneration({
        groupId: displayJob.groupId || displayJob.id,
        prompt: localPrompt.trim(),
        negativePrompt: '',
        selectedModel: localModel,
        capabilityValues: {
          ...displayJob.config.capabilityValues,
          resolution: '720p',
          batch_count: 1
        },
        startFrame: null,
        endFrame: null,
        videoInput: {
          data: videoBase64,
          mimeType: displayJob.result.mimeType || 'video/mp4'
        },
        referenceImages: [],
        batchCount: 1,
        activeMode: null,
        activeProjectId
      })

      if (createdJobs[0]) {
        useGenerationStore.getState().addJob(createdJobs[0])
        setDisplayJobId(createdJobs[0].id)
        setLocalPrompt('')
      }
    } catch (error) {
      addToast({
        title: 'Extension failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleContinueFromLastFrame = async (): Promise<void> => {
    if (!localPrompt.trim() || !resolvedVideoSrc) return

    setSubmitting(true)
    try {
      const frameTime = Math.max(0, getJobDurationSeconds(displayJob) - 0.05)
      const frameBase64 = await extractFrameAtTime(resolvedVideoSrc, frameTime)
      const createdJobs = await enqueueGeneration({
        groupId: displayJob.groupId || displayJob.id,
        prompt: localPrompt.trim(),
        negativePrompt: '',
        selectedModel: localModel,
        capabilityValues: {
          ...displayJob.config.capabilityValues,
          batch_count: 1
        },
        startFrame: {
          data: frameBase64,
          mimeType: 'image/webp',
          metadata: {
            extractedFromVideo: displayJob.id,
            timeSeconds: frameTime
          }
        },
        endFrame: null,
        videoInput: null,
        referenceImages: [],
        batchCount: 1,
        activeMode: 'frames',
        activeProjectId
      })

      if (createdJobs[0]) {
        useGenerationStore.getState().addJob(createdJobs[0])
        setDisplayJobId(createdJobs[0].id)
        setLocalPrompt('')
      }
    } catch (error) {
      addToast({
        title: 'Continuation failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleExtensionSubmit = async (): Promise<void> => {
    if (isVeoExtendable) await handleExtendVideo()
    else await handleContinueFromLastFrame()
  }

  const handleSeekToFrame = (timeSeconds: number): void => {
    setSeekTo(null)
    window.setTimeout(() => setSeekTo(timeSeconds), 0)
  }

  const handleAddFrame = async (frame: { timeSeconds: number; base64: string }): Promise<void> => {
    if (!window.manthan) return

    await window.manthan.saveAsset({
      projectId: activeProjectId ?? undefined,
      base64Data: frame.base64,
      mimeType: 'image/webp',
      filename: buildMediaFilename(
        `frame-${Math.round(frame.timeSeconds * 10) / 10}s`,
        displayJob.id,
        'webp'
      ),
      source: 'generated',
      metadata: {
        extractedFromVideo: displayJob.id,
        timeSeconds: frame.timeSeconds
      }
    })

    window.dispatchEvent(new CustomEvent('manthan:dashboard-refresh'))
    addToast({
      title: 'Frame saved to dashboard',
      tone: 'success'
    })
  }

  const handleCopyFrame = async (frame: { base64: string }): Promise<void> => {
    const dataUrl = `data:image/webp;base64,${frame.base64}`
    try {
      if ('ClipboardItem' in window) {
        const blob = await fetch(dataUrl).then((response) => response.blob())
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      } else {
        await navigator.clipboard.writeText(dataUrl)
      }
      addToast({ title: 'Frame copied', tone: 'success' })
    } catch {
      await navigator.clipboard.writeText(dataUrl)
      addToast({ title: 'Frame copied as data URL', tone: 'success' })
    }
  }

  const handleDownloadFrame = async (frame: {
    timeSeconds: number
    base64: string
  }): Promise<void> => {
    if (!window.manthan) return
    await window.manthan.saveMedia(
      frame.base64,
      buildMediaFilename(
        `frame-${Math.round(frame.timeSeconds * 10) / 10}s`,
        displayJob.id,
        'webp'
      ),
      'image/webp'
    )
    addToast({ title: 'Frame downloaded', tone: 'success' })
  }

  const handleToggleTimeline = (): void => {
    setTimelineOpen((open) => !open)
  }

  const handleAddJobToDashboard = async (groupJob: GenerationJob): Promise<void> => {
    if (groupJob.result?.data && window.manthan) {
      await window.manthan.saveAsset({
        projectId: activeProjectId ?? undefined,
        base64Data: groupJob.result.data,
        mimeType: groupJob.result.mimeType,
        filename: `extension-${groupJob.id}.${groupJob.result.mimeType.split('/')[1] || 'bin'}`,
        source: 'generated',
        metadata: {
          generationId: groupJob.id,
          prompt: groupJob.prompt,
          model: groupJob.model
        }
      })
    }
    window.dispatchEvent(new CustomEvent('manthan:dashboard-refresh'))
    addToast({ title: 'Added to dashboard', tone: 'success' })
  }

  const handleDownloadJob = async (groupJob: GenerationJob): Promise<void> => {
    if (!groupJob.result || !window.manthan) return
    const data =
      groupJob.result.data ||
      (groupJob.result.assetId ? await window.manthan.readAsset(groupJob.result.assetId) : null)
    if (!data) return
    const ext = groupJob.result.mimeType.split('/')[1] || 'bin'
    await window.manthan.saveMedia(
      data,
      buildMediaFilename(`manthan-${groupJob.type}`, groupJob.id, ext),
      groupJob.result.mimeType
    )
  }

  const handleDeleteJob = async (groupJob: GenerationJob): Promise<void> => {
    if (window.manthan?.deleteGeneration) await window.manthan.deleteGeneration(groupJob.id)
    useGenerationStore.getState().removeJob(groupJob.id)
    if (displayJobId === groupJob.id) setDisplayJobId(job.id)
    window.dispatchEvent(new CustomEvent('manthan:dashboard-refresh'))
  }

  const handleClose = (): void => {
    onClose()
  }

  const isCompleted = displayJob.status === 'completed'

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-6"
        >
          <motion.div
            layoutId={layoutId}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-bg-primary shadow-2xl"
          >
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/80 transition-colors hover:bg-black/75 hover:text-white"
            >
              <X className="h-4 w-4" />
              <span className="absolute -bottom-6 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/70">
                Esc
              </span>
            </button>

            <div className="grid h-full overflow-hidden lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex flex-col gap-5 overflow-y-auto p-6">
                {resolvingVideoSrc ? (
                  <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-black shadow-2xl">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                  </div>
                ) : (
                  <VideoPlayer
                    key={resolvedVideoSrc || displayJob.id}
                    src={resolvedVideoSrc}
                    assetId={displayJob.result?.assetId}
                    mimeType={displayJob.result?.mimeType}
                    autoPlay
                    seekTo={seekTo}
                    className="w-full rounded-2xl overflow-hidden aspect-video shadow-2xl bg-black [will-change:transform]"
                  />
                )}

                {isCompleted ? (
                  <div className="w-full overflow-hidden">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                        Frame Timeline
                      </p>
                      <button
                        type="button"
                        onClick={handleToggleTimeline}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
                      >
                        {timelineOpen ? 'Hide Frames' : 'Show Frames'}
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            timelineOpen ? 'rotate-180' : ''
                          )}
                        />
                      </button>
                    </div>
                    <AnimatePresence initial={false}>
                      {timelineOpen ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {timelineFrames.map((frame) => (
                              <div
                                key={`${displayJob.id}-${frame.timeSeconds}`}
                                className="group/frame w-[13.5rem] min-w-[13.5rem] overflow-hidden rounded-md border border-white/10 bg-black/35"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSeekToFrame(frame.timeSeconds)}
                                  className="relative block aspect-video w-full overflow-hidden"
                                >
                                  <img
                                    loading="lazy"
                                    src={`data:image/webp;base64,${frame.base64}`}
                                    alt={`${frame.timeSeconds.toFixed(1)}s`}
                                    className="h-full w-full object-cover transition-transform duration-200 group-hover/frame:scale-105"
                                  />
                                  <span className="absolute left-1 top-1 rounded bg-black/65 px-1 py-0.5 text-[9px] text-white/90">
                                    {formatFrameTime(frame.timeSeconds)}
                                  </span>
                                  <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-0.5 rounded-md bg-black/65 p-0.5 opacity-100 backdrop-blur-md transition-opacity sm:opacity-0 sm:group-hover/frame:opacity-100">
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void handleAddFrame(frame)
                                      }}
                                      className="flex h-5 w-5 items-center justify-center rounded text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </span>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void handleCopyFrame(frame)
                                      }}
                                      className="flex h-5 w-5 items-center justify-center rounded text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </span>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        void handleDownloadFrame(frame)
                                      }}
                                      className="flex h-5 w-5 items-center justify-center rounded text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                                    >
                                      <Download className="h-3 w-3" />
                                    </span>
                                  </span>
                                </button>
                              </div>
                            ))}
                            {timelineLoading && timelineFrames.length === 0 ? (
                              <div className="flex aspect-video w-[13.5rem] min-w-[13.5rem] items-center justify-center rounded-md border border-white/10 bg-white/5">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                              </div>
                            ) : null}
                            {timelineLoading && timelineFrames.length > 0 ? (
                              <span className="self-center whitespace-nowrap px-2 text-[11px] text-text-muted">
                                Extracting frames...
                              </span>
                            ) : null}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                ) : null}

                {isCompleted ? (
                  <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full">
                    <div className="flex bg-white/5 rounded-xl p-1 gap-1 self-start mb-0.5">
                      <span className="px-4 py-1.5 rounded-lg bg-white text-xs font-medium text-black shadow-sm">
                        {isVeoExtendable ? 'Extend Video' : 'Continue from Last Frame'}
                      </span>
                    </div>
                    <PromptInput
                      variant="lightbox"
                      value={localPrompt}
                      onChange={setLocalPrompt}
                      selectedModel={localModel}
                      onModelChange={setLocalModel}
                      onSubmit={
                        isCompleted && !submitting && !resolvingVideoSrc
                          ? handleExtensionSubmit
                          : undefined
                      }
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col border-l border-border bg-bg-secondary/30 w-full h-full">
                <div className="p-5 border-b border-border/50 space-y-2">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                    Active Generation
                  </p>
                  <p className="text-xs leading-relaxed text-text-secondary line-clamp-3">
                    {displayJob.prompt}
                  </p>
                  <div className="flex justify-between items-center text-[10px] text-text-muted mt-2">
                    <span>{formatJobConfig(displayJob)}</span>
                    <button
                      onClick={() => void handleDownload()}
                      className="hover:text-text-primary transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
                    Extension Timeline
                  </p>

                  {groupJobs.map((groupJob, index) => {
                    const isSelected = groupJob.id === displayJobId
                    const createdAt = new Date(
                      groupJob.completedAt ?? groupJob.startedAt
                    ).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                    return (
                      <div
                        key={groupJob.id}
                        onClick={() => setDisplayJobId(groupJob.id)}
                        className={cn(
                          'group cursor-pointer overflow-hidden rounded-xl border bg-bg-elevated/60 transition-all',
                          isSelected
                            ? 'border-accent/70 shadow-[0_0_0_1px_rgba(90,184,255,0.18)]'
                            : 'border-border-subtle hover:border-border'
                        )}
                      >
                        <div className="aspect-video bg-black relative">
                          {groupJob.result?.thumbnailPath ? (
                            <img
                              src={`asset:///${groupJob.result.thumbnailPath.replace(/\\/g, '/')}`}
                              alt="Thumbnail"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-bg-elevated text-text-muted">
                              <Film className="w-6 h-6 opacity-30" />
                            </div>
                          )}
                          {groupJob.status === 'generating' || groupJob.status === 'queued' ? (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-text-muted text-xs font-medium">
                              Generating...
                            </div>
                          ) : null}
                          <div className="absolute left-2 top-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                            Part {index + 1}
                          </div>
                          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium capitalize text-white/85 backdrop-blur-md">
                            {groupJob.status}
                          </div>
                          {typeof groupJob.config.capabilityValues.duration === 'number' ? (
                            <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/85 backdrop-blur-md">
                              {groupJob.config.capabilityValues.duration}s
                            </div>
                          ) : null}
                        </div>
                        <div className="space-y-2 p-3">
                          <p className="line-clamp-2 text-xs leading-5 text-text-secondary">
                            {groupJob.prompt}
                          </p>
                          <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
                            <span className="truncate">{groupJob.model}</span>
                            <span className="shrink-0">{createdAt}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleAddJobToDashboard(groupJob)
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
                              aria-label="Add to dashboard"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setLocalPrompt(groupJob.prompt)
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
                              aria-label="Reuse prompt"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void navigator.clipboard.writeText(groupJob.prompt)
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
                              aria-label="Copy prompt"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDownloadJob(groupJob)
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
                              aria-label="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDeleteJob(groupJob)
                              }}
                              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-error/10 hover:text-error"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
