// ============================================================
// Manthan Studio — Sidebar Component
// Navigation with cinematic minimal design
// ============================================================

import { Plus, Clock, FolderOpen, Sparkles, Settings, ListOrdered } from 'lucide-react'
import { type JSX } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useQueueStore } from '../../stores/queue-store'
import { cn } from '../../lib/utils'
import { AnimatedBackground } from '../ui/animated-background'

const navItems = [
  { id: 'create' as const, icon: Plus, label: 'Create' },
  { id: 'queue' as const, icon: ListOrdered, label: 'Queue' },
  { id: 'history' as const, icon: Clock, label: 'History' },
  { id: 'assets' as const, icon: FolderOpen, label: 'Assets' },
  { id: 'templates' as const, icon: Sparkles, label: 'Templates' }
]

export function Sidebar(): JSX.Element {
  const { activeSidebarTab, setSidebarTab, openModal } = useAppStore()
  const pendingCount = useQueueStore(
    (state) =>
      state.jobs.filter((job) => job.status === 'pending' || job.status === 'running').length
  )

  return (
    <div className="h-full flex items-center justify-center pl-4 py-4 relative z-10">
      <div
        className="w-[60px] py-4 flex flex-col items-center bg-bg-secondary/50 border border-border-subtle rounded-[32px] backdrop-blur-md shadow-float"
        style={{ height: 'calc(100vh - 120px)' }}
      >
        <nav className="flex flex-col gap-2 w-full px-2">
          <AnimatedBackground
            defaultValue={activeSidebarTab}
            onValueChange={(value) =>
              setSidebarTab(value as 'create' | 'queue' | 'history' | 'assets' | 'templates')
            }
            className="rounded-full bg-accent/20"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
          >
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSidebarTab === item.id

              return (
                <button
                  key={item.id}
                  data-id={item.id}
                  type="button"
                  className={cn(
                    'relative z-10 flex w-full aspect-square items-center justify-center rounded-full transition-colors duration-200',
                    isActive
                      ? 'text-accent'
                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                  )}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
                  {item.id === 'queue' && pendingCount > 0 ? (
                    <span className="absolute right-1 top-1 min-w-4 rounded-full bg-accent px-1 text-[9px] font-semibold leading-4 text-white">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </AnimatedBackground>
        </nav>

        <div className="mt-auto flex flex-col gap-2 w-full px-2">
          <button
            onClick={() => openModal('settings')}
            className="w-full aspect-square flex items-center justify-center rounded-full text-text-muted hover:text-text-secondary hover:bg-bg-hover/50 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
