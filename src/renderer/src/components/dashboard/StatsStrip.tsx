import { type JSX } from 'react'
import { HardDrive, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`.replace('.0', '')
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatRelative(ts?: number | null): string {
  if (!ts) return 'No recent generations'
  const diffMs = Date.now() - ts
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Last generated just now'
  if (diffMins < 60) return `Last generated ${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Last generated ${diffHours}h ago`
  return `Last generated ${Math.floor(diffHours / 24)}d ago`
}

export function StatsStrip({
  stats,
  latestGeneratedAt,
  filteredCount,
  totalCount
}: {
  stats: { video: number; image: number; audio: number; totalSize: number }
  latestGeneratedAt?: number | null
  filteredCount: number
  totalCount: number
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted"
    >
      <div className="inline-flex items-center gap-1.5 text-text-secondary">
        <Sparkles className="h-3 w-3 text-accent" />
        <span>
          {stats.video} videos • {stats.image} images • {stats.audio} audio
        </span>
      </div>

      <div className="inline-flex items-center gap-1.5 text-text-secondary">
        <HardDrive className="h-3 w-3" />
        <span>{formatBytes(stats.totalSize)}</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
        {filteredCount !== totalCount ? <span>Showing {filteredCount} of {totalCount}</span> : null}
        <span>{formatRelative(latestGeneratedAt)}</span>
      </div>
    </motion.div>
  )
}
