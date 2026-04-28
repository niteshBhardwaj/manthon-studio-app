// ============================================================
// Manthan Studio — Floating Prompt Input
// Google Flow-inspired creative prompt bar with full generation wiring
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
  Film,
  Loader2
} from 'lucide-react'
import { useGenerationStore, type GenerationJob } from '../../stores/generation-store'
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
    selectedModel,
    addJob, updateJob
  } = useGenerationStore()

  const { activeProviderId, providers } = useProviderStore()
  const [isFocused, setIsFocused] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeProvider = providers.find((p) => p.id === activeProviderId)

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return

    const jobId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const isImage = activeProviderId === 'google-imagen'
    const isAudio = activeProviderId === 'google-lyria'

    const job: GenerationJob = {
      id: jobId,
      type: isAudio ? 'audio' : isImage ? 'image' : 'video',
      status: 'generating',
      prompt: prompt.trim(),
      provider: activeProviderId || 'google-veo',
      model: selectedModel,
      config: { aspectRatio, resolution, enableAudio },
      progress: 0,
      startedAt: Date.now()
    }

    addJob(job)
    setIsGenerating(true)

    try {
      if (!window.manthan) {
        // Dev mode — simulate generation
        setTimeout(() => {
          updateJob(jobId, { status: 'completed', progress: 100, completedAt: Date.now() })
          setIsGenerating(false)
        }, 2000)
        return
      }

      if (isImage) {
        const result = await window.manthan.generateImage({ prompt: prompt.trim(), model: selectedModel })
        updateJob(jobId, {
          status: 'completed',
          progress: 100,
          completedAt: Date.now(),
          result: result as GenerationJob['result']
        })
      } else if (isAudio) {
        const result = await window.manthan.generateAudio({ prompt: prompt.trim(), model: selectedModel })
        updateJob(jobId, {
          status: 'completed',
          progress: 100,
          completedAt: Date.now(),
          result: result as GenerationJob['result']
        })
      } else {
        const params = {
          prompt: prompt.trim(),
          model: selectedModel,
          aspectRatio,
          resolution,
          enableAudio,
          ...(startFrame && { image: startFrame }),
          ...(endFrame && { lastFrame: endFrame })
        }
        const operation = await window.manthan.generateVideo(params) as { id: string }
        // Video uses background polling — update job ID to match the operation
        updateJob(jobId, { id: operation.id || jobId })
      }
    } catch (error) {
      console.error('Generation failed:', error)
      updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Generation failed',
        completedAt: Date.now()
      })
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, selectedModel, aspectRatio, resolution, enableAudio, startFrame, endFrame, activeProviderId, isGenerating, addJob, updateJob])

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
    <motion.div layout className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl z-40 px-4">
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                <FrameSlot label="Start" frame={startFrame} onUpload={() => handleFileUpload('start')} onClear={() => setStartFrame(null)} />
                {/* Connector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '1.25rem' }}>
                  <div style={{ width: '1.5rem', height: '1px', background: 'var(--color-border)' }} />
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-text-muted)' }} />
                  <div style={{ width: '1.5rem', height: '1px', background: 'var(--color-border)' }} />
                </div>
                <FrameSlot label="End" frame={endFrame} onUpload={() => handleFileUpload('end')} onClear={() => setEndFrame(null)} />
                <div style={{ flex: 1 }} />
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-xs text-text-secondary hover:bg-bg-hover transition-all" style={{ padding: '0.375rem 0.75rem' }}>
                  <Film className="w-3.5 h-3.5" />
                  <span>{activeProvider?.name || 'Select model'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main prompt row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}>
          <button
            onClick={() => setPanelExpanded(!panelExpanded)}
            className="rounded-full bg-bg-elevated border border-border-subtle hover:bg-bg-hover hover:border-border text-text-muted hover:text-text-secondary transition-all"
            style={{ width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
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
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '0.875rem', color: 'var(--color-text-primary)', minHeight: '24px', maxHeight: '120px', lineHeight: 1.6 }}
          />

          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className={cn('rounded-full transition-all', isGenerating && 'animate-pulse')}
            style={{
              width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: prompt.trim() ? 'white' : 'var(--color-bg-elevated)',
              color: prompt.trim() ? 'black' : 'var(--color-text-muted)',
              cursor: !prompt.trim() || isGenerating ? 'not-allowed' : 'pointer',
              boxShadow: prompt.trim() ? '0 4px 16px rgba(0,0,0,0.3)' : 'none'
            }}
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>

        {/* Bottom settings pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1rem 0.75rem' }}>
          {(['16:9', '9:16'] as const).map((ratio) => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              className={cn(
                'rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all',
                aspectRatio === ratio
                  ? 'bg-accent-soft text-accent border border-accent/20'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
              )}
              style={{ padding: '0.25rem 0.625rem' }}
            >
              {ratio === '16:9' ? '16:9 Cinematic' : '9:16 Portrait'}
            </button>
          ))}
          <button
            onClick={() => {
              const r: Array<'720p' | '1080p' | '4k'> = ['720p', '1080p', '4k']
              setResolution(r[(r.indexOf(resolution) + 1) % r.length])
            }}
            className="rounded-md text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all"
            style={{ padding: '0.25rem 0.625rem' }}
          >
            {resolution.toUpperCase()} Output
          </button>
          <button
            onClick={() => setEnableAudio(!enableAudio)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all',
              enableAudio ? 'text-accent bg-accent-soft border border-accent/20' : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            )}
            style={{ padding: '0.25rem 0.625rem' }}
          >
            <Volume2 className="w-3 h-3" /> Audio
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="inline-flex items-center gap-1 rounded-md text-[10px] font-medium text-accent hover:bg-accent-soft transition-all"
            style={{ padding: '0.25rem 0.625rem' }}
          >
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{label}</span>
      <button
        onClick={onUpload}
        className={cn(
          'rounded-xl border-2 border-dashed transition-all',
          frame ? 'border-accent/30 bg-accent-soft' : 'border-border hover:border-border-focus hover:bg-bg-hover'
        )}
        style={{ width: '4rem', height: '4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {frame ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img src={`data:${frame.mimeType};base64,${frame.data}`} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
            <button
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="bg-bg-elevated border border-border"
              style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
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
