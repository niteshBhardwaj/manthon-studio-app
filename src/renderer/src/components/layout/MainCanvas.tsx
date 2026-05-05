// ============================================================
// Manthan Studio - Main Canvas
// Central creative workspace - routes based on sidebar tab
// ============================================================

import { motion } from 'framer-motion'
import { Wand2 } from 'lucide-react'
import { type JSX } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useGenerationStore } from '../../stores/generation-store'
import { getModelById } from '../../lib/model-capabilities'
import { PromptExamplesList } from '../generation/PromptExamplesList'
import { PromptInput } from '../generation/PromptInput'
import { TemplateSelector } from '../generation/TemplateSelector'
import { MediaGrid } from '../output/MediaGrid'
import { HistoryPage } from '../../pages/HistoryPage'
import { AssetsPage } from '../../pages/AssetsPage'
import { QueueDashboard } from '../queue/QueueDashboard'

export function MainCanvas(): JSX.Element {
  const { activeSidebarTab } = useAppStore()
  const { jobs } = useGenerationStore()

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
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
        {activeSidebarTab === 'queue' && <QueueDashboard />}
        {activeSidebarTab === 'history' && <HistoryPage />}
        {activeSidebarTab === 'assets' && <AssetsPage />}
        {activeSidebarTab === 'templates' && <TemplateSelector />}
      </div>

      {activeSidebarTab === 'create' && <PromptInput />}
    </div>
  )
}

function EmptyState(): JSX.Element {
  const { setPrompt, selectedModel, setCapabilityValue } = useGenerationStore()
  const selectedModelDescriptor = getModelById(selectedModel)

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', paddingBottom: '8rem' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ textAlign: 'center', width: '100%', maxWidth: '42rem', padding: '0 2rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <motion.div
            animate={{
              rotate: [0, 5, -5, 0],
              boxShadow: [
                '0 0 0px oklch(0.7 0.18 250 / 0)',
                '0 0 20px oklch(0.7 0.18 250 / 0.3)',
                '0 0 0px oklch(0.7 0.18 250 / 0)'
              ]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/20 to-cyan-400/10"
          >
            <div className="absolute inset-0 rounded-full bg-accent/10 blur-xl" />
            <Wand2 className="relative z-10 h-7 w-7 text-accent" />
          </motion.div>
        </div>

        <h2
          className="text-xl font-semibold tracking-tight text-text-primary"
          style={{ marginBottom: '0.75rem' }}
        >
          Start Creating
        </h2>
        <p
          className="text-sm text-text-muted/90"
          style={{
            lineHeight: 1.6,
            marginBottom: '2.5rem',
            maxWidth: '24rem',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          Describe your vision below to generate videos, images, and audio with AI. Upload frames or
          ingredients whenever you want tighter control.
        </p>

        {/* <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {availableTypes.map((type) => {
            const Icon = type === 'video' ? Video : type === 'audio' ? Music : ImageIcon
            const defaultModel = getDefaultModel(type, enabledModelIds) ?? getDefaultModel(type)
            const label =
              type === 'video'
                ? 'Text to Video'
                : type === 'audio'
                  ? 'Audio Generation'
                  : 'Text to Image'
            const desc = defaultModel?.name ?? 'Available'

            return (
              <motion.button
                key={type}
                onClick={() => handleSelectType(type)}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="group flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-border-subtle bg-bg-elevated/40 p-4 text-text-secondary transition-colors hover:border-accent/40 hover:bg-accent/5 hover:text-text-primary"
              >
                <div className="rounded-lg bg-bg-secondary/50 p-2 transition-colors group-hover:bg-accent/10">
                  <Icon className="h-5 w-5 text-text-muted transition-colors group-hover:text-accent" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="mt-0.5 text-xs text-text-muted">{desc}</div>
                </div>
              </motion.button>
            )
          })}
        </div> */}

        {selectedModelDescriptor?.examples && selectedModelDescriptor.examples.length > 0 && (
          <PromptExamplesList
            examples={selectedModelDescriptor.examples}
            onSelect={(prompt, configOverrides) => {
              setPrompt(prompt)
              if (configOverrides) {
                Object.entries(configOverrides).forEach(([key, value]) => {
                  setCapabilityValue(key, value as string | number | boolean)
                })
              }
              setTimeout(() => {
                const textarea = document.querySelector<HTMLTextAreaElement>('textarea')
                textarea?.focus()
              }, 100)
            }}
          />
        )}
      </motion.div>
    </div>
  )
}
