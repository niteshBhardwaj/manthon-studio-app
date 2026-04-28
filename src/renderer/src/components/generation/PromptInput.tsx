// ============================================================
// Manthan Studio — Floating Prompt Input
// Google Flow-inspired creative prompt bar
// ============================================================

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  ArrowRight,
  Image as ImageIcon,
  ChevronDown,
  X,
  Sparkles,
  Volume2,
  Film
} from 'lucide-react'
import { useGenerationStore } from '../../stores/generation-store'
import { useProviderStore } from '../../stores/provider-store'
import { cn } from '../../lib/utils'

export function PromptInput() {
  const {
    prompt, setPrompt,
    aspectRatio, setAspectRatio,
    resolution, setResolution,
    enableAudio, setEnableAudio,
    startFrame, setStartFrame,
    endFrame, setEndFrame,
    panelExpanded, setPanelExpanded,
    selectedModel
  } = useGenerationStore()

  const { activeProviderId, providers } = useProviderStore()
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeProvider = providers.find((p) => p.id === activeProviderId)

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !window.manthan) return
    try {
      const params = {
        prompt: prompt.trim(),
        model: selectedModel,
        aspectRatio,
        resolution,
        enableAudio,
        ...(startFrame && { image: startFrame }),
        ...(endFrame && { lastFrame: endFrame })
      }
      if (activeProviderId === 'google-imagen') {
        await window.manthan.generateImage({ prompt: prompt.trim(), model: selectedModel })
      } else {
        await window.manthan.generateVideo(params)
      }
    } catch (error) {
      console.error('Generation failed:', error)
    }
  }, [prompt, selectedModel, aspectRatio, resolution, enableAudio, startFrame, endFrame, activeProviderId])

  const handleFileUpload = useCallback(async (target: 'start' | 'end') => {
    if (!window.manthan) return
    const file = await window.manthan.openFile()
    if (file) {
      const frameData = { data: file.data, mimeType: file.mimeType }
      if (target === 'start') setStartFrame(frameData)
      else setEndFrame(frameData)
    }
  }, [setStartFrame, setEndFrame])

  return (
    <motion.div layout className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl z-40">
      <motion.div
        layout
        className={cn(
          'glass-strong rounded-2xl overflow-hidden transition-shadow',
          isFocused ? 'shadow-glow shadow-float' : 'shadow-lg'
        )}
      >
        {/* Frame inputs — visible when expanded */}
        <AnimatePresence>
          {(panelExpanded || startFrame || endFrame) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 pt-4 overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-3">
                {/* Start frame */}
                <FrameSlot label="Start" frame={startFrame} onUpload={() => handleFileUpload('start')} onClear={() => setStartFrame(null)} />
                {/* Connector */}
                <div className="flex items-center gap-1 mt-5">
                  <div className="w-6 h-px bg-border" />
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                  <div className="w-6 h-px bg-border" />
                </div>
                {/* End frame */}
                <FrameSlot label="End" frame={endFrame} onUpload={() => handleFileUpload('end')} onClear={() => setEndFrame(null)} />
                <div className="flex-1" />
                {/* Model selector */}
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-xs text-text-secondary hover:bg-bg-hover transition-all">
                  <Film className="w-3.5 h-3.5" />
                  <span>{activeProvider?.name || 'Select model'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main prompt row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setPanelExpanded(!panelExpanded)}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              'bg-bg-elevated border border-border-subtle',
              'hover:bg-bg-hover hover:border-border transition-all',
              'text-text-muted hover:text-text-secondary'
            )}
          >
            <Plus className={cn('w-5 h-5 transition-transform', panelExpanded && 'rotate-45')} />
          </button>

          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() }
            }}
            placeholder="Describe your vision or upload a starting frame..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-text-primary placeholder:text-text-muted min-h-[24px] max-h-[120px] leading-relaxed"
          />

          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
              prompt.trim()
                ? 'bg-white text-black hover:bg-gray-100 shadow-md hover:shadow-lg hover:scale-105'
                : 'bg-bg-elevated text-text-muted cursor-not-allowed'
            )}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom settings pills */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {(['16:9', '9:16'] as const).map((ratio) => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all',
                aspectRatio === ratio
                  ? 'bg-accent-soft text-accent border border-accent/20'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
              )}
            >
              {ratio === '16:9' ? '16:9 Cinematic' : '9:16 Portrait'}
            </button>
          ))}
          <button
            onClick={() => {
              const r: Array<'720p' | '1080p' | '4k'> = ['720p', '1080p', '4k']
              setResolution(r[(r.indexOf(resolution) + 1) % r.length])
            }}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all"
          >
            {resolution.toUpperCase()} Output
          </button>
          <button
            onClick={() => setEnableAudio(!enableAudio)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all',
              enableAudio ? 'text-accent bg-accent-soft border border-accent/20' : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            )}
          >
            <Volume2 className="w-3 h-3" /> Audio
          </button>
          <div className="flex-1" />
          <button className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium text-accent hover:bg-accent-soft transition-all">
            <Sparkles className="w-3 h-3" /> Enhance
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function FrameSlot({ label, frame, onUpload, onClear }: {
  label: string
  frame: { data: string; mimeType: string } | null
  onUpload: () => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{label}</span>
      <button
        onClick={onUpload}
        className={cn(
          'w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center transition-all',
          frame ? 'border-accent/30 bg-accent-soft' : 'border-border hover:border-border-focus hover:bg-bg-hover'
        )}
      >
        {frame ? (
          <div className="relative w-full h-full">
            <img src={`data:${frame.mimeType};base64,${frame.data}`} alt={label} className="w-full h-full object-cover rounded-[10px]" />
            <button onClick={(e) => { e.stopPropagation(); onClear() }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-bg-elevated border border-border flex items-center justify-center">
              <X className="w-2.5 h-2.5 text-text-muted" />
            </button>
          </div>
        ) : (
          <ImageIcon className="w-5 h-5 text-text-muted" />
        )}
      </button>
    </div>
  )
}
