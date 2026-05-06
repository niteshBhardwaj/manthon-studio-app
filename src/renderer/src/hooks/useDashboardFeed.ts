import { useCallback, useEffect, useMemo, useState } from 'react'

export type DashboardSourceFilter = 'all' | 'generated' | 'assets'
export type DashboardTypeFilter = 'all' | 'video' | 'image' | 'audio'
export type DashboardStatusFilter = 'all' | 'active' | 'completed' | 'failed'
export type DashboardSort = 'recent' | 'oldest' | 'largest' | 'name'

export interface DashboardFeedItem {
  id: string
  kind: 'generation' | 'asset'
  type: 'video' | 'image' | 'audio'
  source: 'generated' | 'imported' | 'uploaded'
  title: string
  previewSrc: string | null
  thumbnailSrc: string | null
  metadata: {
    model?: string
    provider?: string
    config?: Record<string, unknown>
    sizeBytes?: number
    duration?: number
    filename?: string
    resultAssetId?: string | null
  }
  status: 'completed' | 'generating' | 'queued' | 'failed'
  progress: number
  starred: boolean
  createdAt: number
  generation?: GenerationRecord
  asset?: AssetInfo
}

interface GenerationRecord {
  id: string
  project_id: string | null
  type: 'video' | 'image' | 'audio'
  status: string
  prompt: string
  negative_prompt: string
  provider: string
  model: string
  config: Record<string, unknown>
  result_asset_id: string | null
  error: string | null
  progress: number
  started_at: number
  completed_at: number | null
  starred: number
  cost_estimate: number
  created_at: number
}

interface AssetInfo {
  id: string
  project_id: string | null
  filename: string
  mime_type: string
  size_bytes: number
  type: 'video' | 'image' | 'audio'
  source: 'generated' | 'imported' | 'uploaded'
  storage_path: string
  thumbnail_path: string | null
  metadata: Record<string, unknown>
  tags: string[]
  created_at: number
  updated_at: number
}

interface UseDashboardFeedReturn {
  items: DashboardFeedItem[]
  visibleItems: DashboardFeedItem[]
  pinnedItems: DashboardFeedItem[]
  visiblePinnedItems: DashboardFeedItem[]
  loading: boolean
  hasMore: boolean
  totalCount: number
  filteredCount: number
  stats: { video: number; image: number; audio: number; totalSize: number }
  latestGeneration: DashboardFeedItem | null
  sourceFilter: DashboardSourceFilter
  typeFilter: DashboardTypeFilter
  statusFilter: DashboardStatusFilter
  starredOnly: boolean
  searchQuery: string
  sortBy: DashboardSort
  setSourceFilter: (filter: DashboardSourceFilter) => void
  setTypeFilter: (filter: DashboardTypeFilter) => void
  setStatusFilter: (filter: DashboardStatusFilter) => void
  setStarredOnly: (value: boolean) => void
  setSearchQuery: (query: string) => void
  setSortBy: (sort: DashboardSort) => void
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  toggleStar: (id: string) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

const PAGE_SIZE = 40

function buildAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `asset:///${path.replace(/\\/g, '/')}`
}

function sortItems(items: DashboardFeedItem[], sortBy: DashboardSort): DashboardFeedItem[] {
  const sorted = [...items]

  if (sortBy === 'oldest') {
    sorted.sort((a, b) => a.createdAt - b.createdAt)
    return sorted
  }

  if (sortBy === 'largest') {
    sorted.sort((a, b) => (b.metadata.sizeBytes ?? 0) - (a.metadata.sizeBytes ?? 0))
    return sorted
  }

  if (sortBy === 'name') {
    sorted.sort((a, b) => a.title.localeCompare(b.title))
    return sorted
  }

  sorted.sort((a, b) => b.createdAt - a.createdAt)
  return sorted
}

export function useDashboardFeed(projectId: string): UseDashboardFeedReturn {
  const [generationItems, setGenerationItems] = useState<DashboardFeedItem[]>([])
  const [assetItems, setAssetItems] = useState<DashboardFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<DashboardSourceFilter>('all')
  const [typeFilter, setTypeFilter] = useState<DashboardTypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>('all')
  const [starredOnly, setStarredOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<DashboardSort>('recent')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const refresh = useCallback(async () => {
    if (!window.manthan) return

    setLoading(true)
    try {
      const [generationResult, assetResult] = await Promise.all([
        window.manthan.listGenerations({ projectId, limit: 1000, offset: 0 }),
        window.manthan.listAssets({ projectId, limit: 1000, offset: 0 })
      ])

      const assetMap = new Map(assetResult.assets.map((asset) => [asset.id, asset]))

      setGenerationItems(
        generationResult.items.map((generation) => {
          const linkedAsset = generation.result_asset_id ? assetMap.get(generation.result_asset_id) ?? null : null

          const capabilityValues =
            'capabilityValues' in generation.config &&
            typeof generation.config.capabilityValues === 'object' &&
            generation.config.capabilityValues
              ? (generation.config.capabilityValues as Record<string, unknown>)
              : {}

          return {
            id: generation.id,
            kind: 'generation',
            type: generation.type,
            source: 'generated',
            title: generation.prompt,
            previewSrc: buildAssetUrl(linkedAsset?.storage_path),
            thumbnailSrc: buildAssetUrl(linkedAsset?.thumbnail_path) ?? buildAssetUrl(linkedAsset?.storage_path),
            metadata: {
              model: generation.model,
              provider: generation.provider,
              config: generation.config,
              sizeBytes: linkedAsset?.size_bytes,
              duration: typeof capabilityValues.duration === 'number' ? capabilityValues.duration : undefined,
              filename: linkedAsset?.filename,
              resultAssetId: generation.result_asset_id
            },
            status:
              generation.status === 'failed'
                ? 'failed'
                : generation.status === 'queued'
                  ? 'queued'
                  : generation.status === 'generating'
                    ? 'generating'
                    : 'completed',
            progress: generation.progress ?? 100,
            starred: Boolean(generation.starred),
            createdAt: generation.created_at || generation.completed_at || generation.started_at,
            generation
          }
        })
      )

      setAssetItems(
        assetResult.assets
          .filter((asset) => asset.source !== 'generated')
          .map((asset) => ({
            id: asset.id,
            kind: 'asset' as const,
            type: asset.type,
            source: asset.source,
            title: asset.filename,
            previewSrc: buildAssetUrl(asset.storage_path),
            thumbnailSrc: buildAssetUrl(asset.thumbnail_path) ?? buildAssetUrl(asset.storage_path),
            metadata: {
              sizeBytes: asset.size_bytes,
              filename: asset.filename
            },
            status: 'completed' as const,
            progress: 100,
            starred: false,
            createdAt: asset.created_at,
            asset
          }))
      )
      setVisibleCount(PAGE_SIZE)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const combinedItems = useMemo(() => [...generationItems, ...assetItems], [assetItems, generationItems])

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const sourceFiltered = combinedItems.filter((item) => {
      if (sourceFilter === 'generated') return item.kind === 'generation'
      if (sourceFilter === 'assets') return item.kind === 'asset'
      return true
    })

    const typeFiltered =
      typeFilter === 'all' ? sourceFiltered : sourceFiltered.filter((item) => item.type === typeFilter)

    const statusFiltered =
      statusFilter === 'all'
        ? typeFiltered
        : typeFiltered.filter((item) => {
            if (statusFilter === 'active') {
              return item.status === 'queued' || item.status === 'generating'
            }
            return item.status === statusFilter
          })

    const starredFiltered = starredOnly
      ? statusFiltered.filter((item) => item.kind === 'generation' && item.starred)
      : statusFiltered

    const searched = normalizedQuery
      ? starredFiltered.filter((item) => {
          const filename = item.metadata.filename?.toLowerCase() ?? ''
          return item.title.toLowerCase().includes(normalizedQuery) || filename.includes(normalizedQuery)
        })
      : starredFiltered

    return sortItems(searched, sortBy)
  }, [combinedItems, searchQuery, sortBy, sourceFilter, starredOnly, statusFilter, typeFilter])

  const pinnedItems = useMemo(() => filteredItems.filter((item) => item.kind === 'generation' && item.starred), [filteredItems])
  const nonPinnedItems = useMemo(
    () => filteredItems.filter((item) => !(item.kind === 'generation' && item.starred)),
    [filteredItems]
  )

  const visiblePinnedItems = useMemo(() => pinnedItems.slice(0, visibleCount), [pinnedItems, visibleCount])
  const visibleItems = useMemo(() => nonPinnedItems.slice(0, visibleCount), [nonPinnedItems, visibleCount])
  const hasMore = visibleCount < pinnedItems.length || visibleCount < nonPinnedItems.length

  const stats = useMemo(
    () =>
      combinedItems.reduce(
        (acc, item) => {
          acc[item.type] += 1
          acc.totalSize += item.metadata.sizeBytes ?? 0
          return acc
        },
        { video: 0, image: 0, audio: 0, totalSize: 0 }
      ),
    [combinedItems]
  )

  const latestGeneration = useMemo(() => {
    const [latest] = sortItems(
      generationItems.filter((item) => item.status === 'completed'),
      'recent'
    )
    return latest ?? null
  }, [generationItems])

  const loadMore = useCallback(async () => {
    setVisibleCount((count) => count + PAGE_SIZE)
  }, [])

  const toggleStar = useCallback(async (id: string) => {
    if (!window.manthan) return
    const updated = await window.manthan.starGeneration(id)
    if (!updated) return

    setGenerationItems((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              starred: Boolean(updated.starred),
              generation: updated
            }
          : item
      )
    )
  }, [])

  const deleteItem = useCallback(async (id: string) => {
    if (!window.manthan) return

    const generationMatch = generationItems.find((item) => item.id === id)
    if (generationMatch) {
      await window.manthan.deleteGeneration(id)
      setGenerationItems((items) => items.filter((item) => item.id !== id))
      return
    }

    await window.manthan.deleteAsset(id)
    setAssetItems((items) => items.filter((item) => item.id !== id))
  }, [generationItems])

  return {
    items: nonPinnedItems,
    visibleItems,
    pinnedItems,
    visiblePinnedItems,
    loading,
    hasMore,
    totalCount: combinedItems.length,
    filteredCount: filteredItems.length,
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
  }
}
