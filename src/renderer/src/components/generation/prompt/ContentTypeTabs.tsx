import { type JSX } from 'react'
import { cn } from '../../../lib/utils'
import { contentTypeMeta } from './constants'
import type { ContentType } from '../../../lib/model-capabilities'

export function ContentTypeTabs({
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
