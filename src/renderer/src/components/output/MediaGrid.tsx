// ============================================================
// Manthan Studio — Media Grid & Cards
// Output display for generated media (video, image, audio)
import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { Play, Download, Copy, Video, Image as ImageIcon, Music, Trash2 } from 'lucide-react'
import { useGenerationStore, GenerationJob } from '../../stores/generation-store'
import { cn } from '../../lib/utils'

function MediaCard({ job }: { job: GenerationJob }) {
  const { removeJob } = useGenerationStore()
  const isGenerating = job.status === 'generating'
  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'

  const handleDownload = useCallback(async () => {
    if (!job.result) return
    if (window.manthan) {
      const ext = job.result.mimeType.split('/')[1] || 'bin'
      const filename = `manthan-${job.type}-${Date.now()}.${ext}`
      await window.manthan.saveMedia(job.result.data, filename, job.result.mimeType)
    }
  }, [job])

  const typeIcon = job.type === 'video' ? <Video className="w-3 h-3" />
    : job.type === 'audio' ? <Music className="w-3 h-3" />
    : <ImageIcon className="w-3 h-3" />

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-xl overflow-hidden bg-bg-elevated border border-border-subtle
                 hover:border-border transition-all"
    >
      {/* Preview area */}
      <div className={cn('relative overflow-hidden', job.type === 'audio' ? 'h-28' : 'aspect-video')} style={{ background: 'var(--color-bg-primary)' }}>
        {isGenerating && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="text-xs text-text-muted">Generating...</span>
            <div style={{ width: '8rem', height: '4px', borderRadius: '9999px', overflow: 'hidden', background: 'var(--color-bg-elevated)' }}>
              <motion.div
                className="bg-accent"
                style={{ height: '100%', borderRadius: '9999px' }}
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
                className="w-full h-full"
                style={{ objectFit: 'cover' }}
                muted
                loop
                onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
              />
            ) : job.type === 'audio' ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Music className="w-5 h-5 text-emerald-400" />
                </div>
                <audio
                  controls
                  src={`data:${job.result.mimeType};base64,${job.result.data}`}
                  style={{ width: '80%', height: '28px' }}
                />
              </div>
            ) : (
              <img
                src={`data:${job.result.mimeType};base64,${job.result.data}`}
                alt={job.prompt}
                className="w-full h-full"
                style={{ objectFit: 'cover' }}
              />
            )}
            {/* Hover overlay (video/image only) */}
            {job.type !== 'audio' && (
              <div
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div className="rounded-full backdrop-blur" style={{ width: '3rem', height: '3rem', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play className="w-5 h-5 text-white" style={{ marginLeft: '2px' }} />
                </div>
              </div>
            )}
          </>
        )}

        {isFailed && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center">
              <span className="text-error text-lg">!</span>
            </div>
            <span className="text-xs text-error">{job.error || 'Generation failed'}</span>
          </div>
        )}

        {/* Type badge */}
        <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem' }}>
          <div className="backdrop-blur text-white/80" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.5rem', borderRadius: '0.375rem', background: 'rgba(0,0,0,0.4)', fontSize: '10px' }}>
            {typeIcon}
            {job.type}
          </div>
        </div>

        {/* Duration badge (video only) */}
        {job.type === 'video' && (
          <div className="backdrop-blur text-white/80" style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: 'rgba(0,0,0,0.5)', fontSize: '10px' }}>
            {job.config.duration || 8}s
          </div>
        )}
      </div>

      {/* Info bar */}
      <div style={{ padding: '0.75rem' }}>
        <p className="text-xs text-text-secondary" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.6 }}>
          {job.prompt}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span className="text-text-muted" style={{ fontSize: '10px' }}>{job.config.aspectRatio} · {job.config.resolution}</span>
          {/* Actions */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {isCompleted && (
              <>
                <button
                  onClick={handleDownload}
                  className="text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all"
                  style={{ width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  className="text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all"
                  style={{ width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={() => removeJob(job.id)}
              className="text-text-muted hover:text-error hover:bg-error/5 transition-all"
              style={{ width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function MediaGrid() {
  const { jobs } = useGenerationStore()

  if (jobs.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', padding: '1.5rem' }}>
      {jobs.map((job) => (
        <MediaCard key={job.id} job={job} />
      ))}
    </div>
  )
}
