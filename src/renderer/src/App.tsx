// ============================================================
// Manthan Studio — App Root
// ============================================================

import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useProviderStore } from './stores/provider-store'

function App() {
  const { fetchProviders } = useProviderStore()

  useEffect(() => {
    fetchProviders()

    // Only subscribe to IPC events inside Electron
    if (typeof window !== 'undefined' && window.manthan) {
      const unsubProgress = window.manthan.onGenerationProgress((data) => {
        console.log('Generation progress:', data)
      })
      const unsubComplete = window.manthan.onGenerationComplete((data) => {
        console.log('Generation complete:', data)
      })
      return () => {
        unsubProgress()
        unsubComplete()
      }
    }
  }, [fetchProviders])

  return <AppShell />
}

export default App
