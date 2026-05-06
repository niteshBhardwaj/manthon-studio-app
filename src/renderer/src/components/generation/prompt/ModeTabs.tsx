import { type JSX } from 'react'
import { Film, Package2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { ModelDescriptor } from '../../../lib/model-capabilities'

export function ModeTabs({
  modes,
  activeMode,
  onChange
}: {
  modes: NonNullable<ModelDescriptor['modes']>
  activeMode: string | null
  onChange: (modeId: string) => void
}): JSX.Element {
  return (
    <div className="flex w-full shrink-0 min-h-[2.75rem] gap-2 overflow-x-auto">
      {modes.map((mode) => {
        const active = mode.id === activeMode
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className={cn(
              'flex h-[2.75rem] flex-1 min-w-[6rem] items-center justify-center gap-2 rounded-[1rem] border text-[0.85rem] font-medium transition-all',
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
