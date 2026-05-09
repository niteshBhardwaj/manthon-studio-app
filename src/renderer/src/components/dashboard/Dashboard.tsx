import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '../../stores/project-store'
import { useDashboardFeed, type DashboardFeedItem } from '../../hooks/useDashboardFeed'
import { StatsStrip } from './StatsStrip'
import { DashboardFilterBar } from './DashboardFilterBar'
import { MediaTimeline } from './MediaTimeline'
import { WelcomeState } from './WelcomeState'
import { useGenerationStore } from '../../stores/generation-store'
import { useQueueStore } from '../../stores/queue-store'
import { dashboardItemToGenerationJob } from './DashboardCard'
import { useAppStore } from '../../stores/app-store'
import { generateVideoThumbnailsForAssets } from '../../lib/thumbnail-utils'

const RECENT_COMPLETION_MS = 2000

function buildActiveQueueItems(
  projectId: string,
  queueJobs: ReturnType<typeof useQueueStore.getState>['jobs'],
  now: number
): DashboardFeedItem[] {
  return queueJobs
    .filter((job) => {
      if (job.project_id !== projectId) return false
      if (job.status === 'pending' || job.status === 'running') return true
      if ((job.status === 'completed' || job.status === 'failed') && job.completed_at) {
        return now - job.completed_at < RECENT_COMPLETION_MS
      }
      return false
    })
    .map((job) => ({
      id: job.id,
      kind: 'generation' as const,
      type: job.type,
      source: 'generated' as const,
      title: job.prompt,
      previewSrc: null,
      thumbnailSrc: null,
      metadata: {
        model: job.model,
        provider: job.provider,
        config: job.config as unknown as Record<string, unknown>
      },
      status:
        job.status === 'pending'
          ? 'queued'
          : job.status === 'failed'
            ? 'failed'
            : job.status === 'completed'
              ? 'completed'
              : 'generating',
      progress: job.progress ?? 0,
      starred: false,
      createdAt: job.created_at
    }))
}

export function Dashboard(): JSX.Element {
  const { activeProjectId, loadProjects } = useProjectStore()
  const {
    visibleItems,
    visiblePinnedItems,
    items,
    pinnedItems,
    loading,
    hasMore,
    totalCount,
    filteredCount,
    stats,
    latestGeneration,
    sourceFilter,
    typeFilter,
    statusFilter,
    starredOnly,
    searchQuery,
    sortBy,
    setSourceFilter,
    setTypeFilter,
    setStatusFilter,
    setStarredOnly,
    setSearchQuery,
    setSortBy,
    loadMore,
    refresh,
    toggleStar,
    deleteItem
  } = useDashboardFeed(activeProjectId)
  const { loadJobIntoPrompt } = useGenerationStore()
  const queueJobs = useQueueStore((state) => state.jobs)
  const cancelQueueJob = useQueueStore((state) => state.cancelJob)
  const { addToast } = useAppStore()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const prevCompletedQueueIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const hasRecentCompletion = queueJobs.some(
      (job) =>
        job.project_id === activeProjectId &&
        (job.status === 'completed' || job.status === 'failed') &&
        job.completed_at &&
        Date.now() - job.completed_at < RECENT_COMPLETION_MS
    )
    if (!hasRecentCompletion) return

    const timer = window.setInterval(() => setNow(Date.now()), 400)
    return () => window.clearInterval(timer)
  }, [activeProjectId, queueJobs])

  const persistedIds = useMemo(() => new Set([...items, ...pinnedItems].map((item) => item.id)), [items, pinnedItems])

  const activeItems = useMemo(
    () =>
      buildActiveQueueItems(activeProjectId, queueJobs, now).filter((item) => !persistedIds.has(item.id)),
    [activeProjectId, now, persistedIds, queueJobs]
  )
  const allSelectableItems = useMemo(
    () => [...activeItems, ...visiblePinnedItems, ...visibleItems],
    [activeItems, visibleItems, visiblePinnedItems]
  )

  const completedQueueIds = useMemo(
    () =>
      new Set(
        queueJobs
          .filter(
            (job) =>
              job.project_id === activeProjectId && (job.status === 'completed' || job.status === 'failed')
          )
          .map((job) => job.id)
      ),
    [activeProjectId, queueJobs]
  )

  useEffect(() => {
    const newCompletions = [...completedQueueIds].filter((id) => !prevCompletedQueueIdsRef.current.has(id))
    prevCompletedQueueIdsRef.current = completedQueueIds

    if (newCompletions.length === 0) return

    const timer = window.setTimeout(() => {
      void refresh()
    }, 500)
    return () => window.clearTimeout(timer)
  }, [completedQueueIds, refresh])

  useEffect(() => {
    const handleDashboardRefresh = (): void => {
      void refresh()
    }

    window.addEventListener('manthan:dashboard-refresh', handleDashboardRefresh)
    return () => window.removeEventListener('manthan:dashboard-refresh', handleDashboardRefresh)
  }, [refresh])

  useEffect(() => {
    if (allSelectableItems.length === 0) {
      setSelectedItemId(null)
      return
    }

    if (!selectedItemId || !allSelectableItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(allSelectableItems[0]?.id ?? null)
    }
  }, [allSelectableItems, selectedItemId])

  const handleImport = useCallback(async () => {
    if (!window.manthan) return
    const imported = await window.manthan.importAssets(activeProjectId)
    await generateVideoThumbnailsForAssets(imported)
    await Promise.all([refresh(), loadProjects()])
  }, [activeProjectId, loadProjects, refresh])

  const handleDropImport = useCallback(
    async (paths: string[]) => {
      if (!window.manthan || paths.length === 0) return
      const imported = await window.manthan.importAssetPaths(activeProjectId, paths)
      await generateVideoThumbnailsForAssets(imported)
      addToast({
        title: 'Media imported',
        message: `${paths.length} file${paths.length === 1 ? '' : 's'} added to the project`,
        tone: 'success'
      })
      await Promise.all([refresh(), loadProjects()])
    },
    [activeProjectId, addToast, loadProjects, refresh]
  )

  const handleDownload = useCallback(async (item: DashboardFeedItem) => {
    if (!window.manthan) return

    const assetId = item.asset?.id ?? item.metadata.resultAssetId ?? null
    if (assetId) {
      await window.manthan.exportAssets([assetId])
    }
  }, [])

  const handleRerun = useCallback(
    (item: DashboardFeedItem) => {
      const generationJob = dashboardItemToGenerationJob(item)
      if (!generationJob) return
      loadJobIntoPrompt(generationJob)
      window.setTimeout(() => {
        document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
      }, 120)
    },
    [loadJobIntoPrompt]
  )

  const handleDelete = useCallback(
    async (item: DashboardFeedItem) => {
      if (activeItems.some((activeItem) => activeItem.id === item.id)) {
        await cancelQueueJob(item.id)
        return
      }

      await deleteItem(item.id)
      await loadProjects()
    },
    [activeItems, cancelQueueJob, deleteItem, loadProjects]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (allSelectableItems.length === 0) return

      const currentIndex = allSelectableItems.findIndex((item) => item.id === selectedItemId)
      const normalizedIndex = currentIndex >= 0 ? currentIndex : 0

      if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const next = allSelectableItems[Math.min(allSelectableItems.length - 1, normalizedIndex + 1)]
        setSelectedItemId(next?.id ?? null)
      }

      if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        const next = allSelectableItems[Math.max(0, normalizedIndex - 1)]
        setSelectedItemId(next?.id ?? null)
      }

      const selectedItem = allSelectableItems[normalizedIndex]
      if (!selectedItem) return

      if (event.key === 'Enter' && selectedItem.status === 'completed') {
        event.preventDefault()
        setOpenItemId(selectedItem.id)
      }

      if (event.key.toLowerCase() === 's' && selectedItem.kind === 'generation') {
        event.preventDefault()
        void toggleStar(selectedItem.id)
      }

      if (event.key.toLowerCase() === 'd') {
        event.preventDefault()
        void handleDownload(selectedItem)
      }

      if (event.key === 'Delete') {
        event.preventDefault()
        void handleDelete(selectedItem)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [allSelectableItems, handleDelete, handleDownload, selectedItemId, toggleStar])

  const hasAnyContent = activeItems.length > 0 || pinnedItems.length > 0 || items.length > 0
  const projectHasContent = totalCount > 0 || activeItems.length > 0

  return (
    <div
      className="relative mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-6 pb-36 pt-4"
      onDragEnter={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        if (event.currentTarget === event.target) {
          setDragActive(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragActive(false)
        const paths = Array.from(event.dataTransfer.files)
          .map((file) => (file as File & { path?: string }).path)
          .filter((path): path is string => Boolean(path))
        void handleDropImport(paths)
      }}
    >
      {dragActive ? (
        <div className="pointer-events-none absolute inset-0 z-30 rounded-2xl border-2 border-dashed border-accent bg-accent/8" />
      ) : null}

      {projectHasContent ? (
        <section className="space-y-2 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(14,20,31,0.96),rgba(10,15,24,0.9))] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <StatsStrip
            stats={stats}
            latestGeneratedAt={latestGeneration?.createdAt ?? null}
            filteredCount={filteredCount}
            totalCount={totalCount}
          />

          <DashboardFilterBar
            sourceFilter={sourceFilter}
            typeFilter={typeFilter}
            statusFilter={statusFilter}
            starredOnly={starredOnly}
            sortBy={sortBy}
            searchQuery={searchQuery}
            onSourceFilterChange={setSourceFilter}
            onTypeFilterChange={setTypeFilter}
            onStatusFilterChange={setStatusFilter}
            onStarredOnlyChange={setStarredOnly}
            onSortChange={setSortBy}
            onSearchChange={setSearchQuery}
            onImport={() => void handleImport()}
          />
        </section>
      ) : null}

      {loading ? (
        <div className="flex min-h-[18rem] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        </div>
      ) : !projectHasContent ? (
        <WelcomeState onImport={() => void handleImport()} />
      ) : !hasAnyContent ? (
        <div className="flex min-h-[18rem] flex-col items-center justify-center gap-2 text-white/50">
          <p>No media found matching your search or filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setSourceFilter('all')
              setTypeFilter('all')
              setStatusFilter('all')
              setStarredOnly(false)
            }}
            className="mt-2 text-sm text-accent hover:underline transition-colors"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {activeItems.length > 0 ? (
            <MediaTimeline
              title="Active Jobs"
              items={activeItems}
              selectedId={selectedItemId}
              openItemId={openItemId}
              onSelect={setSelectedItemId}
              onToggleStar={toggleStar}
              onDelete={(id) => {
                const item = activeItems.find((entry) => entry.id === id)
                if (item) void handleDelete(item)
              }}
              onRerun={handleRerun}
              onDownload={handleDownload}
              onOpen={setOpenItemId}
              onClose={() => setOpenItemId(null)}
            />
          ) : null}

          {visiblePinnedItems.length > 0 ? (
            <MediaTimeline
              title="Pinned"
              items={visiblePinnedItems}
              selectedId={selectedItemId}
              openItemId={openItemId}
              onSelect={setSelectedItemId}
              onToggleStar={(id) => void toggleStar(id)}
              onDelete={(id) => {
                const item = visiblePinnedItems.find((entry) => entry.id === id)
                if (item) void handleDelete(item)
              }}
              onRerun={handleRerun}
              onDownload={handleDownload}
              onOpen={setOpenItemId}
              onClose={() => setOpenItemId(null)}
            />
          ) : null}

          <MediaTimeline
            items={visibleItems}
            hasMore={hasMore}
            onLoadMore={loadMore}
            selectedId={selectedItemId}
            openItemId={openItemId}
            onSelect={setSelectedItemId}
            onToggleStar={(id) => void toggleStar(id)}
            onDelete={(id) => {
              const item = visibleItems.find((entry) => entry.id === id)
              if (item) void handleDelete(item)
            }}
            onRerun={handleRerun}
            onDownload={handleDownload}
            onOpen={setOpenItemId}
            onClose={() => setOpenItemId(null)}
          />
        </div>
      )}
    </div>
  )
}
