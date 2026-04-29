// ============================================================
// Manthan Studio — Sidebar Component
// Navigation with cinematic minimal design
// ============================================================

import {
  Plus,
  Clock,
  FolderOpen,
  Sparkles,
  Settings
} from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { cn } from '../../lib/utils'
import { AnimatedBackground } from '../ui/animated-background'

const navItems = [
  { id: 'create' as const, icon: Plus, label: 'Create' },
  { id: 'history' as const, icon: Clock, label: 'History' },
  { id: 'assets' as const, icon: FolderOpen, label: 'Assets' },
  { id: 'templates' as const, icon: Sparkles, label: 'Templates' }
]

export function Sidebar() {
  const { activeSidebarTab, setSidebarTab, openModal } = useAppStore()

  return (
    <div className="h-full flex items-center justify-center pl-4 py-4 relative z-10">
      <div
        className="w-[60px] py-4 flex flex-col items-center bg-bg-secondary/50 border border-border-subtle rounded-[32px] backdrop-blur-md shadow-float"
        style={{ height: 'calc(100vh - 120px)' }}
      >
        <nav className="flex flex-col gap-2 w-full px-2">
          <AnimatedBackground
            defaultValue={activeSidebarTab}
            onValueChange={(v) => setSidebarTab(v as any)}
            className="rounded-full bg-accent/20"
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
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
                    'w-full aspect-square flex items-center justify-center rounded-full transition-colors duration-200 z-10',
                    isActive ? 'text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
                  )}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
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
