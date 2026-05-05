import { type JSX, useEffect, useMemo, useState } from 'react'
import { Database, FolderOpen, HardDrive, RefreshCw, Trash2 } from 'lucide-react'
import type {
  DiskInfo,
  RetentionPolicy,
  StorageReport
} from '../../../../main/store/storage-manager'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

const CHART_SEGMENTS = [
  { key: 'video', label: 'Video', color: '#3b82f6' },
  { key: 'image', label: 'Image', color: '#f59e0b' },
  { key: 'audio', label: 'Audio', color: '#10b981' },
  { key: 'cache', label: 'Cache', color: '#64748b' },
  { key: 'database', label: 'Database', color: '#8b5cf6' }
] as const

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angle: number
): { x: number; y: number } {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  }
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

export function StorageDashboard(): JSX.Element {
  const [report, setReport] = useState<StorageReport | null>(null)
  const [diskInfo, setDiskInfo] = useState<DiskInfo | null>(null)
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<'cache' | 'policy' | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const loadStorageState = async (): Promise<void> => {
    if (!window.manthan) return
    setLoading(true)
    try {
      const [nextReport, nextDiskInfo, nextPolicy] = await Promise.all([
        window.manthan.getStorageBreakdown(),
        window.manthan.getSystemDiskInfo(),
        window.manthan.getRetentionPolicy()
      ])
      setReport(nextReport)
      setDiskInfo(nextDiskInfo)
      setPolicy(nextPolicy)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadStorageState()
    }, 0)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [])

  const chartSegments = useMemo(() => {
    const total = report?.breakdown.total ?? 0
    if (total <= 0) return []

    let currentAngle = 0
    return CHART_SEGMENTS.map((segment) => {
      const value = report?.breakdown[segment.key] ?? 0
      const angle = (value / total) * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle
      currentAngle = endAngle

      return {
        ...segment,
        value,
        path: angle > 0 ? describeArc(80, 80, 58, startAngle, endAngle) : null
      }
    }).filter((segment) => segment.value > 0)
  }, [report])

  const appUsageRatio =
    diskInfo && diskInfo.totalSpace > 0 ? Math.min(diskInfo.usedByApp / diskInfo.totalSpace, 1) : 0
  const thresholdExceeded =
    policy?.maxStorageMB != null &&
    (report?.breakdown.total ?? 0) > policy.maxStorageMB * 1024 * 1024

  const updatePolicy = async (nextPolicy: RetentionPolicy): Promise<void> => {
    setPolicy(nextPolicy)
    await window.manthan?.setRetentionPolicy(nextPolicy)
  }

  if (loading || !report || !diskInfo || !policy) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-text-muted">
        Loading storage details...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="rounded-[28px] border border-border-subtle bg-bg-elevated/30 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <HardDrive className="h-4 w-4 text-text-muted" />
            Storage Breakdown
          </div>

          <div className="flex flex-col items-center">
            <svg viewBox="0 0 160 160" className="h-48 w-48">
              <circle
                cx="80"
                cy="80"
                r="58"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="18"
              />
              {chartSegments.map((segment) => (
                <path
                  key={segment.key}
                  d={segment.path ?? ''}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
              ))}
              <text x="80" y="74" textAnchor="middle" className="fill-text-muted text-[11px]">
                Total Used
              </text>
              <text
                x="80"
                y="95"
                textAnchor="middle"
                className="fill-white text-[16px] font-semibold"
              >
                {formatBytes(report.breakdown.total)}
              </text>
            </svg>

            <div className="mt-2 w-full space-y-2">
              {CHART_SEGMENTS.map((segment) => {
                const value = report.breakdown[segment.key]
                return (
                  <div key={segment.key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span>{segment.label}</span>
                    </div>
                    <span className="text-text-muted">{formatBytes(value)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-[28px] border border-border-subtle bg-bg-elevated/30 p-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Database className="h-4 w-4 text-text-muted" />
              Disk Space
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-bg-primary">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  appUsageRatio > 0.8 ? 'bg-red-400' : 'bg-accent'
                )}
                style={{ width: `${Math.max(appUsageRatio * 100, 1)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {formatBytes(diskInfo.usedByApp)} of {formatBytes(diskInfo.totalSpace)} used by
              Manthan Studio
            </p>
            <p className="mt-1 text-[11px] text-text-muted">
              {formatBytes(diskInfo.freeSpace)} free on this drive
            </p>
            {thresholdExceeded ? (
              <p className="mt-2 text-xs text-amber-300">
                Current storage is above your warning threshold of {policy.maxStorageMB} MB.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busyAction === 'cache'}
              onClick={async () => {
                if (!window.manthan) return
                const confirmed = window.confirm(
                  `Clean cached files now? This will free about ${formatBytes(report.breakdown.cache)}.`
                )
                if (!confirmed) return
                setBusyAction('cache')
                const freedBytes = await window.manthan.cleanupCache()
                setStatusMessage(`Cleared ${formatBytes(freedBytes)} from cache.`)
                await loadStorageState()
                setBusyAction(null)
              }}
            >
              {busyAction === 'cache' ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Clean Cache ({formatBytes(report.breakdown.cache)})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void window.manthan?.openStorageFolder()}
            >
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
              Open Storage Folder
            </Button>
          </div>

          {statusMessage ? <p className="text-xs text-text-muted">{statusMessage}</p> : null}
        </div>
      </div>

      <div className="rounded-[28px] border border-border-subtle bg-bg-elevated/30 p-5">
        <div className="mb-4 text-sm font-semibold text-text-primary">Retention Policy</div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-bg-secondary/30 px-4 py-3">
            <div>
              <p className="text-sm text-text-primary">Auto-delete un-starred generations</p>
              <p className="text-xs text-text-muted">Older outputs can be removed automatically.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policy.deleteUnstarredAfterDays != null}
                onChange={(event) =>
                  void updatePolicy({
                    ...policy,
                    deleteUnstarredAfterDays: event.target.checked
                      ? (policy.deleteUnstarredAfterDays ?? 30)
                      : null
                  })
                }
              />
              <Input
                type="number"
                min="1"
                value={policy.deleteUnstarredAfterDays ?? 30}
                disabled={policy.deleteUnstarredAfterDays == null}
                onChange={(event) =>
                  void updatePolicy({
                    ...policy,
                    deleteUnstarredAfterDays: Number(event.target.value) || 30
                  })
                }
                className="h-10 w-24 rounded-xl border border-border-subtle bg-bg-input text-xs"
              />
              <span className="text-xs text-text-muted">days</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-bg-secondary/30 px-4 py-3">
            <div>
              <p className="text-sm text-text-primary">Clear temp cache on app exit</p>
              <p className="text-xs text-text-muted">
                Useful if you want cache to stay disposable.
              </p>
            </div>
            <input
              type="checkbox"
              checked={policy.clearCacheOnExit}
              onChange={(event) =>
                void updatePolicy({
                  ...policy,
                  clearCacheOnExit: event.target.checked
                })
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-bg-secondary/30 px-4 py-3">
            <div>
              <p className="text-sm text-text-primary">Warn when storage exceeds this limit</p>
              <p className="text-xs text-text-muted">
                This is a warning threshold, not a hard cap.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policy.maxStorageMB != null}
                onChange={(event) =>
                  void updatePolicy({
                    ...policy,
                    maxStorageMB: event.target.checked ? (policy.maxStorageMB ?? 1024) : null
                  })
                }
              />
              <Input
                type="number"
                min="1"
                value={
                  policy.maxStorageMB != null
                    ? Math.max(1, Math.round(policy.maxStorageMB / 1024))
                    : 1
                }
                disabled={policy.maxStorageMB == null}
                onChange={(event) =>
                  void updatePolicy({
                    ...policy,
                    maxStorageMB: (Number(event.target.value) || 1) * 1024
                  })
                }
                className="h-10 w-24 rounded-xl border border-border-subtle bg-bg-input text-xs"
              />
              <span className="text-xs text-text-muted">GB</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-muted">
              Applying now will remove un-starred generations that match the current policy.
            </p>
            <Button
              size="sm"
              disabled={busyAction === 'policy'}
              onClick={async () => {
                if (!window.manthan) return
                const confirmed = window.confirm(
                  `Apply the current retention policy now?\n\n` +
                    `Delete un-starred after: ${policy.deleteUnstarredAfterDays ?? 'Disabled'} days\n` +
                    `Clear cache on exit: ${policy.clearCacheOnExit ? 'On' : 'Off'}\n` +
                    `Warning threshold: ${policy.maxStorageMB != null ? `${Math.round(policy.maxStorageMB / 1024)} GB` : 'Disabled'}`
                )
                if (!confirmed) return
                setBusyAction('policy')
                const result = await window.manthan.applyRetentionPolicy(policy)
                setStatusMessage(
                  `Policy removed ${result.deletedGenerations} generation(s), deleted ${result.deletedAssets} asset(s), and freed ${formatBytes(result.freedBytes)}.`
                )
                await loadStorageState()
                setBusyAction(null)
              }}
            >
              {busyAction === 'policy' ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Apply Policy Now
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-border-subtle bg-bg-elevated/30 p-5">
        <div className="mb-4 text-sm font-semibold text-text-primary">Per-Type Breakdown</div>
        <div className="overflow-hidden rounded-2xl border border-border-subtle">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary/60 text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Largest File</th>
              </tr>
            </thead>
            <tbody>
              {report.byType.map((row) => (
                <tr
                  key={row.type}
                  className="border-t border-border-subtle text-xs text-text-secondary"
                >
                  <td className="px-4 py-3 capitalize">{row.type}</td>
                  <td className="px-4 py-3">{row.count}</td>
                  <td className="px-4 py-3">{formatBytes(row.size)}</td>
                  <td className="px-4 py-3">
                    {row.largestFile
                      ? `${row.largestFile.name} (${formatBytes(row.largestFile.size)})`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
