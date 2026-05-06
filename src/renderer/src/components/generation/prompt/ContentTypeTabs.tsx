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
    <div className="flex w-full shrink-0 min-h-11 gap-2 overflow-x-auto">
      {availableTypes.map((type) => {
        const Icon = contentTypeMeta[type].icon
        const active = type === activeType

        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={cn(
              'flex h-11 flex-1 min-w-24 items-center justify-center gap-2 rounded-xl border text-[0.85rem] font-medium transition-all',
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
