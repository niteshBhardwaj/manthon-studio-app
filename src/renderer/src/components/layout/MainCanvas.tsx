// ============================================================
// Manthan Studio - Main Canvas
// Central creative workspace - routes based on sidebar tab
// ============================================================

import { type JSX } from 'react'
import { useAppStore } from '../../stores/app-store'
import { PromptInput } from '../generation/PromptInput'
import { TemplateSelector } from '../generation/TemplateSelector'
import { HistoryPage } from '../../pages/HistoryPage'
import { AssetsPage } from '../../pages/AssetsPage'
import { QueueDashboard } from '../queue/QueueDashboard'
import { Dashboard } from '../dashboard/Dashboard'

export function MainCanvas(): JSX.Element {
  const { activeSidebarTab } = useAppStore()

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        {activeSidebarTab === 'create' && <Dashboard />}
        {activeSidebarTab === 'queue' && <QueueDashboard />}
        {activeSidebarTab === 'history' && <HistoryPage />}
        {activeSidebarTab === 'assets' && <AssetsPage />}
        {activeSidebarTab === 'templates' && <TemplateSelector />}
      </div>

      {activeSidebarTab === 'create' && <PromptInput />}
    </div>
  )
}
