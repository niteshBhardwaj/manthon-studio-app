import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { extname } from 'path'
import { appStore } from '../store/app-store'
import { assetManager, type Asset } from '../store/asset-manager'
import { databaseManager } from '../store/db'
import { jobProcessor } from './job-processor'
import { notifyBatchComplete, notifyJobComplete, notifyJobFailed } from '../notifications'
import type {
  EnqueueJobInput,
  QueueConfig,
  QueueJob,
  QueueJobCompletePayload,
  QueueJobFailedPayload,
  QueueJobProgressPayload,
  QueueJobResult,
  QueueState,
  QueueJobStatus,
  QueueJobType
} from './types'

const DEFAULT_CONFIG: QueueConfig = {
  concurrency: { video: 1, image: 2, audio: 2 },
  maxRetries: 2,
  retryDelayMs: 5_000
}

interface RunningJobContext {
  controller: AbortController
  cancel: (() => Promise<void>) | null
}

interface RawQueueJobRow {
  id: string
  project_id: string | null
  type: QueueJobType
  priority: number
  status: QueueJobStatus
  prompt: string
  negative_prompt: string
  provider: string
  model: string
  config: string
  input_assets: string
  result: string | null
  error: string | null
  retry_count: number
  max_retries: number
  created_at: number
  started_at: number | null
  completed_at: number | null
}

class QueueManager {
  private config: QueueConfig = { ...DEFAULT_CONFIG }
  private isPaused = false
  private interval: NodeJS.Timeout | null = null
  private isTicking = false
  private runningJobs = new Map<string, RunningJobContext>()
  private progressByJob = new Map<string, number>()
  private batchCompletedCount = 0

  initialize(config?: Partial<QueueConfig>): void {
    if (config) {
      this.config = {
        ...this.config,
        ...config,
        concurrency: {
          ...this.config.concurrency,
          ...(config.concurrency ?? {})
        }
      }
    }

    databaseManager.run(
      `UPDATE job_queue
       SET status = 'pending', started_at = NULL, completed_at = NULL, error = NULL
       WHERE status = 'running'`
    )

    if (!this.interval) {
      this.interval = setInterval(() => {
        void this.processNext()
      }, 1_000)
    }

    void this.emitQueueUpdate()
    void this.processNext()
  }

  shutdown(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    for (const running of this.runningJobs.values()) {
      running.controller.abort()
      void running.cancel?.()
    }

    this.runningJobs.clear()
    this.progressByJob.clear()
  }

  enqueue(input: EnqueueJobInput): QueueJob {
    const now = Date.now()
    const id = randomUUID()
    const priority = input.priority ?? now
    const maxRetries = input.maxRetries ?? this.config.maxRetries

    databaseManager.run(
      `INSERT INTO job_queue (
        id, project_id, type, priority, status, prompt, negative_prompt, provider, model,
        config, input_assets, retry_count, max_retries, created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id,
        input.projectId ?? 'default',
        input.type,
        priority,
        input.prompt,
        input.negativePrompt ?? '',
        input.provider,
        input.model,
        JSON.stringify(input.config),
        JSON.stringify(input.inputAssets ?? []),
        maxRetries,
        now
      ]
    )

    const job = this.getJob(id)
    if (!job) {
      throw new Error('Failed to create queue job')
    }

    void this.emitQueueUpdate()
    void this.processNext()

    return job
  }

  async processNext(): Promise<void> {
    if (this.isPaused || this.isTicking) return

    this.isTicking = true
    try {
      for (const type of ['video', 'image', 'audio'] as QueueJobType[]) {
        while (this.activeCountForType(type) < this.config.concurrency[type]) {
          const nextJob = this.getNextPendingJob(type)
          if (!nextJob) break
          this.startJob(nextJob)
        }
      }
    } finally {
      this.isTicking = false
    }
  }

  pause(): { success: boolean } {
    this.isPaused = true
    void this.emitQueueUpdate()
    return { success: true }
  }

  resume(): { success: boolean } {
    this.isPaused = false
    void this.emitQueueUpdate()
    void this.processNext()
    return { success: true }
  }

  async cancelJob(id: string): Promise<{ success: boolean }> {
    const running = this.runningJobs.get(id)
    if (running) {
      running.controller.abort()
      await running.cancel?.()
      this.runningJobs.delete(id)
    }

    this.progressByJob.delete(id)
    databaseManager.run(
      `UPDATE job_queue
       SET status = 'cancelled', error = 'Cancelled by user', completed_at = ?
       WHERE id = ?`,
      [Date.now(), id]
    )

    void this.emitQueueUpdate()
    void this.processNext()
    return { success: true }
  }

  reorderJob(id: string, newPriority: number): { success: boolean } {
    databaseManager.run('UPDATE job_queue SET priority = ? WHERE id = ?', [newPriority, id])
    void this.emitQueueUpdate()
    return { success: true }
  }

  retryJob(id: string): { success: boolean } {
    databaseManager.run(
      `UPDATE job_queue
       SET status = 'pending',
           error = NULL,
           result = NULL,
           started_at = NULL,
           completed_at = NULL,
           retry_count = retry_count + 1,
           priority = ?
       WHERE id = ?`,
      [Date.now(), id]
    )

    this.progressByJob.delete(id)
    void this.emitQueueUpdate()
    void this.processNext()
    return { success: true }
  }

  clearCompleted(): { success: boolean } {
    databaseManager.run(`DELETE FROM job_queue WHERE status = 'completed'`)
    void this.emitQueueUpdate()
    return { success: true }
  }

  deleteJob(id: string): { success: boolean } {
    if (this.runningJobs.has(id)) {
      throw new Error('Cannot delete a running job')
    }

    databaseManager.run('DELETE FROM job_queue WHERE id = ?', [id])
    this.progressByJob.delete(id)
    void this.emitQueueUpdate()
    return { success: true }
  }

  getQueueState(): QueueState {
    const jobs = databaseManager
      .query<RawQueueJobRow>(
        `SELECT *
         FROM job_queue
         ORDER BY
           CASE status
             WHEN 'running' THEN 0
             WHEN 'pending' THEN 1
             WHEN 'completed' THEN 2
             WHEN 'failed' THEN 3
             ELSE 4
           END,
           priority DESC,
           created_at ASC`
      )
      .map((row) => this.hydrate(row))

    const grouped: QueueState['grouped'] = {
      pending: [],
      running: [],
      completed: [],
      failed: [],
      cancelled: []
    }

    for (const job of jobs) {
      grouped[job.status].push(job)
    }

    return {
      jobs,
      grouped,
      isPaused: this.isPaused,
      counts: {
        pending: grouped.pending.length,
        running: grouped.running.length,
        completed: grouped.completed.length,
        failed: grouped.failed.length,
        cancelled: grouped.cancelled.length
      }
    }
  }

  private startJob(job: QueueJob): void {
    const now = Date.now()
    const controller = new AbortController()

    this.runningJobs.set(job.id, { controller, cancel: null })
    this.progressByJob.set(job.id, 0)

    databaseManager.run(
      `UPDATE job_queue
       SET status = 'running', started_at = ?, completed_at = NULL, error = NULL
       WHERE id = ?`,
      [now, job.id]
    )

    void this.emitQueueUpdate()
    this.emitToWindows('queue:job-progress', {
      jobId: job.id,
      progress: 0,
      status: 'running'
    } satisfies QueueJobProgressPayload)

    void (async () => {
      try {
        const freshJob = this.getJob(job.id)
        if (!freshJob) {
          throw new Error(`Queue job ${job.id} disappeared`)
        }

        const result = await jobProcessor.processJob(freshJob, {
          signal: controller.signal,
          onProgress: (payload) => this.handleProgress(payload),
          registerCancel: (cancel) => {
            const running = this.runningJobs.get(job.id)
            if (running) {
              running.cancel = cancel
            }
          }
        })

        await this.onJobComplete(job.id, result)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Queue processing failed'
        if (message === 'Job cancelled') {
          await this.cancelJob(job.id)
          return
        }
        await this.onJobFailed(job.id, message)
      }
    })()
  }

  private handleProgress(payload: QueueJobProgressPayload): void {
    this.progressByJob.set(payload.jobId, payload.progress)
    this.emitToWindows('queue:job-progress', payload)
    void this.emitQueueUpdate()
  }

  private async onJobComplete(id: string, result: QueueJobResult): Promise<void> {
    const job = this.getJob(id)
    if (!job) return

    this.runningJobs.delete(id)
    this.progressByJob.delete(id)
    this.batchCompletedCount += 1

    const completedAt = Date.now()
    const asset = await this.persistResultAsset(job, result)
    const storedResult: QueueJobResult = {
      ...result,
      assetId: asset?.id ?? result.assetId,
      assetPath: asset?.storage_path ?? result.assetPath,
      thumbnailPath: asset?.thumbnail_path ?? result.thumbnailPath,
      filename: asset?.filename ?? result.filename
    }

    databaseManager.run(
      `UPDATE job_queue
       SET status = 'completed', result = ?, error = NULL, completed_at = ?
       WHERE id = ?`,
      [JSON.stringify(storedResult), completedAt, id]
    )

    appStore.addToHistory({
      id: job.id,
      provider: job.provider,
      type: job.type,
      status: 'completed',
      prompt: job.prompt,
      progress: 100,
      startedAt: job.started_at ?? job.created_at,
      completedAt,
      result: {
        type: storedResult.type,
        data: storedResult.data ?? '',
        mimeType: storedResult.mimeType ?? 'application/octet-stream',
        uri: storedResult.uri,
        duration: storedResult.duration,
        metadata: storedResult.metadata
      },
      _operationName: job.model
    })

    const completedJob = this.getJob(id)
    if (completedJob) {
      notifyJobComplete(completedJob)
      this.emitToWindows('queue:job-complete', {
        jobId: id,
        job: completedJob,
        result: storedResult
      } satisfies QueueJobCompletePayload)
    }

    await this.emitQueueUpdate()
    this.notifyIfBatchFinished()
    await this.processNext()
  }

  private async onJobFailed(id: string, error: string): Promise<void> {
    const job = this.getJob(id)
    if (!job) return

    this.runningJobs.delete(id)
    this.progressByJob.delete(id)

    if (job.retry_count < job.max_retries) {
      databaseManager.run(
        `UPDATE job_queue
         SET status = 'pending',
             error = ?,
             started_at = NULL,
             completed_at = NULL,
             retry_count = retry_count + 1,
             priority = ?
         WHERE id = ?`,
        [error, Date.now(), id]
      )

      await this.emitQueueUpdate()
      setTimeout(() => {
        void this.processNext()
      }, this.config.retryDelayMs)
      return
    }

    const completedAt = Date.now()
    databaseManager.run(
      `UPDATE job_queue
       SET status = 'failed', error = ?, completed_at = ?
       WHERE id = ?`,
      [error, completedAt, id]
    )

    appStore.addToHistory({
      id: job.id,
      provider: job.provider,
      type: job.type,
      status: 'failed',
      prompt: job.prompt,
      progress: this.progressByJob.get(job.id) ?? 0,
      error,
      startedAt: job.started_at ?? job.created_at,
      completedAt,
      _operationName: job.model
    })

    const failedJob = this.getJob(id)
    if (failedJob) {
      notifyJobFailed(failedJob)
      this.emitToWindows('queue:job-failed', {
        jobId: id,
        job: failedJob,
        error
      } satisfies QueueJobFailedPayload)
    }

    await this.emitQueueUpdate()
    await this.processNext()
  }

  private async persistResultAsset(job: QueueJob, result: QueueJobResult): Promise<Asset | null> {
    try {
      if (result.data && result.mimeType) {
        return await assetManager.saveBase64Asset({
          projectId: job.project_id,
          base64Data: result.data,
          mimeType: result.mimeType,
          filename: this.buildFilename(job, result.mimeType),
          source: 'generated',
          metadata: {
            jobId: job.id,
            prompt: job.prompt,
            provider: job.provider,
            model: job.model,
            resultMetadata: result.metadata ?? {}
          }
        })
      }

      if (result.uri) {
        const response = await fetch(result.uri)
        if (!response.ok) {
          throw new Error(`Failed to download result asset: ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        const mimeType = response.headers.get('content-type') || result.mimeType || 'video/mp4'

        return await assetManager.saveAsset({
          projectId: job.project_id,
          buffer: Buffer.from(arrayBuffer),
          mimeType,
          filename: this.buildFilename(job, mimeType, result.uri),
          source: 'generated',
          metadata: {
            jobId: job.id,
            prompt: job.prompt,
            provider: job.provider,
            model: job.model,
            sourceUri: result.uri,
            resultMetadata: result.metadata ?? {}
          }
        })
      }
    } catch (error) {
      console.warn(`[QueueManager] Failed to persist asset for ${job.id}:`, error)
    }

    return null
  }

  private buildFilename(job: QueueJob, mimeType: string, uri?: string): string {
    const extensionFromMime = mimeType.split('/')[1]
    const extensionFromUri = uri ? extname(new URL(uri).pathname) : ''
    const extension = extensionFromUri || (extensionFromMime ? `.${extensionFromMime}` : '')
    return `${job.type}-${job.model}-${job.id}${extension}`
  }

  private getJob(id: string): QueueJob | null {
    const row = databaseManager.queryOne<RawQueueJobRow>('SELECT * FROM job_queue WHERE id = ?', [
      id
    ])
    return row ? this.hydrate(row) : null
  }

  private getNextPendingJob(type: QueueJobType): QueueJob | null {
    const row = databaseManager.queryOne<RawQueueJobRow>(
      `SELECT *
       FROM job_queue
       WHERE status = 'pending' AND type = ?
       ORDER BY priority DESC, created_at ASC
       LIMIT 1`,
      [type]
    )

    return row ? this.hydrate(row) : null
  }

  private activeCountForType(type: QueueJobType): number {
    let count = 0
    for (const jobId of this.runningJobs.keys()) {
      const job = this.getJob(jobId)
      if (job?.type === type) {
        count += 1
      }
    }
    return count
  }

  private hydrate(row: RawQueueJobRow): QueueJob {
    return {
      ...row,
      config: this.parseJSON(row.config, {
        contentType: row.type,
        activeMode: null,
        batchCount: 1,
        capabilityValues: {},
        providerParams: { prompt: row.prompt, model: row.model }
      }),
      input_assets: this.parseJSON(row.input_assets, []),
      result: this.parseJSON(row.result, null),
      progress:
        row.status === 'completed'
          ? 100
          : row.status === 'failed' || row.status === 'cancelled'
            ? (this.progressByJob.get(row.id) ?? 0)
            : (this.progressByJob.get(row.id) ?? 0)
    }
  }

  private parseJSON<T>(value: string | null, fallback: T): T {
    if (!value) return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  private async emitQueueUpdate(): Promise<void> {
    this.emitToWindows('queue:update', this.getQueueState())
  }

  private emitToWindows(channel: string, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, payload)
      }
    }
  }

  private notifyIfBatchFinished(): void {
    const state = this.getQueueState()
    if (state.counts.pending === 0 && state.counts.running === 0 && this.batchCompletedCount > 0) {
      notifyBatchComplete(this.batchCompletedCount)
      this.batchCompletedCount = 0
    }
  }
}

export const queueManager = new QueueManager()
