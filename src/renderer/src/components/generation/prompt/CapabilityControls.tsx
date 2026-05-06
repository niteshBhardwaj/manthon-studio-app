import { type JSX } from 'react'
import { Brain, Globe, Search, Volume2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { ModelCapability } from '../../../lib/model-capabilities'

// ── Aspect Ratio Icon ──────────────────────────────────────

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

// ── Pill Row ───────────────────────────────────────────────

export function PillRow({
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
    <div className="flex w-full shrink-0 gap-2 overflow-x-auto">
      {options.map((option) => {
        const active = option.value === activeValue

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 min-w-[5rem] rounded-[0.85rem] px-3 py-2 text-[0.85rem] font-medium transition-all',
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

// ── Aspect Ratio Row ──────────────────────────────────────

export function AspectRatioRow({
  options,
  activeValue,
  onChange
}: {
  options: Array<{ value: string; label: string }>
  activeValue: string
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <div className="flex w-full shrink-0 min-h-[3.25rem] gap-2 overflow-x-auto">
      {options.map((option) => {
        const active = option.value === activeValue

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-[3.25rem] flex-1 min-w-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-[1rem] transition-all',
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

// ── Capability Renderer ───────────────────────────────────

export function CapabilityRenderer({
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
