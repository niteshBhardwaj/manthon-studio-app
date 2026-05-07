import { type JSX, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, Sparkles, X } from 'lucide-react'
import type { GenerationJob } from '../../stores/generation-store'
import { useGenerationStore } from '../../stores/generation-store'
import { Button } from '../ui/button'
import { VideoPlayer } from './VideoPlayer'
import { enqueueGeneration } from '../../lib/enqueue-generation'
import { extractFrameAtTime } from '../../lib/video-utils'
import { useProjectStore } from '../../stores/project-store'
import { useAppStore } from '../../stores/app-store'

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

export function VideoLightbox({
  job,
  isOpen,
  onClose
}: {
  job: GenerationJob
  isOpen: boolean
  onClose: () => void
}): JSX.Element {
  const jobs = useGenerationStore((state) => state.jobs)
  const { setExtendingJobId, updateJob, loadJobIntoPrompt } = useGenerationStore()
  const { activeProjectId } = useProjectStore()
  const { addToast } = useAppStore()
  const [displayJobId, setDisplayJobId] = useState(job.id)
  const [extendPrompt, setExtendPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const displayJob = useMemo(
    () => jobs.find((item) => item.id === displayJobId) ?? job,
    [displayJobId, job, jobs]
  )

  useEffect(() => {
    if (isOpen) {
      setDisplayJobId(job.id)
      setExtendingJobId(job.id)
      loadJobIntoPrompt(job, { extend: true })
    } else {
      setExtendingJobId(null)
      setExtendPrompt('')
    }
  }, [isOpen, job, loadJobIntoPrompt, setExtendingJobId])

  const handleDownload = async (): Promise<void> => {
    if (!displayJob.result || !window.manthan) return
    const ext = displayJob.result.mimeType.split('/')[1] || 'bin'
    await window.manthan.saveMedia(
      displayJob.result.data,
      `manthan-${displayJob.type}-${Date.now()}.${ext}`,
      displayJob.result.mimeType
    )
    addToast({
      title: 'Video downloaded',
      tone: 'success'
    })
  }

  const handleExtend = async (): Promise<void> => {
    if (!extendPrompt.trim() || !displayJob.result) return

    const src = getJobSrc(displayJob)
    if (!src) return

    setSubmitting(true)
    try {
      const lastFrameDataUrl = await extractFrameAtTime(src, Number.MAX_SAFE_INTEGER)
      const [, base64Data = ''] = lastFrameDataUrl.split(',')

      updateJob(displayJob.id, {
        lastFrame: {
          data: base64Data,
          mimeType: 'image/png'
        }
      })

      const createdJobs = await enqueueGeneration({
        prompt: extendPrompt.trim(),
        negativePrompt: '',
        selectedModel: displayJob.model,
        capabilityValues: displayJob.config.capabilityValues,
        startFrame: null,
        endFrame: {
          data: base64Data,
          mimeType: 'image/png'
        },
        referenceImages: [],
        batchCount: 1,
        activeMode: 'frames',
        activeProjectId
      })

      if (createdJobs[0]) {
        useGenerationStore.getState().addJob(createdJobs[0])
        setDisplayJobId(createdJobs[0].id)
        setExtendingJobId(createdJobs[0].id)
        setExtendPrompt('')
      }
    } catch (error) {
      addToast({
        title: 'Generation failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error'
      })
    } finally {
      setSubmitting(false)
    }
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
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-bg-primary shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-5">
                <VideoPlayer
                  src={getJobSrc(displayJob)}
                  assetId={displayJob.result?.assetId}
                  mimeType={displayJob.result?.mimeType}
                  autoPlay
                  className="aspect-video w-full"
                />

                <div className="space-y-2">
                  <p className="text-sm leading-6 text-text-secondary">{displayJob.prompt}</p>
                  <p className="text-xs text-text-muted">{formatJobConfig(displayJob)}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-[1.5rem] border border-border-subtle bg-bg-secondary/70 p-4">
                  <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                    Actions
                  </div>
                  <div className="grid gap-2">
                    <Button variant="outline" className="justify-start" onClick={() => inputRef.current?.focus()}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Extend
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => void handleDownload()}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-border-subtle bg-bg-secondary/70 p-4">
                  <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
                    Continue This Video
                  </div>
                  <textarea
                    ref={inputRef}
                    value={extendPrompt}
                    onChange={(event) => setExtendPrompt(event.target.value)}
                    placeholder="Describe how to continue this video..."
                    rows={5}
                    className="min-h-28 w-full resize-none rounded-2xl border border-border-subtle bg-bg-input px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border"
                  />
                  <Button
                    className="mt-3 w-full"
                    onClick={() => void handleExtend()}
                    disabled={!extendPrompt.trim() || submitting || displayJob.status !== 'completed'}
                  >
                    {submitting ? 'Starting extension...' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
