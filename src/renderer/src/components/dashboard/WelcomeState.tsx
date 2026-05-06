import { type JSX, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FolderUp, Image as ImageIcon, Video, Wand2 } from 'lucide-react'
import { useGenerationStore } from '../../stores/generation-store'
import { getModelById } from '../../lib/model-capabilities'
import { PromptExamplesList } from '../generation/PromptExamplesList'

const tips = [
  'Tip 1: Use @mention to reference project assets in prompts',
  'Tip 2: Ctrl+Enter to generate with default settings',
  'Tip 3: Star your best results to pin them at the top'
]

export function WelcomeState({ onImport }: { onImport: () => void }): JSX.Element {
  const { setPrompt, setCapabilityValue, setContentType, selectedModel } = useGenerationStore()
  const selectedModelDescriptor = getModelById(selectedModel)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTipIndex((index) => (index + 1) % tips.length)
    }, 3200)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-[30rem] flex-col items-center justify-center px-6 pb-32 pt-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-5xl text-center"
      >
        <div className="mb-6 flex justify-center">
          <motion.div
            animate={{
              rotate: [0, 4, -4, 0],
              boxShadow: [
                '0 0 0px oklch(0.7 0.18 250 / 0)',
                '0 0 24px oklch(0.7 0.18 250 / 0.3)',
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

        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Start this project</h2>
        <p className="mx-auto mt-3 text-sm leading-6 text-text-muted/90">
          The dashboard comes alive as soon as we generate or import something. Until then, the best
          path in is a quick prompt, an example, or a media drop.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setContentType('video')}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            <Video className="h-4 w-4" />
            Generate Video
          </button>
          <button
            type="button"
            onClick={() => setContentType('image')}
            className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-elevated px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <ImageIcon className="h-4 w-4" />
            Generate Image
          </button>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-elevated px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <FolderUp className="h-4 w-4" />
            Import Media
          </button>
        </div>

        <div className="mt-6 inline-flex items-center rounded-full border border-border-subtle bg-bg-elevated px-4 py-2 text-xs text-text-muted">
          {tips[tipIndex]}
        </div>

        {selectedModelDescriptor?.examples && selectedModelDescriptor.examples.length > 0 ? (
          <PromptExamplesList
            examples={selectedModelDescriptor.examples}
            onSelect={(prompt, configOverrides) => {
              setPrompt(prompt)
              if (configOverrides) {
                Object.entries(configOverrides).forEach(([key, value]) => {
                  setCapabilityValue(key, value as string | number | boolean)
                })
              }
              window.setTimeout(() => {
                document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
              }, 100)
            }}
          />
        ) : null}
      </motion.div>
    </div>
  )
}
