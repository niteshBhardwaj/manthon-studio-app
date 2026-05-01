// ============================================================
// Manthan Studio — History Page
// Browse past generation jobs
// ============================================================

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, Video, Image as ImageIcon, Music, Trash2, Search, RotateCcw } from 'lucide-react'
import { cn } from '../lib/utils'

interface HistoryItem {
  id: string
  type: 'video' | 'image' | 'audio'
  status: string
  prompt: string
  provider: string
  startedAt: number
  completedAt?: number
}

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [filter, setFilter] = useState<'all' | 'video' | 'image' | 'audio'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (window.manthan) {
      window.manthan.getHistory().then((data) => {
        setHistory(data as unknown as HistoryItem[])
      })
    }
  }, [])

  const filtered = history.filter((item) => {
    if (filter !== 'all' && item.type !== filter) return false
    if (searchQuery && !item.prompt.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const handleClearHistory = async () => {
    if (window.manthan) {
      await window.manthan.clearHistory()
      setHistory([])
    }
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-3.5 h-3.5" />
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5" />
      case 'audio':
        return <Music className="w-3.5 h-3.5" />
      default:
        return <Clock className="w-3.5 h-3.5" />
    }
  }

  const formatTime = (ts: number) => {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-text-primary mb-1">History</h2>
          <p className="text-xs text-text-muted">{history.length} total generations</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-error hover:bg-error/5 border border-border-subtle transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by prompt..."
            className="w-full h-8 pl-9 pr-3 text-xs rounded-lg bg-bg-input border border-border-subtle text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-1 bg-bg-elevated rounded-lg p-0.5">
          {(['all', 'video', 'image', 'audio'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all',
                filter === f
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* History list */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <Clock className="w-10 h-10 text-text-muted/30 mb-3" />
          <p className="text-sm text-text-muted mb-1">No history yet</p>
          <p className="text-xs text-text-muted/60">Your generations will appear here</p>
        </motion.div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group flex items-center gap-3 p-3 rounded-xl bg-bg-elevated/50 border border-border-subtle hover:border-border hover:bg-bg-elevated transition-all cursor-pointer"
            >
              {/* Type icon */}
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  item.type === 'video'
                    ? 'bg-blue-500/10 text-blue-400'
                    : item.type === 'image'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                )}
              >
                {typeIcon(item.type)}
              </div>

              {/* Prompt */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-primary truncate">{item.prompt}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-text-muted">{item.provider}</span>
                  <span className="text-[10px] text-text-muted">·</span>
                  <span className="text-[10px] text-text-muted">{formatTime(item.startedAt)}</span>
                </div>
              </div>

              {/* Status */}
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium',
                  item.status === 'completed'
                    ? 'bg-success/10 text-success'
                    : item.status === 'failed'
                      ? 'bg-error/10 text-error'
                      : 'bg-warning/10 text-warning'
                )}
              >
                {item.status}
              </span>

              {/* Re-run */}
              <button className="w-6 h-6 rounded flex items-center justify-center text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-secondary hover:bg-bg-hover transition-all">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
