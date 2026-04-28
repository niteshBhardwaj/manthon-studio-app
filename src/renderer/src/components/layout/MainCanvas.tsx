// ============================================================
// Manthan Studio — Main Canvas
// Central creative workspace — routes based on sidebar tab
// ============================================================

import { motion } from 'framer-motion'
import { Music, Video, Image as ImageIcon, Wand2 } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { useGenerationStore } from '../../stores/generation-store'
import { useProviderStore } from '../../stores/provider-store'
import { PromptInput } from '../generation/PromptInput'
import { TemplateSelector } from '../generation/TemplateSelector'
import { MediaGrid } from '../output/MediaGrid'
import { HistoryPage } from '../../pages/HistoryPage'
import { AssetsPage } from '../../pages/AssetsPage'

export function MainCanvas() {
  const { activeSidebarTab } = useAppStore()
  const { jobs } = useGenerationStore()

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeSidebarTab === 'create' && (
          <>
            {jobs.length > 0 ? (
              <div className="pb-40">
                <MediaGrid />
              </div>
            ) : (
              <EmptyState />
            )}
          </>
        )}
        {activeSidebarTab === 'history' && <HistoryPage />}
        {activeSidebarTab === 'assets' && <AssetsPage />}
        {activeSidebarTab === 'templates' && <TemplateSelector />}
      </div>

      {/* Floating prompt input — only on Create tab */}
      {activeSidebarTab === 'create' && <PromptInput />}
    </div>
  )
}

function EmptyState() {
  const { setActiveProvider } = useProviderStore()

  const handleSelectType = (providerId: string) => {
    setActiveProvider(providerId)
    window.manthan?.setActiveProvider(providerId)
    // Focus the prompt input
    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Describe"]')
      textarea?.focus()
    }, 100)
  }

  return (
    // CSS Grid centering avoids flex shrink-to-fit that caused word-by-word text wrapping
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', paddingBottom: '8rem' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ textAlign: 'center', width: '100%', maxWidth: '42rem', padding: '0 2rem' }}
      >
        {/* Animated icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 border border-accent/10 flex items-center justify-center"
          >
            <Wand2 className="w-7 h-7 text-accent" />
          </motion.div>
        </div>

        <h2 className="text-lg font-semibold text-text-primary" style={{ marginBottom: '0.5rem' }}>
          Start Creating
        </h2>
        <p className="text-sm text-text-muted" style={{ lineHeight: 1.7, marginBottom: '2rem', maxWidth: '24rem', marginLeft: 'auto', marginRight: 'auto' }}>
          Describe your vision below to generate videos, images, and audio with AI.
          Upload frames for precise control.
        </p>

        {/* Feature pills — clickable to select generation type */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          {[
            { icon: Video, label: 'Text → Video', desc: 'Veo 3.1', providerId: 'google-veo' },
            { icon: ImageIcon, label: 'Text → Image', desc: 'Nano Banana', providerId: 'google-imagen' },
            { icon: Music, label: 'AI Audio', desc: 'Lyria 3', providerId: 'google-lyria' }
          ].map(({ icon: Icon, label, desc, providerId }) => (
            <button
              key={label}
              onClick={() => handleSelectType(providerId)}
              className="inline-flex items-center gap-2 rounded-xl bg-bg-elevated/50 border border-border-subtle text-text-secondary hover:border-accent/30 hover:bg-accent/5 transition-all cursor-pointer"
              style={{ padding: '0.625rem 1rem' }}
            >
              <Icon className="w-4 h-4 text-text-muted" style={{ flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div className="text-xs font-medium" style={{ whiteSpace: 'nowrap' }}>{label}</div>
                <div className="text-text-muted" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
