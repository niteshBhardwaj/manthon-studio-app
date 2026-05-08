import type { QueueJob } from '../../../main/queue/types'
import { buildPayload } from './build-payload'
import type { BinaryInput, GenerationJob } from '../stores/generation-store'
import { useAppStore } from '../stores/app-store'

interface EnqueueGenerationArgs {
  groupId?: string
  prompt: string
  negativePrompt?: string
  selectedModel: string
  capabilityValues: Record<string, string | number | boolean>
  startFrame: BinaryInput | null
  endFrame: BinaryInput | null
  videoInput: BinaryInput | null
  referenceImages: BinaryInput[]
  batchCount: number
  activeMode: string | null
  activeProjectId: string | null
}

export function queueJobToGenerationJob(job: QueueJob): GenerationJob {
  const startFrame = job.input_assets.find((asset) => asset.referenceType === 'start-frame')
  const endFrame = job.input_assets.find((asset) => asset.referenceType === 'end-frame')
  const referenceImages = job.input_assets.filter((asset) => asset.referenceType === 'reference')

  return {
    id: job.id,
    groupId: job.group_id,
    type: job.type,
    status: job.status === 'running' ? 'generating' : job.status === 'pending' ? 'queued' : 'idle',
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
    image: startFrame ? { data: startFrame.data, mimeType: startFrame.mimeType, metadata: startFrame.metadata } : undefined,
    lastFrame: endFrame ? { data: endFrame.data, mimeType: endFrame.mimeType, metadata: endFrame.metadata } : undefined,
    referenceImages: referenceImages.map((asset) => ({
      data: asset.data,
      mimeType: asset.mimeType,
      metadata: asset.metadata
    })),
    progress: job.progress ?? (job.status === 'pending' ? 0 : 8),
    startedAt: job.started_at ?? job.created_at,
    completedAt: job.completed_at ?? undefined,
    error: job.error ?? undefined
  }
}

export async function enqueueGeneration({
  groupId,
  prompt,
  negativePrompt,
  selectedModel,
  capabilityValues,
  startFrame,
  endFrame,
  videoInput,
  referenceImages,
  batchCount,
  activeMode,
  activeProjectId
}: EnqueueGenerationArgs): Promise<GenerationJob[]> {
  if (!window.manthan) {
    throw new Error('Desktop bridge unavailable')
  }

  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    throw new Error('Prompt is required')
  }

  const createdJobs: GenerationJob[] = []
  const totalRequests = Math.max(1, batchCount)

  for (let index = 0; index < totalRequests; index += 1) {
    const payload = buildPayload({
      prompt: trimmedPrompt,
      negativePrompt,
      selectedModel,
      capabilityValues,
      startFrame,
      endFrame,
      videoInput,
      referenceImages,
      batchCount: 1,
      activeMode
    })

    await window.manthan.setActiveProvider(payload.providerId)

    const queueInput = {
      projectId: activeProjectId,
      groupId,
      type: payload.contentType,
      prompt: payload.params.prompt,
      negativePrompt: 'negativePrompt' in payload.params ? payload.params.negativePrompt : undefined,
      provider: payload.providerId,
      model: selectedModel,
      config: {
        contentType: payload.contentType,
        activeMode,
        batchCount: 1,
        capabilityValues: { ...capabilityValues, batch_count: 1 },
        providerParams: payload.params
      },
      inputAssets: [
        ...(startFrame ? [{ ...startFrame, referenceType: 'start-frame' as const }] : []),
        ...(endFrame ? [{ ...endFrame, referenceType: 'end-frame' as const }] : []),
        ...(videoInput ? [{ ...videoInput, referenceType: 'video-extend' as const }] : []),
        ...referenceImages.map((image) => ({
          ...image,
          referenceType: 'reference' as const
        }))
      ]
    }

    let created: QueueJob
    if (payload.contentType === 'image') {
      created = await window.manthan.generateImage(queueInput)
    } else if (payload.contentType === 'audio') {
      created = await window.manthan.generateAudio(queueInput)
    } else {
      created = await window.manthan.generateVideo(queueInput)
    }

    createdJobs.push(queueJobToGenerationJob(created))
  }

  useAppStore.getState().addToast({
    title: 'Generation started',
    message: `${createdJobs.length} ${createdJobs.length === 1 ? 'job' : 'jobs'} added to the queue`,
    tone: 'info'
  })

  return createdJobs
}
