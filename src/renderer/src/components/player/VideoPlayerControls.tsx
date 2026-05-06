import { type JSX } from 'react'
import {
  Camera,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Volume2,
  VolumeX
} from 'lucide-react'
import { cn } from '../../lib/utils'

function formatTime(time: number): string {
  if (!Number.isFinite(time)) return '0:00'
  const total = Math.max(0, Math.floor(time))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface VideoPlayerControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  loop: boolean
  playbackRate: number
  isFullscreen: boolean
  showControls: boolean
  previewTime: number | null
  previewPosition: number
  onPlayPause: () => void
  onSeek: (time: number) => void
  onPreviewChange: (event: React.MouseEvent<HTMLInputElement>) => void
  onPreviewLeave: () => void
  onVolumeChange: (volume: number) => void
  onMuteToggle: () => void
  onPlaybackRateChange: (rate: number) => void
  onScreenshot: () => void
  onPipToggle: () => void
  onFullscreenToggle: () => void
  onLoopToggle: () => void
}

function IconButton({
  onClick,
  children,
  active = false,
  title
}: {
  onClick: () => void
  children: React.ReactNode
  active?: boolean
  title: string
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
        active ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
      )}
    >
      {children}
    </button>
  )
}

export function VideoPlayerControls(props: VideoPlayerControlsProps): JSX.Element {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    loop,
    playbackRate,
    isFullscreen,
    showControls,
    previewTime,
    previewPosition,
    onPlayPause,
    onSeek,
    onPreviewChange,
    onPreviewLeave,
    onVolumeChange,
    onMuteToggle,
    onPlaybackRateChange,
    onScreenshot,
    onPipToggle,
    onFullscreenToggle,
    onLoopToggle
  } = props

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300',
        showControls ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div className="pointer-events-auto space-y-3">
        <div className="relative">
          {previewTime !== null ? (
            <div
              className="absolute -top-8 -translate-x-1/2 rounded-md bg-black/85 px-2 py-1 text-[10px] text-white"
              style={{ left: `${previewPosition}%` }}
            >
              {formatTime(previewTime)}
            </div>
          ) : null}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => onSeek(Number(event.target.value))}
            onMouseMove={onPreviewChange}
            onMouseLeave={onPreviewLeave}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconButton onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </IconButton>

            <div className="flex items-center gap-2 rounded-full bg-black/25 px-2 py-1">
              <button type="button" onClick={onMuteToggle} className="text-white/80 hover:text-white">
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(event) => onVolumeChange(Number(event.target.value))}
                className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
              />
            </div>

            <div className="text-xs font-medium text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={String(playbackRate)}
              onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
              className="h-9 rounded-full border border-white/10 bg-black/25 px-3 text-xs text-white outline-none"
            >
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
            <IconButton onClick={onScreenshot} title="Save screenshot">
              <Camera className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={onPipToggle} title="Picture in Picture">
              <PictureInPicture2 className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={onLoopToggle} active={loop} title="Toggle loop">
              <Repeat className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={onFullscreenToggle} title="Toggle fullscreen">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  )
}
