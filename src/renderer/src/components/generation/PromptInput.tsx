import { type JSX, useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowLeftRight,
  Brain,
  ChevronDown,
  Film,
  Globe,
  Image as ImageIcon,
  Loader2,
  Music,
  Package2,
  Plus,
  Search,
  Sparkles,
  Video,
  Volume2,
  X
} from 'lucide-react'
import {
  useGenerationStore,
  type BinaryInput,
  type GenerationJob
} from '../../stores/generation-store'
import { useModelStore } from '../../stores/model-store'
import { useProviderStore } from '../../stores/provider-store'
import { buildPayload } from '../../lib/build-payload'
import useClickOutside from '../../hooks/useClickOutside'
import {
  getAvailableContentTypes,
  getModelById,
  getModelsByContentType,
  type ContentType,
  type ModelCapability,
  type ModelDescriptor
} from '../../lib/model-capabilities'
import { cn } from '../../lib/utils'

type JobResult = GenerationJob['result']

const contentTypeMeta: Record<ContentType, { label: string; icon: typeof ImageIcon }> = {
  image: { label: 'Image', icon: ImageIcon },
  video: { label: 'Video', icon: Video },
  audio: { label: 'Audio', icon: Music }
}

function OptimizedTextArea({
  initialPrompt,
  onPromptChange,
  isExpanded,
  setIsExpanded,
  placeholder,
  onFocus,
  onBlur,
  onKeyDown
}: {
  initialPrompt: string
  onPromptChange: (val: string) => void
  isExpanded: boolean
  setIsExpanded: (val: boolean) => void
  placeholder: string
  onFocus: () => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}): JSX.Element {
  const [localPrompt, setLocalPrompt] = useState(initialPrompt)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isTyping = useRef(false)

  useEffect(() => {
    if (!isTyping.current) {
      setLocalPrompt(initialPrompt)
    } else if (initialPrompt === '') {
      setLocalPrompt('')
    }
  }, [initialPrompt])

  useEffect(() => {
    if (!textareaRef.current) return

    textareaRef.current.style.height = '0px'
    const scrollHeight = textareaRef.current.scrollHeight
    textareaRef.current.style.height = `${scrollHeight}px`

    if (localPrompt.trim() === '') {
      if (isExpanded) setIsExpanded(false)
    } else if (!isExpanded && scrollHeight > 38) {
      setIsExpanded(true)
    }
  }, [localPrompt, isExpanded, setIsExpanded])

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = event.target.value
    setLocalPrompt(val)
    startTransition(() => {
      onPromptChange(val)
    })
  }

  const handleFocus = () => {
    isTyping.current = true
    onFocus()
  }

  const handleBlur = () => {
    isTyping.current = false
    onBlur()
  }

  return (
    <textarea
      ref={textareaRef}
      value={localPrompt}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={1}
      className={cn(
        'flex-1 resize-none bg-transparent text-[14px] leading-5 text-text-primary outline-none duration-300 placeholder:text-text-muted/55 scrollbar-hide',
        isExpanded
          ? 'max-h-48 min-h-[2rem] px-2 mb-14 py-1.5'
          : 'max-h-32 min-h-[2rem] py-1.5 pl-11 lg:pr-44'
      )}
      style={{ transitionProperty: 'margin' }}
    />
  )
}

export function PromptInput(): JSX.Element {
  const {
    prompt,
    setPrompt,
    negativePrompt,
    contentType,
    capabilityValues,
    activeMode,
    batchCount,
    selectedModel,
    startFrame,
    endFrame,
    referenceImages,
    setContentType,
    setCapabilityValue,
    setActiveMode,
    setBatchCount,
    setSelectedModel,
    setStartFrame,
    setEndFrame,
    addReferenceImage,
    removeReferenceImage,
    clearReferenceImages,
    addJob,
    updateJob
  } = useGenerationStore()
  const { enabledModelIds } = useModelStore()
  const { setActiveProvider } = useProviderStore()
  const [isFocused, setIsFocused] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const configRef = useRef<HTMLDivElement>(null)

  const availableTypes = useMemo(() => getAvailableContentTypes(enabledModelIds), [enabledModelIds])
  const modelsForType = useMemo(
    () => getModelsByContentType(contentType, enabledModelIds),
    [contentType, enabledModelIds]
  )
  const selectedModelDescriptor = useMemo(() => getModelById(selectedModel), [selectedModel])
  const isFramesMode = contentType === 'video' && activeMode === 'frames'
  const isIngredientsMode = activeMode === 'ingredients'
  const activeModeDescriptor =
    selectedModelDescriptor?.modes?.find((mode) => mode.id === activeMode) ?? null
  const visibleCapabilities = useMemo(
    () =>
      selectedModelDescriptor
        ? [...selectedModelDescriptor.capabilities, ...(activeModeDescriptor?.capabilities ?? [])]
        : [],
    [activeModeDescriptor, selectedModelDescriptor]
  )

  useEffect(() => {
    if (availableTypes.length === 0) return

    const selectedStillEnabled =
      selectedModelDescriptor &&
      enabledModelIds.has(selectedModelDescriptor.id) &&
      selectedModelDescriptor.contentType === contentType

    if (!selectedStillEnabled) {
      const fallbackType = availableTypes.includes(contentType) ? contentType : availableTypes[0]
      setContentType(fallbackType, enabledModelIds)
    }
  }, [availableTypes, contentType, enabledModelIds, selectedModelDescriptor, setContentType])

  useEffect(() => {
    if (!selectedModelDescriptor) return
    setActiveProvider(selectedModelDescriptor.provider)
    window.manthan?.setActiveProvider(selectedModelDescriptor.provider)
  }, [selectedModelDescriptor, setActiveProvider])

  const handleFileUpload = useCallback(
    async (target: 'start' | 'end' | 'reference') => {
      if (!window.manthan) return
      const file = await window.manthan.openFile()
      if (!file) return

      const input: BinaryInput = { data: file.data, mimeType: file.mimeType }
      if (target === 'start') {
        setStartFrame(input)
      } else if (target === 'end') {
        setEndFrame(input)
      } else {
        addReferenceImage(input)
      }
    },
    [addReferenceImage, setEndFrame, setStartFrame]
  )
  const handlePrimaryAttachment = useCallback(() => {
    if (contentType === 'image') {
      void handleFileUpload('reference')
      return
    }

    if (isIngredientsMode) {
      void handleFileUpload('reference')
      return
    }

    if (contentType === 'video' && !isFramesMode) {
      void handleFileUpload('start')
    }
  }, [contentType, handleFileUpload, isFramesMode, isIngredientsMode])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !selectedModelDescriptor || isGenerating) return

    const totalRequests =
      selectedModelDescriptor.contentType === 'audio' ? 1 : Math.max(1, batchCount)

    setIsGenerating(true)

    try {
      for (let index = 0; index < totalRequests; index += 1) {
        const payload = buildPayload({
          prompt,
          negativePrompt,
          selectedModel: selectedModelDescriptor,
          capabilityValues,
          startFrame,
          endFrame,
          referenceImages,
          batchCount: 1,
          activeMode
        })

        const jobId = `gen-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`
        const job: GenerationJob = {
          id: jobId,
          type: payload.contentType,
          status: 'generating',
          prompt: payload.params.prompt,
          negativePrompt:
            'negativePrompt' in payload.params ? payload.params.negativePrompt : undefined,
          provider: payload.providerId,
          model: selectedModelDescriptor.id,
          config: {
            contentType: payload.contentType,
            activeMode,
            batchCount: 1,
            capabilityValues: { ...capabilityValues, batch_count: 1 }
          },
          image: startFrame ?? undefined,
          lastFrame: endFrame ?? undefined,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          progress: 0,
          startedAt: Date.now()
        }

        addJob(job)

        if (!window.manthan) {
          setTimeout(() => {
            updateJob(jobId, { status: 'completed', progress: 100, completedAt: Date.now() })
          }, 1500)
          continue
        }

        await window.manthan.setActiveProvider(payload.providerId)

        if (payload.contentType === 'image') {
          const result = (await window.manthan.generateImage(
            payload.params as unknown as Record<string, unknown>
          )) as JobResult
          updateJob(jobId, {
            status: 'completed',
            progress: 100,
            completedAt: Date.now(),
            result
          })
          continue
        }

        if (payload.contentType === 'audio') {
          const result = (await window.manthan.generateAudio(
            payload.params as unknown as Record<string, unknown>
          )) as JobResult
          updateJob(jobId, {
            status: 'completed',
            progress: 100,
            completedAt: Date.now(),
            result
          })
          continue
        }

        const operation = (await window.manthan.generateVideo(
          payload.params as unknown as Record<string, unknown>
        )) as {
          id?: string
          status?: string
          error?: string
        }

        if (operation.status === 'failed') {
          updateJob(jobId, {
            status: 'failed',
            error: operation.error || 'Generation failed',
            completedAt: Date.now()
          })
          continue
        }

        if (operation.id) {
          updateJob(jobId, { id: operation.id })
        }
      }
    } catch (error) {
      console.error('Generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [
    activeMode,
    addJob,
    batchCount,
    capabilityValues,
    endFrame,
    isGenerating,
    negativePrompt,
    prompt,
    referenceImages,
    selectedModelDescriptor,
    startFrame,
    updateJob
  ])

  const promptPlaceholder = useMemo(() => {
    if (contentType === 'audio') return 'Describe the sound, score, or mood you want to create...'
    if (contentType === 'video' && activeMode === 'ingredients') {
      return 'Describe the scene and combine it with uploaded ingredients...'
    }
    if (contentType === 'video' && activeMode === 'frames') {
      return 'Describe the motion between your opening and closing frames...'
    }
    if (contentType === 'image' && referenceImages.length > 0) {
      return 'Describe how to transform the uploaded images...'
    }
    return 'Describe what you want to create...'
  }, [activeMode, contentType, startFrame])
  const estimatedCredits = useMemo(() => {
    const base =
      contentType === 'video' ? 10 : contentType === 'image' ? 6 : contentType === 'audio' ? 4 : 0
    return base * Math.max(1, batchCount)
  }, [batchCount, contentType])
  const showPrimaryAttachmentButton =
    (contentType !== 'audio' || isIngredientsMode) && !isFramesMode
  const hasAttachmentContent =
    Boolean(startFrame) || Boolean(endFrame) || referenceImages.length > 0 || isFramesMode

  useClickOutside(configRef, () => {
    setIsConfigOpen(false)
  })

  return (
    <motion.div className="absolute bottom-6 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-4">
      <div className="relative">
        <motion.div
          className={cn(
            'glass-strong relative overflow-visible rounded-[1.5rem] p-3 transition-shadow lg:p-4',
            isFocused ? 'shadow-glow shadow-float' : 'shadow-lg'
          )}
        >
          <div className="flex flex-col gap-2.5">
            {hasAttachmentContent ? (
              <div className="flex items-start">
                <PromptAttachmentArea
                  contentType={contentType}
                  activeMode={activeMode}
                  startFrame={startFrame}
                  endFrame={endFrame}
                  referenceImages={referenceImages}
                  maxImages={selectedModelDescriptor?.maxImages}
                  onStartUpload={() => handleFileUpload('start')}
                  onEndUpload={() => handleFileUpload('end')}
                  onReferenceUpload={() => handleFileUpload('reference')}
                  onStartClear={() => setStartFrame(null)}
                  onEndClear={() => setEndFrame(null)}
                  onReferenceClear={removeReferenceImage}
                  onClearReferences={clearReferenceImages}
                />
              </div>
            ) : null}

            <div className="relative flex w-full items-start">
              <OptimizedTextArea
                initialPrompt={prompt}
                onPromptChange={setPrompt}
                isExpanded={isExpanded}
                setIsExpanded={setIsExpanded}
                placeholder={promptPlaceholder}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleGenerate()
                  }
                }}
              />

              {showPrimaryAttachmentButton ? (
                <div
                  className={cn(
                    'absolute z-10 transition-all duration-300',
                    isExpanded ? 'bottom-1 left-1' : 'left-0 top-0'
                  )}
                >
                  <button
                    type="button"
                    onClick={handlePrimaryAttachment}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent text-text-secondary transition-colors hover:text-text-primary"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              'flex items-center justify-end gap-2.5 transition-all duration-300',
              isExpanded
                ? 'absolute bottom-3 right-3 lg:bottom-4 lg:right-4'
                : 'mt-4 lg:absolute lg:bottom-4 lg:right-4 lg:mt-0'
            )}
          >
            <div ref={configRef} className="relative">
              <AnimatePresence initial={false}>
                {isConfigOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ type: 'spring', bounce: 0.1, duration: 0.25 }}
                    className="absolute bottom-full right-0 z-30 mb-2.5 w-[min(26rem,calc(100vw-2rem))] max-w-[26rem]"
                  >
                    <div className="glass-strong overflow-hidden rounded-[1.5rem] p-2.5">
                      <div className="flex h-[22rem] flex-col gap-1.5 overflow-y-auto pr-1 scrollbar-hide">
                        <ContentTypeTabs
                          activeType={contentType}
                          availableTypes={availableTypes}
                          onChange={(type) => setContentType(type, enabledModelIds)}
                        />

                        {selectedModelDescriptor?.modes?.length ? (
                          <ModeTabs
                            modes={selectedModelDescriptor.modes}
                            activeMode={activeMode}
                            onChange={(modeId) => {
                              setActiveMode(modeId)
                            }}
                          />
                        ) : null}

                        <CapabilityRenderer
                          capabilities={visibleCapabilities}
                          values={capabilityValues}
                          batchCount={batchCount}
                          onSetValue={setCapabilityValue}
                          onSetBatchCount={setBatchCount}
                        />

                        <ModelSelector
                          models={modelsForType}
                          value={selectedModelDescriptor?.id ?? ''}
                          onChange={setSelectedModel}
                        />

                        {selectedModelDescriptor?.id === 'lyria-3-clip-preview' ? (
                          <div className="rounded-lg bg-black/20 p-2.5 text-[10px] text-text-muted leading-relaxed border border-white/5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-text-secondary">Duration</span>
                              <span>30s Fixed</span>
                            </div>
                          </div>
                        ) : selectedModelDescriptor?.id === 'lyria-3-pro-preview' ? (
                          <div className="rounded-lg bg-black/20 p-2.5 text-[10px] text-text-muted leading-relaxed border border-white/5 mt-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-text-secondary">
                                Max Duration
                              </span>
                              <span>Up to 184s (~3m 4s)</span>
                            </div>
                            <div className="mt-1 text-text-muted/70">
                              Duration is primarily controlled via prompt instructions.
                            </div>
                          </div>
                        ) : null}

                        <div className="pt-2 text-center text-[11px] font-medium text-text-muted">
                          Generating will use{' '}
                          <span className="font-semibold text-text-secondary underline decoration-text-muted/60 underline-offset-2">
                            {estimatedCredits} credits
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <BottomActionBar
                batchCount={batchCount}
                contentType={contentType}
                isOpen={isConfigOpen}
                onClick={() => setIsConfigOpen((open) => !open)}
              />
            </div>
            <button
              onClick={() => void handleGenerate()}
              disabled={!prompt.trim() || isGenerating || !selectedModelDescriptor}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full transition-all',
                prompt.trim() && selectedModelDescriptor
                  ? 'bg-white text-black shadow-[0_4px_16px_rgba(0,0,0,0.35)]'
                  : 'bg-bg-elevated text-text-muted',
                (!prompt.trim() || isGenerating || !selectedModelDescriptor) && 'cursor-not-allowed'
              )}
              type="button"
            >
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5" />
              )}
            </button>
          </div>
        </motion.div>
        <SelectedOptionsDisplay
          models={modelsForType}
          activeModeDescriptor={activeModeDescriptor}
          selectedModelDescriptor={selectedModelDescriptor}
          capabilities={visibleCapabilities}
          values={capabilityValues}
          onSetModel={setSelectedModel}
          onSetMode={setActiveMode}
          onSetValue={setCapabilityValue}
        />
      </div>
    </motion.div>
  )
}

function ContentTypeTabs({
  activeType,
  availableTypes,
  onChange
}: {
  activeType: ContentType
  availableTypes: ContentType[]
  onChange: (type: ContentType) => void
}): JSX.Element {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${availableTypes.length || 1}, minmax(0, 1fr))` }}
    >
      {availableTypes.map((type) => {
        const Icon = contentTypeMeta[type].icon
        const active = type === activeType

        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={cn(
              'flex h-[2.75rem] items-center justify-center gap-2 rounded-[1rem] border text-[0.85rem] font-medium transition-all',
              active
                ? 'border-transparent bg-white text-black'
                : 'border-transparent bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{contentTypeMeta[type].label}</span>
          </button>
        )
      })}
    </div>
  )
}

function ModeTabs({
  modes,
  activeMode,
  onChange
}: {
  modes: NonNullable<ModelDescriptor['modes']>
  activeMode: string | null
  onChange: (modeId: string) => void
}): JSX.Element {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
    >
      {modes.map((mode) => {
        const active = mode.id === activeMode
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className={cn(
              'flex h-[2.75rem] items-center justify-center gap-2 rounded-[1rem] border text-[0.85rem] font-medium transition-all',
              active
                ? 'border-transparent bg-white text-black'
                : 'border-transparent bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary'
            )}
          >
            {mode.id === 'frames' ? (
              <Film className="h-3.5 w-3.5" />
            ) : (
              <Package2 className="h-3.5 w-3.5" />
            )}
            <span>{mode.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function CapabilityRenderer({
  capabilities,
  values,
  batchCount,
  onSetValue,
  onSetBatchCount
}: {
  capabilities: ModelCapability[]
  values: Record<string, string | number | boolean>
  batchCount: number
  onSetValue: (key: string, value: string | number | boolean) => void
  onSetBatchCount: (value: number) => void
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {capabilities.map((capability) => {
        if (capability.type === 'frames') {
          return null
        }

        if (capability.type === 'ingredients') {
          return null
        }

        if (capability.type === 'duration') {
          const rawValue = values.duration
          const currentValue =
            typeof rawValue === 'number'
              ? rawValue
              : typeof rawValue === 'string'
                ? Number(rawValue)
                : Number(capability.defaultValue ?? capability.min ?? 15)

          return (
            <div
              key={capability.type}
              className="rounded-[14px] border border-border-subtle bg-bg-elevated/40 px-3 py-2"
            >
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-text-secondary">
                <span>{capability.label}</span>
                <span>{currentValue === 0 ? 'Auto (Prompt Guided)' : `${currentValue}s`}</span>
              </div>
              <input
                type="range"
                min={capability.min}
                max={capability.max}
                step={capability.step}
                value={currentValue}
                onChange={(event) => onSetValue(capability.type, Number(event.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>
          )
        }

        if (
          capability.type === 'audio_toggle' ||
          capability.type === 'include_thoughts' ||
          capability.type === 'web_search_grounding' ||
          capability.type === 'image_search_grounding'
        ) {
          const enabled = Boolean(values[capability.type] ?? capability.defaultValue ?? false)

          let IconComp = Volume2
          if (capability.type === 'include_thoughts') IconComp = Brain
          if (capability.type === 'web_search_grounding') IconComp = Globe
          if (capability.type === 'image_search_grounding') IconComp = Search

          return (
            <button
              key={capability.type}
              type="button"
              onClick={() => onSetValue(capability.type, !enabled)}
              className={cn(
                'flex h-9 items-center justify-center gap-2 rounded-[14px] border text-[0.85rem] font-medium transition-all',
                enabled
                  ? 'border-transparent bg-white text-black'
                  : 'border-border-subtle bg-bg-elevated/40 text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              )}
            >
              <IconComp className="h-4 w-4" />
              <span>{capability.label}</span>
            </button>
          )
        }

        if (capability.type === 'batch_count') {
          return (
            <PillRow
              key={capability.type}
              options={capability.options ?? []}
              activeValue={String(batchCount)}
              onChange={(value) => onSetBatchCount(Number(value))}
              variant="soft"
            />
          )
        }

        if (capability.type === 'aspect_ratio') {
          return (
            <AspectRatioRow
              key={capability.type}
              options={capability.options ?? []}
              activeValue={String(values[capability.type] ?? capability.defaultValue ?? '')}
              onChange={(value) => onSetValue(capability.type, value)}
            />
          )
        }

        if (
          capability.type === 'resolution' ||
          capability.type === 'style_select' ||
          capability.type === 'thinking_level' ||
          capability.type === 'audio_format'
        ) {
          return (
            <PillRow
              key={capability.type}
              options={capability.options ?? []}
              activeValue={String(values[capability.type] ?? capability.defaultValue ?? '')}
              onChange={(value) => onSetValue(capability.type, value)}
              variant="soft"
            />
          )
        }

        return null
      })}
    </div>
  )
}

function PillRow({
  options,
  activeValue,
  onChange,
  variant = 'soft'
}: {
  options: Array<{ value: string; label: string }>
  activeValue: string
  onChange: (value: string) => void
  variant?: 'soft' | 'text'
}): JSX.Element {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2 overflow-x-auto">
      {options.map((option) => {
        const active = option.value === activeValue

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'min-w-[4rem] rounded-[0.85rem] px-3 py-2 text-[0.85rem] font-medium transition-all',
              variant === 'soft'
                ? active
                  ? 'bg-white/18 text-text-primary'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary'
                : active
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function AspectRatioRow({
  options,
  activeValue,
  onChange
}: {
  options: Array<{ value: string; label: string }>
  activeValue: string
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${options.length || 1}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === activeValue

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-[3.25rem] flex-col items-center justify-center gap-1.5 rounded-[1rem] transition-all',
              active
                ? 'bg-white/18 text-text-primary'
                : 'bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary'
            )}
          >
            <AspectRatioIcon ratio={option.value} />
            <span className="text-[0.8rem] font-medium leading-none">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function AspectRatioIcon({ ratio }: { ratio: string }): JSX.Element {
  const className =
    ratio === '9:16'
      ? 'h-6 w-[0.7rem]'
      : ratio === '16:9'
        ? 'h-[0.7rem] w-6'
        : ratio === '1:1'
          ? 'h-3.5 w-3.5'
          : ratio === '4:3'
            ? 'h-3.5 w-4.5'
            : 'h-4.5 w-3.5'

  return <div className={cn('rounded-[4px] border-2 border-current opacity-90', className)} />
}

function ModelSelector({
  models,
  value,
  onChange
}: {
  models: ModelDescriptor[]
  value: string
  onChange: (modelId: string) => void
}): JSX.Element {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[2.75rem] w-full appearance-none rounded-[1rem] bg-white/5 px-3.5 pr-10 text-[0.85rem] font-medium text-text-primary outline-none transition-all hover:bg-white/10"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
    </div>
  )
}

function PromptAttachmentArea({
  contentType,
  activeMode,
  startFrame,
  endFrame,
  referenceImages,
  maxImages,
  onStartUpload,
  onEndUpload,
  onReferenceUpload,
  onStartClear,
  onEndClear,
  onReferenceClear,
  onClearReferences
}: {
  contentType: ContentType
  activeMode: string | null
  startFrame: BinaryInput | null
  endFrame: BinaryInput | null
  referenceImages: BinaryInput[]
  maxImages?: number
  onStartUpload: () => void
  onEndUpload: () => void
  onReferenceUpload: () => void
  onStartClear: () => void
  onEndClear: () => void
  onReferenceClear: (index: number) => void
  onClearReferences: () => void
}): JSX.Element | null {
  if (contentType === 'image' || (contentType === 'audio' && activeMode === 'ingredients')) {
    const totalImages = referenceImages.length
    const canAddMore = totalImages < (maxImages ?? 1)

    return (
      <div className="w-full rounded-[1.1rem] bg-white/4 p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary">
            {contentType === 'audio' ? 'Ingredients' : 'Reference Images'}
          </span>
          {referenceImages.length > 0 ? (
            <button
              type="button"
              onClick={onClearReferences}
              className="text-[11px] text-text-muted transition-colors hover:text-text-secondary"
            >
              Clear all
            </button>
          ) : null}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {referenceImages.map((img, index) => (
            <MediaPreviewChip
              key={index}
              label={contentType === 'audio' ? `Ingredient ${index + 1}` : `Reference ${index + 1}`}
              frame={img}
              onUpload={() => { }}
              onClear={() => onReferenceClear(index)}
            />
          ))}
          {canAddMore ? (
            <button
              type="button"
              onClick={onReferenceUpload}
              className="relative flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-dashed border-border-subtle bg-bg-elevated/30 text-text-muted transition-all hover:border-border-focus hover:bg-bg-hover"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  if (contentType === 'video' && activeMode === 'frames') {
    return (
      <div className="flex items-center gap-4">
        <FrameNode
          label="Start"
          frame={startFrame}
          onUpload={onStartUpload}
          onClear={onStartClear}
        />
        <ArrowLeftRight className="h-5 w-5 text-text-muted/60" />
        <FrameNode label="End" frame={endFrame} onUpload={onEndUpload} onClear={onEndClear} />
      </div>
    )
  }

  if (contentType === 'video' && activeMode === 'ingredients') {
    return (
      <div className="w-full max-w-[19rem] rounded-[1.1rem] bg-white/4 p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary">Ingredients</span>
          {referenceImages.length > 0 ? (
            <button
              type="button"
              onClick={onClearReferences}
              className="text-[11px] text-text-muted transition-colors hover:text-text-secondary"
            >
              Clear all
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <ReferenceSlot
              key={index}
              label={`Ingredient ${index + 1}`}
              image={referenceImages[index] ?? null}
              onUpload={onReferenceUpload}
              onClear={() => onReferenceClear(index)}
            />
          ))}
        </div>
      </div>
    )
  }

  return null
}

function BottomActionBar({
  batchCount,
  contentType,
  isOpen,
  onClick
}: {
  batchCount: number
  contentType: ContentType
  isOpen: boolean
  onClick: () => void
}): JSX.Element {
  const Icon = contentTypeMeta[contentType].icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-[1.1rem] px-3.5 py-2 text-[0.85rem] font-medium transition-colors',
        isOpen
          ? 'bg-white/20 text-text-primary'
          : 'bg-white/12 text-text-secondary hover:bg-white/18 hover:text-text-primary'
      )}
    >
      <span>{contentTypeMeta[contentType].label}</span>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-text-muted">{batchCount}x</span>
      <ChevronDown
        className={cn('h-3.5 w-3.5 text-text-muted transition-transform', isOpen && 'rotate-180')}
      />
    </button>
  )
}

function FrameNode({
  label,
  frame,
  onUpload,
  onClear
}: {
  label: string
  frame: BinaryInput | null
  onUpload: () => void
  onClear: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onUpload}
      className={cn(
        'relative flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center rounded-[1rem] border p-2 text-center transition-all',
        frame
          ? 'border-white/20 bg-white/10'
          : 'border-white/10 bg-transparent text-text-muted hover:border-white/20 hover:bg-white/5'
      )}
    >
      {frame ? (
        <>
          <img
            src={`data:${frame.mimeType};base64,${frame.data}`}
            alt={label}
            className="h-full w-full rounded-[0.9rem] object-cover"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onClear()
            }}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-bg-secondary text-text-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      ) : (
        <span className="text-[0.92rem] font-semibold">{label}</span>
      )}
    </button>
  )
}

function MediaPreviewChip({
  label,
  frame,
  onUpload,
  onClear
}: {
  label: string
  frame: BinaryInput | null
  onUpload: () => void
  onClear: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onUpload}
      className={cn(
        'relative flex h-[4.25rem] w-[4.25rem] items-center justify-center overflow-hidden rounded-[1rem] transition-all',
        frame ? 'bg-white/10' : 'bg-white/5 text-text-muted hover:bg-white/10'
      )}
    >
      {frame ? (
        <>
          <img
            src={`data:${frame.mimeType};base64,${frame.data}`}
            alt={label}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onClear()
            }}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-bg-secondary text-text-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      ) : (
        <ImageIcon className="h-5 w-5" />
      )}
    </button>
  )
}

function ReferenceSlot({
  label,
  image,
  onUpload,
  onClear
}: {
  label: string
  image: BinaryInput | null
  onUpload: () => void
  onClear: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onUpload}
      className={cn(
        'relative flex min-h-[4.75rem] flex-col items-center justify-center rounded-[14px] border border-dashed p-2 text-center transition-all',
        image
          ? 'border-accent/40 bg-accent-soft'
          : 'border-border-subtle bg-bg-elevated/30 text-text-muted hover:border-border-focus hover:bg-bg-hover'
      )}
    >
      {image ? (
        <>
          <img
            src={`data:${image.mimeType};base64,${image.data}`}
            alt={label}
            className="h-14 w-full rounded-[10px] object-cover"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onClear()
            }}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-bg-secondary text-text-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      ) : (
        <>
          <Sparkles className="mb-1.5 h-4 w-4" />
          <span className="text-xs font-medium">{label}</span>
        </>
      )}
    </button>
  )
}

function SelectedOptionsDisplay({
  models,
  activeModeDescriptor,
  selectedModelDescriptor,
  capabilities,
  values,
  onSetModel,
  onSetMode,
  onSetValue
}: {
  models: ModelDescriptor[]
  activeModeDescriptor: { id: string; label: string } | null | undefined
  selectedModelDescriptor: ModelDescriptor | null | undefined
  capabilities: ModelCapability[]
  values: Record<string, string | number | boolean>
  onSetModel: (id: string) => void
  onSetMode: (id: string) => void
  onSetValue: (key: string, val: string | number | boolean) => void
}): JSX.Element | null {
  if (!selectedModelDescriptor) return null

  const items: Array<{ label: string; onClick: () => void }> = []

  items.push({
    label: selectedModelDescriptor.name,
    onClick: () => {
      const currentIndex = models.findIndex((m) => m.id === selectedModelDescriptor.id)
      const nextIndex = (currentIndex + 1) % models.length
      onSetModel(models[nextIndex].id)
    }
  })

  if (
    activeModeDescriptor &&
    selectedModelDescriptor.modes &&
    selectedModelDescriptor.modes.length > 0
  ) {
    items.push({
      label: activeModeDescriptor.label,
      onClick: () => {
        const modes = selectedModelDescriptor.modes!
        const currentIndex = modes.findIndex((m) => m.id === activeModeDescriptor.id)
        const nextIndex = (currentIndex + 1) % modes.length
        onSetMode(modes[nextIndex].id)
      }
    })
  }

  capabilities.forEach((cap) => {
    if (cap.type === 'frames' || cap.type === 'ingredients' || cap.type === 'batch_count') return

    if (cap.type === 'duration') {
      const rawValue = values.duration
      const currentValue =
        typeof rawValue === 'number'
          ? rawValue
          : typeof rawValue === 'string'
            ? Number(rawValue)
            : Number(cap.defaultValue ?? cap.min ?? 15)
      items.push({
        label: `${currentValue}s`,
        onClick: () => {
          const step = cap.step ?? 1
          const max = cap.max ?? 30
          const min = cap.min ?? 1
          let nextValue = currentValue + step
          if (nextValue > max) nextValue = min
          onSetValue('duration', nextValue)
        }
      })
    } else if (
      cap.type === 'audio_toggle' ||
      cap.type === 'include_thoughts' ||
      cap.type === 'web_search_grounding' ||
      cap.type === 'image_search_grounding'
    ) {
      const enabled = Boolean(values[cap.type] ?? cap.defaultValue ?? false)
      let labelOn = 'On'
      let labelOff = 'Off'
      if (cap.type === 'audio_toggle') {
        labelOn = 'Sound On'
        labelOff = 'Sound Off'
      } else if (cap.type === 'include_thoughts') {
        labelOn = 'Thinking On'
        labelOff = 'Thinking Off'
      } else if (cap.type === 'web_search_grounding') {
        labelOn = 'Web Search On'
        labelOff = 'Web Search Off'
      } else if (cap.type === 'image_search_grounding') {
        labelOn = 'Image Search On'
        labelOff = 'Image Search Off'
      }

      items.push({
        label: enabled ? labelOn : labelOff,
        onClick: () => {
          onSetValue(cap.type, !enabled)
        }
      })
    } else if (
      cap.type === 'aspect_ratio' ||
      cap.type === 'resolution' ||
      cap.type === 'style_select' ||
      cap.type === 'thinking_level'
    ) {
      const val = String(values[cap.type] ?? cap.defaultValue ?? '')
      const optIndex = cap.options?.findIndex((o) => String(o.value) === val) ?? -1
      const opt = cap.options?.[optIndex !== -1 ? optIndex : 0]
      if (opt && cap.options) {
        items.push({
          label: opt.label,
          onClick: () => {
            const nextIndex = (optIndex + 1) % cap.options!.length
            onSetValue(cap.type, cap.options![nextIndex].value)
          }
        })
      }
    }
  })

  if (items.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2.5 flex flex-wrap items-center justify-center gap-2 px-1"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={item.onClick}
          className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[11px] font-medium text-text-secondary backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-text-primary"
        >
          {item.label}
        </button>
      ))}
    </motion.div>
  )
}
