import { type JSX, useCallback, useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { cn } from '../../lib/utils'
import { VideoPlayerControls } from './VideoPlayerControls'
import { extractFirstFrame } from '../../lib/video-utils'
import { useAppStore } from '../../stores/app-store'
import { useProjectStore } from '../../stores/project-store'

export interface VideoPlayerProps {
  src: string
  mimeType?: string
  poster?: string
  autoPlay?: boolean
  onScreenshot?: (base64: string) => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
  className?: string
  compact?: boolean
}

export function VideoPlayer({
  src,
  mimeType: _mimeType,
  poster,
  autoPlay = false,
  onScreenshot,
  onTimeUpdate,
  className,
  compact = false
}: VideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(compact)
  const [loop, setLoop] = useState(compact)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [derivedPoster, setDerivedPoster] = useState<string | undefined>(poster)
  const [previewTime, setPreviewTime] = useState<number | null>(null)
  const [previewPosition, setPreviewPosition] = useState(0)
  const controlsTimer = useRef<number | null>(null)
  const { addToast } = useAppStore()
  const { activeProjectId } = useProjectStore()

  const resolvedPoster = derivedPoster ?? poster

  useEffect(() => {
    setDerivedPoster(poster)
  }, [poster, src])

  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) {
      window.clearTimeout(controlsTimer.current)
    }
    setShowControls(true)

    if (!compact && isPlaying) {
      controlsTimer.current = window.setTimeout(() => setShowControls(false), 3000)
    }
  }, [compact, isPlaying])

  useEffect(() => {
    if (poster || !src) return
    let cancelled = false
    void extractFirstFrame(src)
      .then((frame) => {
        if (!cancelled) setDerivedPoster(frame)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [poster, src])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = muted
    video.volume = volume
    video.loop = loop
    video.playbackRate = playbackRate
  }, [loop, muted, playbackRate, volume])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    if (!autoPlay || compact) return
    void videoRef.current?.play().catch(() => undefined)
  }, [autoPlay, compact, src])

  useEffect(
    () => () => {
      if (controlsTimer.current) {
        window.clearTimeout(controlsTimer.current)
      }
    },
    []
  )

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video.play().catch(() => undefined)
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
    resetControlsTimer()
  }, [resetControlsTimer])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)
    setDuration(video.duration || 0)
    onTimeUpdate?.(video.currentTime, video.duration || 0)
  }, [onTimeUpdate])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setDuration(video.duration || 0)
  }, [])

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    setCurrentTime(time)
  }, [])

  const handleVolumeChange = useCallback((nextVolume: number) => {
    const video = videoRef.current
    if (!video) return
    setVolume(nextVolume)
    setMuted(nextVolume === 0)
    video.volume = nextVolume
    video.muted = nextVolume === 0
  }, [])

  const handleMuteToggle = useCallback(() => {
    const nextMuted = !muted
    setMuted(nextMuted)
    if (!nextMuted && volume === 0) {
      setVolume(0.6)
    }
  }, [muted, volume])

  const handlePlaybackRateChange = useCallback((nextRate: number) => {
    setPlaybackRate(nextRate)
  }, [])

  const handleScreenshot = useCallback(async () => {
    const video = videoRef.current
    if (!video || !window.manthan) return

    video.pause()
    setIsPlaying(false)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    const [, base64Data = ''] = dataUrl.split(',')

    await window.manthan.saveAsset({
      projectId: activeProjectId ?? undefined,
      base64Data,
      mimeType: 'image/png',
      source: 'generated',
      filename: `screenshot-${Date.now()}.png`
    })

    onScreenshot?.(base64Data)
    addToast({
      title: 'Screenshot saved to assets',
      tone: 'success'
    })
  }, [activeProjectId, addToast, onScreenshot])

  const handlePipToggle = useCallback(async () => {
    const video = videoRef.current
    if (!video || !document.pictureInPictureEnabled) return

    if (document.pictureInPictureElement === video) {
      await document.exitPictureInPicture()
      return
    }

    await video.requestPictureInPicture()
  }, [])

  const handleFullscreenToggle = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    if (document.fullscreenElement === container) {
      await document.exitFullscreen()
    } else {
      await container.requestFullscreen()
    }
  }, [])

  const handleLoopToggle = useCallback(() => {
    setLoop((value) => !value)
  }, [])

  const handlePreviewChange = useCallback(
    (event: React.MouseEvent<HTMLInputElement>) => {
      const input = event.currentTarget
      const rect = input.getBoundingClientRect()
      const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0
      const clamped = Math.max(0, Math.min(1, ratio))
      setPreviewPosition(clamped * 100)
      setPreviewTime(clamped * duration)
    },
    [duration]
  )

  const handleCompactMouseMove = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    if (!event.currentTarget.matches(':hover')) return

    const video = videoRef.current
    if (!video || !video.duration) return

    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const targetTime = ratio * video.duration

    if (Math.abs(video.currentTime - targetTime) > 0.1) {
      video.currentTime = targetTime
      setCurrentTime(targetTime)
    }
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const video = videoRef.current
      if (!video) return

      if (event.key === ' ') {
        event.preventDefault()
        handlePlayPause()
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleSeek(Math.max(0, video.currentTime - 5))
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleSeek(Math.min(video.duration || 0, video.currentTime + 5))
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        void handleFullscreenToggle()
      }
      if (event.key.toLowerCase() === 'm') {
        event.preventDefault()
        handleMuteToggle()
      }
    },
    [handleFullscreenToggle, handleMuteToggle, handlePlayPause, handleSeek]
  )

  if (compact) {
    return (
      <div
        ref={containerRef}
        className={cn('relative h-full w-full overflow-hidden bg-black', className)}
      >
        <video
          key={src}
          ref={videoRef}
          src={src}
          poster={resolvedPoster}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onMouseEnter={(event) => {
            void event.currentTarget.play().catch(() => undefined)
            setIsPlaying(true)
          }}
          onMouseMove={handleCompactMouseMove}
          onMouseLeave={(event) => {
            event.currentTarget.pause()
            event.currentTarget.currentTime = 0
            setCurrentTime(0)
            setIsPlaying(false)
          }}
          onClick={(event) => {
            event.preventDefault()
          }}
        />
        {!isPlaying ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity">
            <div className="rounded-full bg-white/15 p-3 backdrop-blur-sm">
              <Play className="ml-0.5 h-5 w-5 text-white" />
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => setShowControls(false)}
      onDoubleClick={() => void handleFullscreenToggle()}
      className={cn(
        'group relative overflow-hidden rounded-[1.5rem] bg-black outline-none focus-visible:ring-1 focus-visible:ring-accent',
        className
      )}
    >
      <video
        key={src}
        ref={videoRef}
        src={src}
        poster={resolvedPoster}
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => {
          setIsPlaying(true)
          resetControlsTimer()
        }}
        onPause={() => setIsPlaying(false)}
      />

      <button
        type="button"
        onClick={handlePlayPause}
        className={cn(
          'absolute inset-0 z-10 flex items-center justify-center bg-black/10 transition-opacity',
          isPlaying ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
        )}
      >
        <div className="rounded-full bg-white/15 p-4 backdrop-blur-md">
          <Play className="ml-1 h-8 w-8 text-white" />
        </div>
      </button>

      <VideoPlayerControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        muted={muted}
        loop={loop}
        playbackRate={playbackRate}
        isFullscreen={isFullscreen}
        showControls={showControls}
        previewTime={previewTime}
        previewPosition={previewPosition}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onPreviewChange={handlePreviewChange}
        onPreviewLeave={() => setPreviewTime(null)}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
        onPlaybackRateChange={handlePlaybackRateChange}
        onScreenshot={() => void handleScreenshot()}
        onPipToggle={() => void handlePipToggle()}
        onFullscreenToggle={() => void handleFullscreenToggle()}
        onLoopToggle={handleLoopToggle}
      />
    </div>
  )
}
