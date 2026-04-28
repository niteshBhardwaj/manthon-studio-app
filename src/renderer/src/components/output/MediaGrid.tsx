// ============================================================
// Manthan Studio — Media Grid & Cards
// Output display for generated media
// ============================================================

import { motion } from 'framer-motion'
import { Play, Download, Copy, ArrowRight, MoreHorizontal, Video, Image as ImageIcon } from 'lucide-react'
import { useGenerationStore, GenerationJob } from '../../stores/generation-store'
import { cn } from '../../lib/utils'

function VideoCard({ job }: { job: GenerationJob }) {
  const isGenerating = job.status === 'generating'
  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-xl overflow-hidden bg-bg-elevated border border-border-subtle
                 hover:border-border transition-all duration-[var(--transition-base)]"
    >
      {/* Preview */}
      <div className="aspect-video bg-bg-primary relative overflow-hidden">
        {isGenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="text-xs text-text-muted">Generating...</span>
            <div className="w-32 h-1 rounded-full bg-bg-elevated overflow-hidden">
              <motion.div
                className="h-full bg-accent rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        )}

        {isCompleted && job.result && (
          <>
            {job.type === 'video' ? (
              <video
                src={job.result.uri || `data:${job.result.mimeType};base64,${job.result.data}`}
                className="w-full h-full object-cover"
                muted
                loop
                onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
              />
            ) : (
              <img
                src={`data:${job.result.mimeType};base64,${job.result.data}`}
                alt={job.prompt}
                className="w-full h-full object-cover"
              />
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <Play className="w-5 h-5 text-white ml-0.5" />
              </div>
            </div>
          </>
        )}

        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center">
              <span className="text-error text-lg">!</span>
            </div>
            <span className="text-xs text-error">{job.error || 'Generation failed'}</span>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur text-[10px] text-white/80">
            {job.type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
            {job.type}
          </div>
        </div>

        {/* Duration badge */}
        {job.type === 'video' && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur text-[10px] text-white/80">
            {job.config.duration || 8}s
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{job.prompt}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-text-muted">{job.config.aspectRatio} · {job.config.resolution}</span>
          {/* Actions */}
          {isCompleted && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all">
                <Download className="w-3.5 h-3.5" />
              </button>
              <button className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all">
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function MediaGrid() {
  const { jobs } = useGenerationStore()

  if (jobs.length === 0) return null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-6">
      {jobs.map((job) => (
        <VideoCard key={job.id} job={job} />
      ))}
    </div>
  )
}
