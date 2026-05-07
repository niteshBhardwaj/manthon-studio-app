import { type JSX, useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface AudioPlayerProps {
  src: string
  mimeType?: string
  autoPlay?: boolean
  className?: string
  compact?: boolean
}

export function AudioPlayer({
  src,
  mimeType,
  autoPlay = false,
  className,
  compact = false
}: AudioPlayerProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    if (autoPlay && src && audioRef.current) {
      void audioRef.current.play().catch(() => undefined)
    }
  }, [autoPlay, src])

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      void audio.play().catch(() => undefined)
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }, [])

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setMuted((prev) => !prev)
  }, [])

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (compact) {
    return (
      <div 
        className={cn("relative flex h-full w-full items-center justify-center bg-black/20 backdrop-blur-sm", className)}
        onMouseEnter={() => {
          if (audioRef.current) {
            void audioRef.current.play().catch(() => undefined)
            setIsPlaying(true)
          }
        }}
        onMouseLeave={() => {
          if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            setIsPlaying(false)
          }
        }}
      >
        <audio
          ref={audioRef}
          src={src}
          loop
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 transition-all duration-300",
          isPlaying ? "scale-110 bg-emerald-500/40" : "scale-100"
        )}>
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-1 h-6 w-6" />}
        </div>
        
        {/* Simple Progress Bar at bottom for compact view */}
        <div className="absolute bottom-0 left-0 h-1 w-full bg-white/10">
          <div 
            className="h-full bg-emerald-500 transition-all duration-100" 
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center gap-6 p-8", className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        muted={muted}
        onEnded={() => setIsPlaying(false)}
      />
      
      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
        <button 
          onClick={togglePlay}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-black transition-transform hover:scale-105 active:scale-95"
        >
          {isPlaying ? <Pause className="h-10 w-10 fill-current" /> : <Play className="ml-1 h-10 w-10 fill-current" />}
        </button>
      </div>

      <div className="flex w-full max-w-md flex-col gap-3">
        <div className="group relative h-1.5 w-full rounded-full bg-white/10">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.01"
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
          />
          <div 
            className="absolute left-0 top-0 h-full rounded-full bg-emerald-500"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
          <div 
            className="absolute h-3 w-3 -translate-y-1/4 rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-100"
            style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }}
          />
        </div>
        
        <div className="flex justify-between text-[11px] font-medium tabular-nums text-text-muted">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={toggleMute}
          className="text-text-muted transition-colors hover:text-text-primary"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            setVolume(v)
            if (audioRef.current) audioRef.current.volume = v
            if (v > 0) setMuted(false)
          }}
          className="h-1 w-24 accent-emerald-500"
        />
      </div>
    </div>
  )
}
