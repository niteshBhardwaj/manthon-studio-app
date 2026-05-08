// ============================================================
// Manthan Studio — Prompt Input
// Main generation interface component
// ============================================================

import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Loader2, Plus } from 'lucide-react'
import { useGenerationStore, type BinaryInput } from '../../stores/generation-store'
import { useModelStore } from '../../stores/model-store'
import { useProviderStore } from '../../stores/provider-store'
import { useProjectStore } from '../../stores/project-store'
import useClickOutside from '../../hooks/useClickOutside'
import { enqueueGeneration } from '../../lib/enqueue-generation'
import {
  getAvailableContentTypes,
  getModelById,
  getModelsByContentType
} from '../../lib/model-capabilities'
import { cn } from '../../lib/utils'

import {
  OptimizedTextArea,
  ContentTypeTabs,
  ModeTabs,
  CapabilityRenderer,
  ModelSelector,
  PromptAttachmentArea,
  BottomActionBar,
  SelectedOptionsDisplay
} from './prompt'
import { AssetPickerModal } from './AssetPickerModal'
import { MorphingDialog, MorphingDialogTrigger } from '../motion-primitives/morphing-dialog'

interface PromptInputProps {
  variant?: 'default' | 'lightbox'
  value?: string
  onChange?: (value: string) => void
  selectedModel?: string
  onModelChange?: (modelId: string) => void
  onSubmit?: () => void
}

export function PromptInput({ 
  variant = 'default',
  value,
  onChange,
  selectedModel: selectedModelProp,
  onModelChange,
  onSubmit
}: PromptInputProps): JSX.Element {
  const {
    prompt,
    setPrompt,
    negativePrompt,
    contentType,
    capabilityValues,
    activeMode,
    batchCount,
    selectedModel,
    extendingJobId,
    startFrame,
    endFrame,
    videoInput,
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
    resetPromptAfterSubmit,
    addJob
  } = useGenerationStore()
  const { enabledModelIds } = useModelStore()
  const { setActiveProvider } = useProviderStore()
  const { activeProjectId } = useProjectStore()
  const [isFocused, setIsFocused] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false)
  const [assetPickerTarget, setAssetPickerTarget] = useState<'start' | 'end' | 'reference'>('reference')
  const configRef = useRef<HTMLDivElement>(null)

  // ── Controlled vs Uncontrolled ─────────────────────────
  const effectivePrompt = value !== undefined ? value : prompt
  const handlePromptChange = onChange || setPrompt

  // ── Model isolation ────────────────────────────────────
  const effectiveSelectedModel = selectedModelProp !== undefined ? selectedModelProp : selectedModel
  const handleModelChange = onModelChange || setSelectedModel

  // ── Derived state ──────────────────────────────────────

  const availableTypes = useMemo(() => getAvailableContentTypes(enabledModelIds), [enabledModelIds])
  const modelsForType = useMemo(
    () => getModelsByContentType(contentType, enabledModelIds),
    [contentType, enabledModelIds]
  )
  const selectedModelDescriptor = useMemo(() => getModelById(effectiveSelectedModel), [effectiveSelectedModel])
  const isExtendMode = Boolean(extendingJobId)
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

  // ── Effects ────────────────────────────────────────────

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

  // ── Handlers ───────────────────────────────────────────

  const handleFileUpload = useCallback(
    (target: 'start' | 'end' | 'reference') => {
      setAssetPickerTarget(target)
      setIsAssetPickerOpen(true)
    },
    []
  )

  const handleAssetSelect = useCallback(async (assets: import('../../../../preload/index.d').AssetInfo[]) => {
    if (!window.manthan) return
    setIsAssetPickerOpen(false)

    for (const asset of assets) {
      try {
        const base64Data = await window.manthan.readAsset(asset.id)
        if (!base64Data) continue

        const input: BinaryInput = { data: base64Data, mimeType: asset.mime_type }

        if (assetPickerTarget === 'start') {
          setStartFrame(input)
        } else if (assetPickerTarget === 'end') {
          setEndFrame(input)
        } else {
          addReferenceImage(input)
        }
      } catch (error) {
        console.error('Failed to read asset:', error)
      }
    }
  }, [assetPickerTarget, addReferenceImage, setEndFrame, setStartFrame])

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
    if (onSubmit) {
      onSubmit()
      return
    }

    if (!effectivePrompt.trim() || !selectedModelDescriptor || isGenerating) return

    setIsGenerating(true)

    try {
      const createdJobs = await enqueueGeneration({
        prompt: effectivePrompt,
        negativePrompt,
        selectedModel: effectiveSelectedModel,
        capabilityValues: capabilityValues as Record<string, string | number | boolean>,
        startFrame,
        endFrame,
        videoInput,
        referenceImages,
        batchCount: selectedModelDescriptor.contentType === 'audio' ? 1 : Math.max(1, batchCount),
        activeMode,
        activeProjectId
      })

      createdJobs.forEach((job) => addJob(job))
      resetPromptAfterSubmit()
    } catch (error) {
      console.error('Generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [
    onSubmit,
    activeMode,
    activeProjectId,
    addJob,
    batchCount,
    capabilityValues,
    endFrame,
    isGenerating,
    negativePrompt,
    prompt,
    referenceImages,
    resetPromptAfterSubmit,
    selectedModel,
    selectedModelDescriptor,
    startFrame
  ])

  // ── Computed values ────────────────────────────────────

  const promptPlaceholder = useMemo(() => {
    if (isExtendMode || variant === 'lightbox') return 'What happens next?'
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
  }, [activeMode, contentType, isExtendMode, referenceImages.length])

  const estimatedCredits = useMemo(() => {
    const base =
      contentType === 'video' ? 10 : contentType === 'image' ? 6 : contentType === 'audio' ? 4 : 0
    return base * Math.max(1, batchCount)
  }, [batchCount, contentType])

  const showPrimaryAttachmentButton =
    variant !== 'lightbox' &&
    !isExtendMode &&
    (contentType !== 'audio' || isIngredientsMode) && !isFramesMode
  const hasAttachmentContent =
    variant !== 'lightbox' &&
    !isExtendMode && (Boolean(startFrame) || Boolean(endFrame) || referenceImages.length > 0 || isFramesMode)

  useClickOutside(configRef, (event) => {
    const target = event.target as Element
    // Don't close if clicking inside a radix portal (like the Select dropdown)
    if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-radix-portal]')) {
      return
    }
    setIsConfigOpen(false)
  })

  // ── Render ─────────────────────────────────────────────

  return (
    <MorphingDialog isOpen={isAssetPickerOpen} setIsOpen={setIsAssetPickerOpen}>
      <motion.div
        className={cn(
          'w-full max-w-3xl px-4',
          variant === 'default' && 'absolute bottom-6 left-1/2 z-40 -translate-x-1/2'
        )}
      >
        <div className="relative">
          <motion.div
            className={cn(
              'bg-bg-secondary border border-border shadow-2xl relative overflow-visible rounded-[1.5rem] p-3 transition-shadow lg:p-4',
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
                  initialPrompt={effectivePrompt}
                  onPromptChange={handlePromptChange}
                  isExpanded={isExpanded}
                  setIsExpanded={setIsExpanded}
                  placeholder={promptPlaceholder}
                  hasAttachmentButton={showPrimaryAttachmentButton}
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
                    <MorphingDialogTrigger onClick={handlePrimaryAttachment}>
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent text-text-secondary transition-colors hover:text-text-primary"
                      >
                        <Plus className="h-5 w-5" />
                      </div>
                    </MorphingDialogTrigger>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Bottom bar: config popover + generate button ── */}
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
                      <div className="bg-bg-secondary border border-border shadow-2xl overflow-hidden rounded-[1.5rem] p-2.5">
                        <div className="flex h-88 flex-col gap-1.5 overflow-y-auto pr-1">
                          {!isExtendMode ? (
                            <ContentTypeTabs
                              activeType={contentType}
                              availableTypes={availableTypes}
                              onChange={(type) => setContentType(type, enabledModelIds)}
                            />
                          ) : null}

                          {!isExtendMode ? (
                            <ModelSelector
                              models={modelsForType}
                              value={selectedModelDescriptor?.id ?? ''}
                              onChange={handleModelChange}
                            />
                          ) : null}

                          {!isExtendMode && selectedModelDescriptor?.modes?.length ? (
                            <ModeTabs
                              modes={selectedModelDescriptor.modes}
                              activeMode={activeMode}
                              onChange={(modeId) => {
                                setActiveMode(modeId)
                              }}
                            />
                          ) : null}

                          {!isExtendMode ? (
                            <CapabilityRenderer
                              capabilities={visibleCapabilities}
                              values={capabilityValues}
                              batchCount={batchCount}
                              onSetValue={setCapabilityValue}
                              onSetBatchCount={setBatchCount}
                            />
                          ) : null}

                          {!isExtendMode && selectedModelDescriptor?.id === 'lyria-3-clip-preview' ? (
                            <div className="rounded-lg bg-black/20 p-2.5 text-[10px] text-text-muted leading-relaxed border border-white/5">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-text-secondary">Duration</span>
                                <span>30s Fixed</span>
                              </div>
                            </div>
                          ) : !isExtendMode && selectedModelDescriptor?.id === 'lyria-3-pro-preview' ? (
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

                          {!isExtendMode ? (
                            <div className="pt-2 text-center text-[11px] font-medium text-text-muted">
                              Generating will use{' '}
                              <span className="font-semibold text-text-secondary underline decoration-text-muted/60 underline-offset-2">
                                {estimatedCredits} credits
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {variant !== 'lightbox' ? (
                  <BottomActionBar
                    batchCount={batchCount}
                    contentType={contentType}
                    isOpen={isConfigOpen}
                    onClick={() => setIsConfigOpen((open) => !open)}
                  />
                ) : null}

                {variant === 'lightbox' ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedModelDescriptor?.id ?? ''}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className="h-9 cursor-pointer appearance-none rounded-full bg-white/10 px-4 pr-8 text-[0.85rem] font-medium text-text-primary outline-none transition-colors hover:bg-white/15 focus:ring-1 focus:ring-border"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 10px center'
                      }}
                    >
                      {getModelsByContentType('video', enabledModelIds)
                        .filter((m) => m.supportsVideoExtension)
                        .map((model) => (
                          <option key={model.id} value={model.id} className="bg-bg-primary text-text-primary">
                            {model.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
              </div>
              
              <button
                  onClick={() => void handleGenerate()}
                  disabled={!effectivePrompt.trim() || isGenerating || !selectedModelDescriptor}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-all',
                    effectivePrompt.trim() && selectedModelDescriptor
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
          {variant !== 'lightbox' && !isExtendMode ? (
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
          ) : null}
        </div>
        <AssetPickerModal
          isOpen={isAssetPickerOpen}
          onClose={() => setIsAssetPickerOpen(false)}
          onSelect={handleAssetSelect}
          currentContentType={contentType}
        />
      </motion.div>
    </MorphingDialog>
  )
}
