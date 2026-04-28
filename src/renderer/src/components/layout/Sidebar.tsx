// ============================================================
// Manthan Studio — Sidebar Component
// Navigation with cinematic minimal design
// ============================================================

import { motion } from 'framer-motion'
import {
  Plus,
  Clock,
  FolderOpen,
  Layers,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { cn } from '../../lib/utils'

const navItems = [
  { id: 'create' as const, icon: Plus, label: 'Create' },
  { id: 'history' as const, icon: Clock, label: 'History' },
  { id: 'assets' as const, icon: FolderOpen, label: 'Assets' },
  { id: 'templates' as const, icon: Sparkles, label: 'Templates' }
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, activeSidebarTab, setSidebarTab, openModal } =
    useAppStore()

  return (
    <motion.div
      initial={false}
      animate={{ width: sidebarCollapsed ? 56 : 200 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="h-full flex flex-col border-r border-border-subtle bg-bg-secondary/30 overflow-hidden"
    >
      {/* Navigation items */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSidebarTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => setSidebarTab(item.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg transition-all duration-[var(--transition-fast)]',
                sidebarCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                isActive
                  ? 'bg-accent-soft text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon
                className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-accent')}
              />
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-medium whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
              {isActive && !sidebarCollapsed && (
                <motion.div
                  layoutId="sidebar-active"
                  className="ml-auto w-1 h-4 rounded-full bg-accent"
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="py-3 px-2 border-t border-border-subtle space-y-0.5">
        <button
          onClick={() => openModal('settings')}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg transition-all duration-[var(--transition-fast)]',
            sidebarCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
            'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
          )}
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-xs font-medium">Settings</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg transition-all duration-[var(--transition-fast)]',
            sidebarCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
            'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
