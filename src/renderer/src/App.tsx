// ============================================================
// Manthan Studio — App Root
// ============================================================

import { type JSX, useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useProviderStore } from './stores/provider-store'
import { useGenerationStore, GenerationJob } from './stores/generation-store'
import { useModelStore } from './stores/model-store'

function App(): JSX.Element {
  const { fetchProviders } = useProviderStore()
  const { updateJob } = useGenerationStore()
  const { loadEnabledModels } = useModelStore()

  useEffect(() => {
    void Promise.all([fetchProviders(), loadEnabledModels()])

    // Only subscribe to IPC events inside Electron
    if (typeof window !== 'undefined' && window.manthan) {
      const unsubProgress = window.manthan.onGenerationProgress((data: unknown) => {
        const d = data as { operationId: string; status: string; progress: number }
        updateJob(d.operationId, {
          status: d.status as GenerationJob['status'],
          progress: d.progress
        })
      })

      const unsubComplete = window.manthan.onGenerationComplete((data: unknown) => {
        const d = data as {
          id: string
          status: string
          result?: { type: string; data: string; mimeType: string; uri?: string }
          error?: string
        }
        updateJob(d.id, {
          status: d.status as GenerationJob['status'],
          progress: 100,
          completedAt: Date.now(),
          result: d.result as GenerationJob['result'],
          error: d.error
        })
      })

      return () => {
        unsubProgress()
        unsubComplete()
      }
    }
    return undefined
  }, [fetchProviders, loadEnabledModels, updateJob])

  return <AppShell />
}

export default App
