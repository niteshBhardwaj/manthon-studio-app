import { type JSX, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import type { DashboardFeedItem } from '../../hooks/useDashboardFeed'
import { DashboardCard } from './DashboardCard'

function formatGroupLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfItemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((startOfToday - startOfItemDay) / 86400000)

  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'

  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
  const startOfWeek = startOfToday - (dayOfWeek - 1) * 86400000
  if (startOfItemDay >= startOfWeek) {
    return date.toLocaleDateString(undefined, { weekday: 'long' })
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MediaTimeline({
  title,
  items,
  hasMore,
  onLoadMore,
  selectedId,
  openItemId,
  onSelect,
  onToggleStar,
  onDelete,
  onRerun,
  onDownload,
  onOpen,
  onClose
}: {
  title?: string
  items: DashboardFeedItem[]
  hasMore?: boolean
  onLoadMore?: () => Promise<void>
  selectedId: string | null
  openItemId: string | null
  onSelect: (id: string) => void
  onToggleStar: (id: string) => void
  onDelete: (id: string) => void
  onRerun: (item: DashboardFeedItem) => void
  onDownload: (item: DashboardFeedItem) => void
  onOpen: (id: string) => void
  onClose: () => void
}): JSX.Element | null {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasMore || !onLoadMore || !sentinelRef.current) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void onLoadMore()
      }
    })

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  const groups = useMemo(() => {
    const mapped = new Map<string, DashboardFeedItem[]>()

    for (const item of items) {
      const label = formatGroupLabel(item.createdAt)
      const existing = mapped.get(label) ?? []
      existing.push(item)
      mapped.set(label, existing)
    }

    return Array.from(mapped.entries())
  }, [items])

  if (items.length === 0) return null

  return (
    <div className="space-y-6">
      {title ? (
        <div className="flex items-center gap-3 px-1">
          <span className="text-sm font-medium text-text-primary">{title}</span>
          <span className="h-px flex-1 bg-border-subtle" />
        </div>
      ) : null}

      {groups.map(([label, groupItems]) => (
        <section key={label} className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">{label}</span>
            <span className="h-px flex-1 bg-border-subtle" />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {groupItems.map((item) => (
              <DashboardCard
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                isOpen={openItemId === item.id}
                onOpen={() => onOpen(item.id)}
                onClose={onClose}
                onSelect={() => onSelect(item.id)}
                onToggleStar={() => onToggleStar(item.id)}
                onDelete={() => onDelete(item.id)}
                onRerun={() => onRerun(item)}
                onDownload={() => onDownload(item)}
              />
            ))}
          </motion.div>
        </section>
      ))}

      {hasMore ? <div ref={sentinelRef} className="h-10" /> : null}
    </div>
  )
}
