// ============================================================
// Manthan Studio — Main Canvas
// Central creative workspace — routes based on sidebar tab
// ============================================================

import { motion } from 'framer-motion'
import { Sparkles, Video, Image as ImageIcon, Wand2 } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'
import { useGenerationStore } from '../../stores/generation-store'
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
  return (
    <div className="h-full flex items-center justify-center pb-32">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-center w-full max-w-2xl px-8"
      >
        {/* Animated icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 border border-accent/10 flex items-center justify-center"
          >
            <Wand2 className="w-7 h-7 text-accent" />
          </motion.div>
        </div>

        <h2 className="text-lg font-semibold text-text-primary mb-2">Start Creating</h2>
        <p className="text-sm text-text-muted leading-relaxed mb-8" style={{ maxWidth: '24rem', marginLeft: 'auto', marginRight: 'auto' }}>
          Describe your vision below to generate videos, images, and audio with AI. Upload frames for precise control.
        </p>

        {/* Feature pills */}
        <div className="flex items-center justify-center gap-3">
          {[
            { icon: Video, label: 'Text → Video', desc: 'Veo 3.1' },
            { icon: ImageIcon, label: 'Text → Image', desc: 'Nano Banana' },
            { icon: Sparkles, label: 'AI Audio', desc: 'Native' }
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-elevated/50 border border-border-subtle text-text-secondary"
            >
              <Icon className="w-4 h-4 text-text-muted flex-shrink-0" />
              <div className="text-left">
                <div className="text-xs font-medium whitespace-nowrap">{label}</div>
                <div className="text-[10px] text-text-muted whitespace-nowrap">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
