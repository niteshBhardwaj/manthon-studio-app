// ============================================================
// Manthan Studio — TopBar Component
// Search, provider switcher, API status, settings
// ============================================================

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Settings,
  ChevronDown,
  Zap,
  Video,
  Image as ImageIcon,
  Music
} from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { useProviderStore } from '../../stores/provider-store'
import { cn } from '../../lib/utils'

export function TopBar() {
  const { searchQuery, setSearchQuery, openModal } = useAppStore()
  const { providers, activeProviderId, setActiveProvider } = useProviderStore()
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false)

  const activeProvider = providers.find((p) => p.id === activeProviderId)

  const modalityIcon = (modality: string) => {
    switch (modality) {
      case 'video': return <Video className="w-3.5 h-3.5" />
      case 'image': return <ImageIcon className="w-3.5 h-3.5" />
      case 'audio': return <Music className="w-3.5 h-3.5" />
      default: return <Zap className="w-3.5 h-3.5" />
    }
  }

  return (
    <div className="drag-region h-12 flex items-center justify-between px-4 border-b border-border-subtle bg-bg-secondary/50">
      {/* Left: App title + search */}
      <div className="flex items-center gap-4 no-drag">
        <div className="flex items-center gap-2">
          <img
            src="/src/assets/icon.png"
            alt="Manthan Studio Logo"
            className="w-7 h-7 rounded-md object-cover drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]"
          />
          <span className="text-sm font-semibold text-text-primary tracking-tight">Manthan Studio</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search… ⌘K"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 h-7 pl-8 pr-3 text-xs rounded-lg bg-bg-input border border-border-subtle
                       text-text-primary placeholder:text-text-muted
                       focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-accent/20
                       transition-all duration-[var(--transition-fast)]"
          />
        </div>
      </div>

      {/* Center: Provider switcher */}
      <div className="no-drag relative">
        <button
          onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
            'bg-bg-elevated border border-border-subtle',
            'hover:bg-bg-hover hover:border-border transition-all duration-[var(--transition-fast)]',
            'text-text-secondary hover:text-text-primary'
          )}
        >
          <div
            className={cn(
              'status-dot',
              activeProvider?.connectionStatus === 'connected'
                ? 'status-dot--connected'
                : 'status-dot--error'
            )}
          />
          <span>{activeProvider?.name || 'Select Provider'}</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Provider dropdown */}
        {providerDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 right-0 w-64 glass-strong rounded-xl shadow-float z-50 overflow-hidden"
          >
            <div className="p-1.5">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => {
                    setActiveProvider(provider.id)
                    window.manthan?.setActiveProvider(provider.id)
                    setProviderDropdownOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
                    'transition-all duration-[var(--transition-fast)]',
                    provider.id === activeProviderId
                      ? 'bg-accent-soft text-text-primary'
                      : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary'
                  )}
                >
                  <div className="flex items-center gap-1.5 text-text-muted">
                    {provider.modalities.map((m) => (
                      <span key={m}>{modalityIcon(m)}</span>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{provider.name}</div>
                    <div className="text-[10px] text-text-muted">
                      {provider.modalities.join(' · ')}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'status-dot',
                      provider.initialized ? 'status-dot--connected' : 'status-dot--error'
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="border-t border-border-subtle p-1.5">
              <button
                onClick={() => {
                  openModal('api-keys')
                  setProviderDropdownOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted
                           hover:bg-bg-hover hover:text-text-secondary transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                Manage API Keys
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Right: Settings */}
      <div className="flex items-center gap-2 no-drag">
        <button
          onClick={() => openModal('settings')}
          className="w-7 h-7 rounded-lg flex items-center justify-center
                     text-text-muted hover:text-text-secondary hover:bg-bg-hover
                     transition-all duration-[var(--transition-fast)]"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
