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
    <div className="p-6 overflow-y-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
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
                viewMode === 'grid'
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-all',
                viewMode === 'list'
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-muted hover:text-text-secondary'
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
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ textAlign: 'center', width: '100%', maxWidth: '32rem', padding: '0 2rem' }}
        >
          {/* Animated icon */}
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{
                y: [0, -4, 0],
                boxShadow: [
                  '0 0 0px oklch(0.7 0.18 250 / 0)',
                  '0 0 20px oklch(0.7 0.18 250 / 0.15)',
                  '0 0 0px oklch(0.7 0.18 250 / 0)'
                ]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-bg-elevated to-bg-secondary border border-border-subtle flex items-center justify-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-text-muted/5 blur-xl rounded-full" />
              <FolderOpen className="w-7 h-7 text-text-muted relative z-10" />
            </motion.div>
          </div>

          <h3 className="text-xl font-semibold text-text-primary tracking-tight mb-3">
            No assets yet
          </h3>
          <p className="text-sm text-text-muted/90 mx-auto leading-relaxed mb-10">
            Generated media will automatically appear here. You can also import your own images and
            videos.
          </p>

          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleImport}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-hover shadow-glow transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Import Media
          </motion.button>

          {/* Supported formats */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {[
              { icon: Video, label: 'MP4, WebM' },
              { icon: ImageIcon, label: 'PNG, JPG, WebP' },
              { icon: Music, label: 'MP3, WAV' }
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted/60 bg-bg-secondary px-2.5 py-1 rounded-md border border-border-subtle/50"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
