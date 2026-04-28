// ============================================================
// Manthan Studio — App Shell
// Root layout composing TopBar + Sidebar + MainCanvas
// ============================================================

import { AnimatePresence } from 'framer-motion'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { MainCanvas } from './MainCanvas'
import { ApiKeyManager } from '../settings/ApiKeyManager'
import { useAppStore } from '../../stores/app-store'

export function AppShell() {
  const { activeModal } = useAppStore()

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Top bar */}
      <TopBar />

      {/* Main area: Sidebar + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <MainCanvas />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeModal === 'api-keys' && <ApiKeyManager />}
        {activeModal === 'settings' && <ApiKeyManager />}
      </AnimatePresence>
    </div>
  )
}
