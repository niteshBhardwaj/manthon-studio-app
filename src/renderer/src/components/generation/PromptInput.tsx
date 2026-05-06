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
import { buildPayload } from '../../lib/build-payload'
import useClickOutside from '../../hooks/useClickOutside'
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
    clearReferenceImages
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

  // ── Derived state ──────────────────────────────────────

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

        if (!window.manthan) {
          continue
        }

        try {
          await window.manthan.setActiveProvider(payload.providerId)

          const queueInput = {
            projectId: activeProjectId,
            type: payload.contentType,
            prompt: payload.params.prompt,
            negativePrompt:
              'negativePrompt' in payload.params ? payload.params.negativePrompt : undefined,
            provider: payload.providerId,
            model: selectedModelDescriptor.id,
            config: {
              contentType: payload.contentType,
              activeMode,
              batchCount: 1,
              capabilityValues: { ...capabilityValues, batch_count: 1 },
              providerParams: payload.params
            },
            inputAssets: [
              ...(startFrame ? [{ ...startFrame, referenceType: 'start-frame' as const }] : []),
              ...(endFrame ? [{ ...endFrame, referenceType: 'end-frame' as const }] : []),
              ...referenceImages.map((image) => ({
                ...image,
                referenceType: 'reference' as const
              }))
            ]
          }

          if (payload.contentType === 'image') {
            await window.manthan.generateImage(queueInput)
            continue
          }

          if (payload.contentType === 'audio') {
            await window.manthan.generateAudio(queueInput)
            continue
          }

          await window.manthan.generateVideo(queueInput)
        } catch (jobError) {
          console.error('Job enqueue failed:', jobError)

          let errorMessage = jobError instanceof Error ? jobError.message : String(jobError)
          if (errorMessage.includes('Provider not initialized')) {
            errorMessage = 'Provider not initialized. Please add your API key in the settings.'
          }

          throw new Error(errorMessage)
        }
      }
    } catch (error) {
      console.error('Generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [
    activeMode,
    batchCount,
    capabilityValues,
    endFrame,
    isGenerating,
    negativePrompt,
    prompt,
    referenceImages,
    selectedModelDescriptor,
    startFrame,
    activeProjectId
  ])

  // ── Computed values ────────────────────────────────────

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
  }, [activeMode, contentType, referenceImages.length])

  const estimatedCredits = useMemo(() => {
    const base =
      contentType === 'video' ? 10 : contentType === 'image' ? 6 : contentType === 'audio' ? 4 : 0
    return base * Math.max(1, batchCount)
  }, [batchCount, contentType])

  const showPrimaryAttachmentButton =
    (contentType !== 'audio' || isIngredientsMode) && !isFramesMode
  const hasAttachmentContent =
    Boolean(startFrame) || Boolean(endFrame) || referenceImages.length > 0 || isFramesMode

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
      <motion.div className="absolute bottom-6 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-4">
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
                  initialPrompt={prompt}
                  onPromptChange={setPrompt}
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
                          <ContentTypeTabs
                            activeType={contentType}
                            availableTypes={availableTypes}
                            onChange={(type) => setContentType(type, enabledModelIds)}
                          />

                          <ModelSelector
                            models={modelsForType}
                            value={selectedModelDescriptor?.id ?? ''}
                            onChange={setSelectedModel}
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
