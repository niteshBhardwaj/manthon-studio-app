import { create } from 'zustand'
import type {
  QueueJob,
  QueueJobCompletePayload,
  QueueJobFailedPayload,
  QueueJobProgressPayload,
  QueueState
} from '../../../main/queue/types'
import { useAppStore } from './app-store'

interface QueueStoreState {
  jobs: QueueJob[]
  isPaused: boolean
  initialized: boolean
  loadQueue: () => Promise<void>
  initialize: () => Promise<void>
  pauseQueue: () => Promise<void>
  resumeQueue: () => Promise<void>
  cancelJob: (id: string) => Promise<void>
  retryJob: (id: string) => Promise<void>
  reorderJob: (id: string, newIndex: number) => Promise<void>
  clearCompleted: () => Promise<void>
  deleteJob: (id: string) => Promise<void>
}

let queueSubscriptionsBound = false

function applyQueueState(state: QueueState): Pick<QueueStoreState, 'jobs' | 'isPaused'> {
  return {
    jobs: state.jobs,
    isPaused: state.isPaused
  }
}

type QueueStoreSet =
  | Partial<QueueStoreState>
  | ((state: QueueStoreState) => Partial<QueueStoreState>)

function bindQueueSubscriptions(set: (partial: QueueStoreSet) => void): void {
  if (queueSubscriptionsBound || !window.manthan) return

  queueSubscriptionsBound = true

  window.manthan.onQueueUpdate((state) => {
    set(applyQueueState(state))
  })

  window.manthan.onQueueJobProgress((payload: QueueJobProgressPayload) => {
    set((current) => ({
      jobs: current.jobs.map((job) =>
        job.id === payload.jobId
          ? {
              ...job,
              status: payload.status,
              progress: payload.progress
            }
          : job
      )
    }))
  })

  window.manthan.onQueueJobComplete((payload: QueueJobCompletePayload) => {
    set((current) => ({
      jobs: current.jobs.map((job) =>
        job.id === payload.jobId
          ? {
              ...payload.job,
              result: payload.result,
              progress: 100
            }
          : job
      )
    }))
  })

  window.manthan.onQueueJobFailed((payload: QueueJobFailedPayload) => {
    set((current) => ({
      jobs: current.jobs.map((job) =>
        job.id === payload.jobId
          ? {
              ...payload.job,
              error: payload.error
            }
          : job
      )
    }))
  })
}

export const useQueueStore = create<QueueStoreState>((set, get) => ({
  jobs: [],
  isPaused: false,
  initialized: false,

  loadQueue: async () => {
    if (!window.manthan) return
    const state = await window.manthan.listQueue()
    set(applyQueueState(state))
  },

  initialize: async () => {
    if (!window.manthan) return
    bindQueueSubscriptions(set)
    if (!get().initialized) {
      set({ initialized: true })
    }
    await get().loadQueue()
  },

  pauseQueue: async () => {
    if (!window.manthan) return
    await window.manthan.pauseQueue()
    set({ isPaused: true })
  },

  resumeQueue: async () => {
    if (!window.manthan) return
    await window.manthan.resumeQueue()
    set({ isPaused: false })
  },

  cancelJob: async (id) => {
    if (!window.manthan) return
    try {
      await window.manthan.cancelQueueJob(id)
      await get().loadQueue()
    } catch (error) {
      useAppStore.getState().addToast({
        title: 'Cancel failed',
        message: error instanceof Error ? error.message : String(error),
        tone: 'error'
      })
      throw error
    }
  },

  retryJob: async (id) => {
    if (!window.manthan) return
    await window.manthan.retryQueueJob(id)
    await get().loadQueue()
  },

  reorderJob: async (id, newIndex) => {
    void id
    void newIndex

    if (!window.manthan) return

    const pendingJobs = [...get().jobs]
      .filter((job) => job.status === 'pending')
      .sort((a, b) => b.priority - a.priority || a.created_at - b.created_at)

    await Promise.all(
      pendingJobs.map((job, index) =>
        window.manthan.reorderQueueJob(job.id, pendingJobs.length - index)
      )
    )
  },

  clearCompleted: async () => {
    if (!window.manthan) return
    await window.manthan.clearCompletedQueueJobs()
    await get().loadQueue()
  },

  deleteJob: async (id) => {
    if (!window.manthan) return
    await window.manthan.deleteQueueJob(id)
    await get().loadQueue()
  }
}))
