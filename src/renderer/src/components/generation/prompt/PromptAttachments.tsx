import { type JSX } from 'react'
import { ArrowLeftRight, Image as ImageIcon, Plus, Sparkles, X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { BinaryInput } from '../../../stores/generation-store'
import type { ContentType } from '../../../lib/model-capabilities'

// ── Frame Node ────────────────────────────────────────────

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

// ── Media Preview Chip ────────────────────────────────────

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

// ── Reference Slot ────────────────────────────────────────

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

// ── Prompt Attachment Area ────────────────────────────────

export function PromptAttachmentArea({
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
