import { type JSX } from 'react'
import { motion } from 'framer-motion'
import type { ModelCapability, ModelDescriptor } from '../../../lib/model-capabilities'

export function SelectedOptionsDisplay({
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
          className="rounded-full bg-bg-elevated border border-border px-3 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          {item.label}
        </button>
      ))}
    </motion.div>
  )
}
