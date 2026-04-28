// ============================================================
// Manthan Studio — API Key Manager
// Settings panel for managing provider API keys
// ============================================================

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Eye, EyeOff, Check, Loader2, AlertCircle, Video, Image as ImageIcon, Music } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { useProviderStore } from '../../stores/provider-store'
import { cn } from '../../lib/utils'

const providerMeta: Record<string, { description: string; icon: React.ReactNode; color: string }> = {
  'google-veo': {
    description: 'Video generation with Veo 3.1. Supports text-to-video, image-to-video, and video extension.',
    icon: <Video className="w-5 h-5" />,
    color: 'from-blue-500 to-cyan-400'
  },
  'google-imagen': {
    description: 'Image generation with Nano Banana. Text-to-image and image editing.',
    icon: <ImageIcon className="w-5 h-5" />,
    color: 'from-amber-500 to-orange-400'
  }
}

export function ApiKeyManager() {
  const { closeModal } = useAppStore()
  const { providers, updateProviderStatus, fetchProviders } = useProviderStore()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={closeModal}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg glass-strong rounded-2xl shadow-float overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">API Keys</h2>
            <p className="text-xs text-text-muted mt-0.5">Manage your provider API keys</p>
          </div>
          <button
            onClick={closeModal}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider list */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {providers.map((provider) => (
            <ProviderKeyCard
              key={provider.id}
              provider={provider}
              meta={providerMeta[provider.id]}
              onStatusUpdate={updateProviderStatus}
              onRefresh={fetchProviders}
            />
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-border-subtle">
          <p className="text-[10px] text-text-muted leading-relaxed">
            API keys are encrypted and stored locally on your device. They are never sent to any server other than the provider's API.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ProviderKeyCard({
  provider,
  meta,
  onStatusUpdate,
  onRefresh
}: {
  provider: { id: string; name: string; initialized: boolean; connectionStatus: string; message?: string }
  meta?: { description: string; icon: React.ReactNode; color: string }
  onStatusUpdate: (id: string, status: 'connected' | 'failed' | 'testing', msg?: string) => void
  onRefresh: () => Promise<void>
}) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleTest = async () => {
    if (!apiKey.trim()) return
    setTesting(true)
    onStatusUpdate(provider.id, 'testing')

    try {
      const result = await window.manthan.testApiKey(provider.id, apiKey.trim())
      onStatusUpdate(provider.id, result.connected ? 'connected' : 'failed', result.message)
    } catch {
      onStatusUpdate(provider.id, 'failed', 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await window.manthan.saveApiKey(provider.id, apiKey.trim())
      onStatusUpdate(provider.id, 'connected', 'Key saved successfully')
      await onRefresh()
      setApiKey('')
    } catch {
      onStatusUpdate(provider.id, 'failed', 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated/50 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white', meta?.color || 'from-gray-500 to-gray-600')}>
            {meta?.icon || <AlertCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">{provider.name}</span>
              <div className={cn('status-dot', provider.connectionStatus === 'connected' ? 'status-dot--connected' : provider.connectionStatus === 'testing' ? 'status-dot--generating' : '')} />
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">{meta?.description || ''}</p>
          </div>
        </div>

        {/* Status message */}
        {provider.message && (
          <div className={cn('text-[11px] mb-2 px-2 py-1 rounded-md', provider.connectionStatus === 'connected' ? 'text-success bg-success/5' : provider.connectionStatus === 'failed' ? 'text-error bg-error/5' : 'text-warning bg-warning/5')}>
            {provider.message}
          </div>
        )}

        {/* Key input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider.initialized ? '••••••••••••••••' : 'Enter API key...'}
              className="w-full h-8 px-3 pr-8 text-xs rounded-lg bg-bg-input border border-border-subtle text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none transition-all"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={handleTest}
            disabled={!apiKey.trim() || testing}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-border-subtle bg-bg-elevated text-text-secondary hover:bg-bg-hover disabled:opacity-40 transition-all flex items-center gap-1.5"
          >
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Test
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className="h-8 px-3 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-all flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
