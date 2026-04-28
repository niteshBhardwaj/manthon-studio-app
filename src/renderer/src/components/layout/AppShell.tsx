// ============================================================
// Manthan Studio — App Shell
// Root layout composing TopBar + Sidebar + MainCanvas
// Global keyboard shortcuts
// ============================================================

import { useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { MainCanvas } from './MainCanvas'
import { ApiKeyManager } from '../settings/ApiKeyManager'
import { useAppStore } from '../../stores/app-store'

export function AppShell() {
  const { activeModal, openModal, closeModal, setSidebarTab } = useAppStore()

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey

    // Ctrl+K — Focus search
    if (isCtrl && e.key === 'k') {
      e.preventDefault()
      const search = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')
      search?.focus()
    }

    // Ctrl+, — Open settings
    if (isCtrl && e.key === ',') {
      e.preventDefault()
      openModal('settings')
    }

    // Escape — Close modal
    if (e.key === 'Escape' && activeModal) {
      e.preventDefault()
      closeModal()
    }

    // Ctrl+1/2/3/4 — Switch tabs
    if (isCtrl && e.key >= '1' && e.key <= '4') {
      e.preventDefault()
      const tabs = ['create', 'history', 'assets', 'templates'] as const
      setSidebarTab(tabs[parseInt(e.key) - 1])
    }

    // Ctrl+N — New generation (focus prompt)
    if (isCtrl && e.key === 'n') {
      e.preventDefault()
      setSidebarTab('create')
      setTimeout(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Describe"]')
        textarea?.focus()
      }, 100)
    }
  }, [activeModal, openModal, closeModal, setSidebarTab])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)' }}>
      {/* Top bar */}
      <TopBar />

      {/* Main area: Sidebar + Canvas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
