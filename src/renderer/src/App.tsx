// ============================================================
// Manthan Studio - App Root
// ============================================================

import { type JSX, useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useProviderStore } from './stores/provider-store'
import { useGenerationStore } from './stores/generation-store'
import { useModelStore } from './stores/model-store'
import { useQueueStore } from './stores/queue-store'
import type { QueueJobCompletePayload } from '../../main/queue/types'

function App(): JSX.Element {
  const { fetchProviders } = useProviderStore()
  const { addJob, updateJob } = useGenerationStore()
  const { loadEnabledModels } = useModelStore()
  const { initialize: initializeQueue } = useQueueStore()

  useEffect(() => {
    void Promise.all([fetchProviders(), loadEnabledModels(), initializeQueue()])

    if (typeof window !== 'undefined' && window.manthan) {
      const unsubComplete = window.manthan.onQueueJobComplete(
        async (payload: QueueJobCompletePayload) => {
          const base64Data =
            payload.result.data ||
            (payload.result.assetId
              ? await window.manthan.readAsset(payload.result.assetId)
              : null) ||
            ''

          const generationJob = {
            id: payload.jobId,
            type: payload.job.type,
            status: 'completed' as const,
            prompt: payload.job.prompt,
            negativePrompt: payload.job.negative_prompt || undefined,
            provider: payload.job.provider,
            model: payload.job.model,
            config: {
              contentType: payload.job.config.contentType,
              activeMode: payload.job.config.activeMode,
              batchCount: payload.job.config.batchCount,
              capabilityValues: payload.job.config.capabilityValues as Record<
                string,
                string | number | boolean
              >
            },
            progress: 100,
            startedAt: payload.job.started_at ?? payload.job.created_at,
            completedAt: payload.job.completed_at ?? Date.now(),
            result: {
              type: payload.job.type,
              data: base64Data,
              mimeType: payload.result.mimeType || 'application/octet-stream',
              uri: payload.result.uri
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
        }
      )

      return () => {
        unsubComplete()
      }
    }

    return undefined
  }, [addJob, fetchProviders, initializeQueue, loadEnabledModels, updateJob])

  return <AppShell />
}

export default App
