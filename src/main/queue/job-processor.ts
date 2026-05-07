import type { AudioGenParams, ImageGenParams, VideoGenParams } from '../providers/base'
import { providerRegistry } from '../providers/registry'
import type {
  QueueJob,
  QueueJobConfigPayload,
  QueueJobProgressPayload,
  QueueJobResult
} from './types'
import { logger } from '../logger'

interface ProcessJobOptions {
  signal: AbortSignal
  onProgress: (payload: QueueJobProgressPayload) => void
  registerCancel: (handler: (() => Promise<void>) | null) => void
}

const VIDEO_POLL_INTERVAL_MS = 10_000
const VIDEO_TIMEOUT_MS = 20 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000

export class JobProcessor {
  async processJob(job: QueueJob, options: ProcessJobOptions): Promise<QueueJobResult> {
    logger.debug('Queue', `Processing job: ${job.id} (${job.type})`)
    switch (job.type) {
      case 'video':
        return this.processVideoJob(job, options)
      case 'image':
        return this.processImageJob(job, options)
      case 'audio':
        return this.processAudioJob(job, options)
      default:
        throw new Error(`Unsupported job type: ${String(job.type)}`)
    }
  }

  private async processVideoJob(
    job: QueueJob,
    options: ProcessJobOptions
  ): Promise<QueueJobResult> {
    const provider = providerRegistry.get(job.provider)
    if (!provider?.generateVideo || !provider.pollOperation) {
      throw new Error(`Provider ${job.provider} does not support video generation`)
    }

    const params = this.getProviderParams<VideoGenParams>(job.config)
    const operation = await this.withTimeout(
      provider.generateVideo(params),
      DEFAULT_TIMEOUT_MS,
      `Video generation for ${job.id}`,
      options.signal
    )

    logger.debug('Queue', `Video generation operation started: ${operation.id}`, { operation })

    if (operation.status === 'failed') {
      throw new Error(operation.error || 'Video generation failed')
    }

    if (provider.cancelOperation) {
      options.registerCancel(async () => {
        if (operation.id) {
          await provider.cancelOperation!(operation.id)
        }
      })
    }

    const startedAt = Date.now()
    let attempts = 0

    while (Date.now() - startedAt < VIDEO_TIMEOUT_MS) {
      this.throwIfAborted(options.signal)

      const pollResult = await this.withTimeout(
        provider.pollOperation(operation.id),
        DEFAULT_TIMEOUT_MS,
        `Video poll for ${job.id}`,
        options.signal
      )

      logger.debug('Queue', `Video polling result for ${job.id}: ${pollResult.status}`, { pollResult })

      if (pollResult.status === 'completed' && pollResult.result) {
        options.onProgress({ jobId: job.id, progress: 100, status: 'running' })
        return {
          ...pollResult.result,
          type: 'video'
        }
      }

      if (pollResult.status === 'failed') {
        throw new Error(pollResult.error || 'Video generation failed while polling')
      }

      attempts += 1
      options.onProgress({
        jobId: job.id,
        progress: Math.min(10 + attempts * 8, 95),
        status: 'running'
      })

      await this.sleep(VIDEO_POLL_INTERVAL_MS, options.signal)
    }

    throw new Error('Video generation timed out')
  }

  private async processImageJob(
    job: QueueJob,
    options: ProcessJobOptions
  ): Promise<QueueJobResult> {
    const provider = providerRegistry.get(job.provider)
    if (!provider?.generateImage) {
      throw new Error(`Provider ${job.provider} does not support image generation`)
    }

    options.onProgress({ jobId: job.id, progress: 20, status: 'running' })
    const result = await this.withTimeout(
      provider.generateImage(this.getProviderParams<ImageGenParams>(job.config)),
      DEFAULT_TIMEOUT_MS,
      `Image generation for ${job.id}`,
      options.signal
    )
    options.onProgress({ jobId: job.id, progress: 100, status: 'running' })

    return {
      ...result,
      type: 'image'
    }
  }

  private async processAudioJob(
    job: QueueJob,
    options: ProcessJobOptions
  ): Promise<QueueJobResult> {
    const provider = providerRegistry.get(job.provider)
    if (!provider?.generateAudio) {
      throw new Error(`Provider ${job.provider} does not support audio generation`)
    }

    options.onProgress({ jobId: job.id, progress: 20, status: 'running' })
    const result = await this.withTimeout(
      provider.generateAudio(this.getProviderParams<AudioGenParams>(job.config)),
      DEFAULT_TIMEOUT_MS,
      `Audio generation for ${job.id}`,
      options.signal
    )
    options.onProgress({ jobId: job.id, progress: 100, status: 'running' })

    return {
      ...result,
      type: 'audio'
    }
  }

  private getProviderParams<T extends VideoGenParams | ImageGenParams | AudioGenParams>(
    config: QueueJobConfigPayload
  ): T {
    return config.providerParams as T
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
    signal: AbortSignal
  ): Promise<T> {
    this.throwIfAborted(signal)

    return await new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)

      const abortHandler = (): void => {
        clearTimeout(timeout)
        reject(new Error('Job cancelled'))
      }

      signal.addEventListener('abort', abortHandler, { once: true })

      promise
        .then((value) => {
          clearTimeout(timeout)
          signal.removeEventListener('abort', abortHandler)
          resolve(value)
        })
        .catch((error) => {
          clearTimeout(timeout)
          signal.removeEventListener('abort', abortHandler)
          reject(error)
        })
    })
  }

  private async sleep(ms: number, signal: AbortSignal): Promise<void> {
    this.throwIfAborted(signal)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        signal.removeEventListener('abort', abortHandler)
        resolve()
      }, ms)

      const abortHandler = (): void => {
        clearTimeout(timeout)
        reject(new Error('Job cancelled'))
      }

      signal.addEventListener('abort', abortHandler, { once: true })
    })
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new Error('Job cancelled')
    }
  }
}

export const jobProcessor = new JobProcessor()
