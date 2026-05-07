// ============================================================
// Manthan Studio - App Root
// ============================================================

import { type JSX, useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useProviderStore } from './stores/provider-store'
import { useGenerationStore } from './stores/generation-store'
import { useModelStore } from './stores/model-store'
import { useQueueStore } from './stores/queue-store'
import type {
  QueueJobCompletePayload,
  QueueJobFailedPayload,
  QueueJobProgressPayload
} from '../../main/queue/types'
import { queueJobToGenerationJob } from './lib/enqueue-generation'
import { useAppStore } from './stores/app-store'

function isProtectedGoogleMediaUri(uri?: string): boolean {
  return Boolean(uri?.includes('generativelanguage.googleapis.com/download/'))
}

function toAssetUri(path?: string): string | undefined {
  return path ? `asset:///${path.replace(/\\/g, '/')}` : undefined
}

function canPlayFromLocalAsset(type: string): boolean {
  return type === 'video' || type === 'audio'
}

function playCompletionChime(): void {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return

  const context = new AudioContextCtor()
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(659.25, context.currentTime)
  oscillator.frequency.linearRampToValueAtTime(880, context.currentTime + 0.22)
  gain.gain.setValueAtTime(0.001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.36)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.38)
  void context.close().catch(() => undefined)
}

function App(): JSX.Element {
  const { fetchProviders } = useProviderStore()
  const { addJob, updateJob } = useGenerationStore()
  const { loadEnabledModels } = useModelStore()
  const { initialize: initializeQueue } = useQueueStore()
  const { addToast, setHistoryHasUpdates, setPlayCompletionSound, setIsDev } = useAppStore()

  useEffect(() => {
    void Promise.all([fetchProviders(), loadEnabledModels(), initializeQueue()])
    void window.manthan?.getPreferences().then((preferences) => {
      setPlayCompletionSound(Boolean(preferences.playCompletionSound ?? true))
    })
    void window.manthan?.isDev().then((dev) => {
      setIsDev(dev)
    })

    if (typeof window !== 'undefined' && window.manthan) {
      const unsubProgress = window.manthan.onQueueJobProgress((payload: QueueJobProgressPayload) => {
        updateJob(payload.jobId, {
          status: payload.status === 'running' ? 'generating' : 'queued',
          progress: payload.progress
        })
      })

      const unsubComplete = window.manthan.onQueueJobComplete(
        async (payload: QueueJobCompletePayload) => {
          const localAssetUri = canPlayFromLocalAsset(payload.result.type)
            ? toAssetUri(payload.result.assetPath)
            : undefined
          const base64Data =
            payload.result.data ||
            (!localAssetUri && payload.result.assetId
              ? await window.manthan.readAsset(payload.result.assetId)
              : null) ||
            ''

          const generationJob = {
            ...queueJobToGenerationJob(payload.job),
            status: 'completed' as const,
            progress: 100,
            completedAt: payload.job.completed_at ?? Date.now(),
            result: {
              type: payload.job.type,
              data: localAssetUri ? '' : base64Data,
              mimeType: payload.result.mimeType || 'application/octet-stream',
              uri: localAssetUri ?? (isProtectedGoogleMediaUri(payload.result.uri) ? undefined : payload.result.uri),
              assetId: payload.result.assetId
            }
          }

          const existing = useGenerationStore
            .getState()
            .jobs.find((job) => job.id === payload.jobId)
          if (existing) {
            updateJob(payload.jobId, generationJob)
          } else {
            addJob(generationJob)
          }

          addToast({
            title: 'Generation complete',
            message: payload.job.prompt,
            tone: 'success'
          })
          setHistoryHasUpdates(true)

          if (document.hidden && useAppStore.getState().playCompletionSound) {
            playCompletionChime()
          }
        }
      )

      const unsubFailed = window.manthan.onQueueJobFailed((payload: QueueJobFailedPayload) => {
        updateJob(payload.jobId, {
          ...queueJobToGenerationJob(payload.job),
          status: 'failed',
          error: payload.error
        })
        addToast({
          title: 'Generation failed',
          message: payload.error,
          tone: 'error'
        })
      })

      return () => {
        unsubProgress()
        unsubComplete()
        unsubFailed()
      }
    }

    return undefined
  }, [
    addJob,
    addToast,
    fetchProviders,
    initializeQueue,
    loadEnabledModels,
    setHistoryHasUpdates,
    setPlayCompletionSound,
    updateJob
  ])

  return <AppShell />
}

export default App
