// ============================================================
// Manthan Studio - TopBar Component
// Search, active model status, and settings
// ============================================================

import { Search, Settings, Image as ImageIcon, Music, Video } from 'lucide-react'
import { type JSX } from 'react'
import { useAppStore } from '../../stores/app-store'

export function TopBar(): JSX.Element {
  const { searchQuery, setSearchQuery, openModal } = useAppStore()


  return (
    <div className="drag-region flex h-12 items-center justify-between border-b border-border-subtle bg-bg-secondary/50 px-4">
      <div className="no-drag flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img
            src="/src/assets/icon.png"
            alt="Manthan Studio Logo"
            className="h-7 w-7 rounded-md object-cover drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]"
          />
          <span className="text-sm font-semibold tracking-tight text-text-primary">
            Manthan Studio
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search... Ctrl+K"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-7 w-56 rounded-lg border border-border-subtle bg-bg-input pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted transition-all duration-[var(--transition-fast)] focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-accent/20"
          />
        </div>
      </div>

      <div className="no-drag flex items-center gap-2">
        <button
          onClick={() => openModal('settings')}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-all duration-[var(--transition-fast)] hover:bg-bg-hover hover:text-text-secondary"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
