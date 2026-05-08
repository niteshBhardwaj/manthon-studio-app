import { type JSX, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, Film, Sparkles, X, Zap } from 'lucide-react'
import type { GenerationJob } from '../../stores/generation-store'
import { useGenerationStore } from '../../stores/generation-store'
import { Button } from '../ui/button'
import { VideoPlayer } from './VideoPlayer'
import { PromptInput } from '../generation/PromptInput'
import { enqueueGeneration } from '../../lib/enqueue-generation'
import { extractFrameAtTime } from '../../lib/video-utils'
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

type ExtensionMode = 'extend' | 'lastframe' | null

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
  const [submitting, setSubmitting] = useState(false)
  const [extensionMode, setExtensionMode] = useState<'true_extend' | 'last_frame'>('true_extend')
  const [localPrompt, setLocalPrompt] = useState('')
  const [localModel, setLocalModel] = useState(job.model)

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

  // Determine if the video supports true Veo extension
  const isVeoExtendable = useMemo(() => {
    if (displayJob.status !== 'completed') return false
    if (displayJob.provider !== 'google-veo') return false
    const modelDescriptor = getModelById(displayJob.model)
    return modelDescriptor?.supportsVideoExtension === true
  }, [displayJob.model, displayJob.provider, displayJob.status])

  useEffect(() => {
    if (isOpen) {
      setDisplayJobId(job.id)
      setLocalPrompt('')
      setLocalModel(job.model)

      // Fetch siblings if this job is part of a group
      const rootId = job.groupId || job.id
      if (window.manthan?.listGenerations) {
        window.manthan.listGenerations({ groupId: rootId }).then((results) => {
          if (results && results.length > 0) {
            // Map StoredGeneration to GenerationJob
            const groupJobs = results.map((g) => ({
              id: g.id,
              groupId: g.group_id,
              type: g.type,
              status: g.status,
              prompt: g.prompt,
              negativePrompt: g.negative_prompt,
              provider: g.provider,
              model: g.model,
              config: JSON.parse(g.config || '{}'),
              result: g.result_asset_id
                ? {
                    type: g.type,
                    assetId: g.result_asset_id,
                    mimeType: g.mimeType || 'video/mp4',
                    thumbnailPath: g.thumbnailPath
                  }
                : undefined,
              progress: g.progress,
              startedAt: g.startedAt,
              completedAt: g.completedAt
            }))
            useGenerationStore.getState().addJobs(groupJobs as any)
          }
        })
      }
    }
  }, [isOpen, job])

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

  // True Veo extension — sends full video binary
  const handleExtendVideo = async (): Promise<void> => {
    if (!localPrompt.trim() || !displayJob.result) return

    setSubmitting(true)
    try {
      let videoBase64 = displayJob.result.data
      if (!videoBase64 && displayJob.result.assetId && window.manthan?.readAsset) {
        try {
          videoBase64 = await window.manthan.readAsset(displayJob.result.assetId)
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

  // Last frame continue — extracts last frame → image-to-video
  const handleLastFrameContinue = async (): Promise<void> => {
    if (!localPrompt.trim() || !displayJob.result) return

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
        groupId: displayJob.groupId || displayJob.id,
        prompt: localPrompt.trim(),
        negativePrompt: '',
        selectedModel: localModel,
        capabilityValues: displayJob.config.capabilityValues,
        startFrame: {
          data: base64Data,
          mimeType: 'image/png'
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
        title: 'Generation failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleExtensionSubmit = async (): Promise<void> => {
    if (extensionMode === 'true_extend' && isVeoExtendable) {
      await handleExtendVideo()
    } else {
      await handleLastFrameContinue()
    }
  }

  const handleClose = () => {
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
              onClick={handleClose}
              className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid h-full overflow-hidden lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex flex-col gap-5 overflow-y-auto p-6">
                <VideoPlayer
                  src={getJobSrc(displayJob)}
                  assetId={displayJob.result?.assetId}
                  mimeType={displayJob.result?.mimeType}
                  autoPlay
                  className="w-full rounded-2xl overflow-hidden aspect-video shadow-2xl bg-black"
                />

                <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full">
                  <div className="flex bg-white/5 rounded-xl p-1 gap-1 self-start mb-0.5">
                    {isVeoExtendable ? (
                      <button 
                        onClick={() => setExtensionMode('true_extend')}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                          extensionMode === 'true_extend' ? "bg-white text-black shadow-sm" : "text-text-muted hover:text-text-primary"
                        )}
                      >
                        Extend Video
                      </button>
                    ) : null}
                    <button 
                      onClick={() => setExtensionMode('last_frame')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                        extensionMode === 'last_frame' ? "bg-white text-black shadow-sm" : "text-text-muted hover:text-text-primary"
                      )}
                    >
                      Last Frame Extend
                    </button>
                  </div>
                  <PromptInput 
                    variant="lightbox" 
                    value={localPrompt}
                    onChange={setLocalPrompt}
                    selectedModel={localModel}
                    onModelChange={setLocalModel}
                    onSubmit={isCompleted && !submitting ? handleExtensionSubmit : undefined}
                  />
                </div>
              </div>

              <div className="flex flex-col border-l border-border bg-bg-secondary/30 w-full h-full">
                <div className="p-5 border-b border-border/50 space-y-2">
                   <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Active Generation</p>
                   <p className="text-xs leading-relaxed text-text-secondary line-clamp-3">{displayJob.prompt}</p>
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
                  <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">Extension Timeline</p>
                  
                  {groupJobs.map((groupJob, index) => {
                    const isSelected = groupJob.id === displayJobId
                    return (
                      <div 
                        key={groupJob.id}
                        onClick={() => setDisplayJobId(groupJob.id)}
                        className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                          isSelected ? "border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "border-border/50 hover:border-white/20"
                        }`}
                      >
                         <div className="aspect-video bg-black relative">
                            {groupJob.result?.thumbnailPath ? (
                              <img 
                                src={`asset://${groupJob.result.thumbnailPath}`} 
                                alt="Thumbnail" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-bg-elevated text-text-muted">
                                <Film className="w-6 h-6 opacity-30" />
                              </div>
                            )}
                            {groupJob.status === 'generating' ? (
                               <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-text-muted text-xs font-medium">
                                 Generating...
                               </div>
                            ) : null}
                         </div>
                         <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                           Part {index + 1}
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
