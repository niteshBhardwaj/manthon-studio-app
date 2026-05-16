import { type JSX, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Filter, FolderPlus, Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import type {
  DashboardSort,
  DashboardSourceFilter,
  DashboardStatusFilter,
  DashboardTypeFilter
} from '../../hooks/useDashboardFeed'

const sourceOptions: Array<{ key: DashboardSourceFilter; label: string }> = [
  { key: 'all', label: 'All media' },
  { key: 'generated', label: 'Generated' },
  { key: 'assets', label: 'Imported' }
]

const typeOptions: Array<{ key: DashboardTypeFilter; label: string }> = [
  { key: 'all', label: 'Any type' },
  { key: 'video', label: 'Video' },
  { key: 'image', label: 'Image' },
  { key: 'audio', label: 'Audio' }
]

const statusOptions: Array<{ key: DashboardStatusFilter; label: string }> = [
  { key: 'all', label: 'Any status' },
  { key: 'active', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' }
]

function buildActiveFilterLabels({
  sourceFilter,
  typeFilter,
  statusFilter,
  starredOnly
}: {
  sourceFilter: DashboardSourceFilter
  typeFilter: DashboardTypeFilter
  statusFilter: DashboardStatusFilter
  starredOnly: boolean
}): string[] {
  const labels: string[] = []
  if (sourceFilter !== 'all') {
    labels.push(sourceOptions.find((option) => option.key === sourceFilter)?.label ?? sourceFilter)
  }
  if (typeFilter !== 'all') {
    labels.push(typeOptions.find((option) => option.key === typeFilter)?.label ?? typeFilter)
  }
  if (statusFilter !== 'all') {
    labels.push(statusOptions.find((option) => option.key === statusFilter)?.label ?? statusFilter)
  }
  if (starredOnly) labels.push('Starred')
  return labels
}

export function DashboardFilterBar({
  sourceFilter,
  typeFilter,
  statusFilter,
  starredOnly,
  sortBy,
  searchQuery,
  onSourceFilterChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onStarredOnlyChange,
  onSortChange,
  onSearchChange,
  onImport
}: {
  sourceFilter: DashboardSourceFilter
  typeFilter: DashboardTypeFilter
  statusFilter: DashboardStatusFilter
  starredOnly: boolean
  sortBy: DashboardSort
  searchQuery: string
  onSourceFilterChange: (filter: DashboardSourceFilter) => void
  onTypeFilterChange: (filter: DashboardTypeFilter) => void
  onStatusFilterChange: (filter: DashboardStatusFilter) => void
  onStarredOnlyChange: (value: boolean) => void
  onSortChange: (sort: DashboardSort) => void
  onSearchChange: (query: string) => void
  onImport: () => void
}): JSX.Element {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const activeFilters = useMemo(
    () => buildActiveFilterLabels({ sourceFilter, typeFilter, statusFilter, starredOnly }),
    [sourceFilter, starredOnly, statusFilter, typeFilter]
  )

  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const timeout = window.setTimeout(() => onSearchChange(localQuery), 200)
    return () => window.clearTimeout(timeout)
  }, [localQuery, onSearchChange])

  useEffect(() => {
    if (!filtersOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [filtersOpen])

  const clearFilters = (): void => {
    onSourceFilterChange('all')
    onTypeFilterChange('all')
    onStatusFilterChange('all')
    onStarredOnlyChange(false)
  }


  return (
    <div className="space-y-2 rounded-lg border border-white/5 bg-white/[0.02] p-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border-subtle bg-bg-secondary px-3 py-2.5">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            value={localQuery}
            onChange={(event) => setLocalQuery(event.target.value)}
            placeholder="Search prompts or filenames"
            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors',
                activeFilters.length > 0
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-border-subtle bg-bg-secondary text-text-secondary hover:text-text-primary'
              )}
            >
              <Filter className="h-4 w-4" />
              Filter
              {activeFilters.length > 0 ? (
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px]">{activeFilters.length}</span>
              ) : null}
            </button>

            {filtersOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[19rem] rounded-2xl border border-border-subtle bg-bg-elevated p-4 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">Filters</p>
                    <p className="text-xs text-text-muted">Hide the extra controls until you need them.</p>
                  </div>
                  {activeFilters.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-xs text-text-muted transition-colors hover:text-text-primary"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <FilterGroup
                    label="Source"
                    options={sourceOptions}
                    value={sourceFilter}
                    onChange={(value) => onSourceFilterChange(value as DashboardSourceFilter)}
                  />
                  <FilterGroup
                    label="Type"
                    options={typeOptions}
                    value={typeFilter}
                    onChange={(value) => onTypeFilterChange(value as DashboardTypeFilter)}
                  />
                  <FilterGroup
                    label="Status"
                    options={statusOptions}
                    value={statusFilter}
                    onChange={(value) => onStatusFilterChange(value as DashboardStatusFilter)}
                  />

                  <button
                    type="button"
                    onClick={() => onStarredOnlyChange(!starredOnly)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm transition-colors',
                      starredOnly
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-border-subtle bg-bg-secondary text-text-secondary hover:text-text-primary'
                    )}
                  >
                    <span>Starred only</span>
                    <span className="text-xs">{starredOnly ? 'On' : 'Off'}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-secondary px-3">
            <ArrowUpDown className="h-4 w-4 text-text-muted" />
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as DashboardSort)}
              className="h-10 bg-transparent pr-2 text-sm text-text-primary outline-none"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="largest">Largest First</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onImport}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border-subtle bg-bg-secondary px-4 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <FolderPlus className="h-4 w-4" />
            Import
          </button>
        </div>
      </div>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full bg-white/6 px-3 py-1 text-xs text-text-secondary"
            >
              {label}
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  )
}

function FilterGroup({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: Array<{ key: string; label: string }>
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs transition-colors',
              value === option.key
                ? 'bg-white text-black'
                : 'bg-bg-secondary text-text-muted hover:text-text-secondary'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
