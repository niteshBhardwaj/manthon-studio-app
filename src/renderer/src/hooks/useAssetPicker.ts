import { useState, useEffect, useCallback, useMemo } from 'react'
import type { AssetInfo } from '../../../preload/index.d'

export interface UseAssetPickerReturn {
  assets: AssetInfo[]
  loading: boolean
  selectedIds: Set<string>
  previewAsset: AssetInfo | null
  projectFilter: string
  typeFilter: string
  searchQuery: string
  sortBy: 'recent' | 'used' | 'oldest'

  setProjectFilter: (id: string) => void
  setTypeFilter: (type: string) => void
  setSearchQuery: (q: string) => void
  setSortBy: (sort: 'recent' | 'used' | 'oldest') => void
  toggleSelect: (id: string, multi?: boolean) => void
  setPreview: (asset: AssetInfo | null) => void
  loadAssets: () => Promise<void>
  getSelectedAssets: () => AssetInfo[]
  addAsset: (asset: AssetInfo) => void
}

export function useAssetPicker(): UseAssetPickerReturn {
  const [assets, setAssets] = useState<AssetInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewAsset, setPreviewAsset] = useState<AssetInfo | null>(null)
  
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<'recent' | 'used' | 'oldest'>('recent')

  const loadAssets = useCallback(async () => {
    if (!window.manthan) return
    setLoading(true)
    try {
      const options: any = {}
      if (projectFilter !== 'all') {
        options.projectId = projectFilter
      }
      if (typeFilter !== 'all') {
        options.type = typeFilter as any
      }
      
      const { assets: fetchedAssets } = await window.manthan.listAssets(options)
      setAssets(fetchedAssets)
    } catch (error) {
      console.error('Failed to load assets:', error)
    } finally {
      setLoading(false)
    }
  }, [projectFilter, typeFilter])

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  const toggleSelect = useCallback((id: string, multi: boolean = false) => {
    setSelectedIds((prev) => {
      const next = new Set(multi ? prev : [])
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const getSelectedAssets = useCallback(() => {
    return assets.filter(a => selectedIds.has(a.id))
  }, [assets, selectedIds])

  const addAsset = useCallback((asset: AssetInfo) => {
    setAssets(prev => [asset, ...prev])
  }, [])

  const filteredAndSortedAssets = useMemo(() => {
    let result = assets

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(a => a.filename.toLowerCase().includes(q))
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'recent') {
        return b.created_at - a.created_at
      }
      if (sortBy === 'oldest') {
        return a.created_at - b.created_at
      }
      if (sortBy === 'used') {
        // Since we don't have usage count right now, just fallback to recent
        return b.created_at - a.created_at
      }
      return 0
    })

    return result
  }, [assets, searchQuery, sortBy])

  return {
    assets: filteredAndSortedAssets,
    loading,
    selectedIds,
    previewAsset,
    projectFilter,
    typeFilter,
    searchQuery,
    sortBy,
    setProjectFilter,
    setTypeFilter,
    setSearchQuery,
    setSortBy,
    toggleSelect,
    setPreview: setPreviewAsset,
    loadAssets,
    getSelectedAssets,
    addAsset
  }
}
