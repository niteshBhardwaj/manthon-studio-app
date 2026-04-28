// ============================================================
// Manthan Studio — Assets Page
// Browse and manage locally saved media assets
// ============================================================

import { motion } from 'framer-motion'
import { FolderOpen, Upload, Video, Image as ImageIcon, Music, Grid, List } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'

export function AssetsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const handleImport = async () => {
    if (window.manthan) {
      const file = await window.manthan.openFile()
      if (file) {
        console.log('Imported file:', file.path)
      }
    }
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-text-primary mb-1">Assets</h2>
          <p className="text-xs text-text-muted">Manage your generated and imported media</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-bg-elevated rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-all',
                viewMode === 'grid' ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-all',
                viewMode === 'list' ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-all"
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
        </div>
      </div>

      {/* Empty state */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4">
          <FolderOpen className="w-7 h-7 text-text-muted/30" />
        </div>
        <p className="text-sm text-text-muted mb-1">No assets yet</p>
        <p className="text-xs text-text-muted/60 mb-4 max-w-xs leading-relaxed">
          Generated media will automatically appear here. You can also import your own images and videos.
        </p>
        <button
          onClick={handleImport}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-bg-elevated border border-border-subtle text-text-secondary hover:bg-bg-hover hover:border-border transition-all"
        >
          <Upload className="w-3.5 h-3.5" /> Import Media
        </button>

        {/* Supported formats */}
        <div className="flex items-center gap-3 mt-6">
          {[
            { icon: Video, label: 'MP4, WebM' },
            { icon: ImageIcon, label: 'PNG, JPG, WebP' },
            { icon: Music, label: 'MP3, WAV' }
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-text-muted/50">
              <Icon className="w-3 h-3" />
              {label}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
