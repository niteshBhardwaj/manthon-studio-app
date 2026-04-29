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
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ textAlign: 'center', width: '100%', maxWidth: '42rem', padding: '0 2rem' }}
      >
        {/* Animated icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <motion.div
            animate={{ 
              rotate: [0, 5, -5, 0],
              boxShadow: ["0 0 0px oklch(0.7 0.18 250 / 0)", "0 0 20px oklch(0.7 0.18 250 / 0.3)", "0 0 0px oklch(0.7 0.18 250 / 0)"]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 border border-accent/20 flex items-center justify-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-accent/10 blur-xl rounded-full" />
            <Wand2 className="w-7 h-7 text-accent relative z-10" />
          </motion.div>
        </div>

        <h2 className="text-xl font-semibold text-text-primary tracking-tight" style={{ marginBottom: '0.75rem' }}>
          Start Creating
        </h2>
        <p className="text-sm text-text-muted/90" style={{ lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '24rem', marginLeft: 'auto', marginRight: 'auto' }}>
          Describe your vision below to generate videos, images, and audio with AI.
          Upload frames for precise control.
        </p>

        {/* Feature pills — interactive motion cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Video, label: 'Text → Video', desc: 'Veo 3.1', providerId: 'google-veo' },
            { icon: ImageIcon, label: 'Text → Image', desc: 'Imagen 3', providerId: 'google-imagen' },
            { icon: Music, label: 'AI Audio', desc: 'Lyria 3', providerId: 'google-lyria' }
          ].map(({ icon: Icon, label, desc, providerId }) => (
            <motion.button
              key={label}
              onClick={() => handleSelectType(providerId)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center gap-2 rounded-xl bg-bg-elevated/40 border border-border-subtle p-4 text-text-secondary hover:border-accent/40 hover:bg-accent/5 hover:text-text-primary transition-colors cursor-pointer group"
            >
              <div className="p-2 rounded-lg bg-bg-secondary/50 group-hover:bg-accent/10 transition-colors">
                <Icon className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-text-muted mt-0.5">{desc}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
