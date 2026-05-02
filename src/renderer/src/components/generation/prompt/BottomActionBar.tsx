import { type JSX } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { contentTypeMeta } from './constants'
import type { ContentType } from '../../../lib/model-capabilities'

export function BottomActionBar({
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
