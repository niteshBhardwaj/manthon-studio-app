import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface AudioPlayerProps {
  id?: string
  src: string
  mimeType?: string
  autoPlay?: boolean
  className?: string
  compact?: boolean
  isHovered?: boolean
}

export function AudioPlayer({
  id,
  src,
  autoPlay = false,
  className,
  compact = false,
  isHovered: externalHovered
}: AudioPlayerProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [internalHovered, setInternalHovered] = useState(false)

  const isHovered = externalHovered ?? internalHovered

  const bars = useMemo(() => {
    const seed = (id || src).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
    return Array.from({ length: 22 }, (_, index) => {
      const value = Math.sin((index + seed) * 0.72) * 0.5 + Math.cos((index + seed) * 0.29) * 0.5
      return 22 + Math.round(Math.abs(value) * 52)
    })
  }, [id, src])

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

  useEffect(() => {
    if (!compact || !isHovered || !src || !audioRef.current) return
    void audioRef.current.play().catch(() => undefined)
    setIsPlaying(true)
  }, [compact, isHovered, src])

  useEffect(() => {
    if (!compact || isHovered || !audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsPlaying(false)
  }, [compact, isHovered])

  if (compact) {
    return (
      <div 
        className={cn(
          "group relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_28%_18%,rgba(99,179,237,0.4),transparent_28%),linear-gradient(135deg,#182235_0%,#263b52_48%,#25403f_100%)] px-5 text-white", 
          className
        )}
        onMouseEnter={() => setInternalHovered(true)}
        onMouseLeave={() => setInternalHovered(false)}
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
        
        <Music className={cn(
          "h-10 w-10 text-white/80 transition-all duration-500 drop-shadow",
          isPlaying ? "opacity-0 scale-150" : "scale-100 opacity-60"
        )} />

        {/* Time Remaining Indicator */}
        <div className="absolute right-2 bottom-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/90 backdrop-blur-md z-30">
          -{duration && isFinite(duration) ? formatTime(Math.max(0, duration - currentTime)) : '0:00'}
        </div>

        <div className="mt-5 flex h-12 w-full max-w-[12rem] items-end justify-center gap-1.5">
          {bars.map((height, index) => (
            <motion.span
              key={`${id || src}-${index}`}
              className={cn(
                "w-1.5 rounded-full",
                index % 3 === 0 ? "bg-accent" : index % 3 === 1 ? "bg-blue-400/80" : "bg-white/60"
              )}
              initial={{ height: `${height}%` }}
              animate={isPlaying ? {
                height: [`${height}%`, `${Math.min(100, height + 30)}%`, `${Math.max(20, height - 20)}%`, `${height}%`],
              } : { height: `${height}%` }}
              transition={isPlaying ? {
                duration: 0.6 + (index % 4) * 0.1,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.02
              } : { duration: 0.3 }}
            />
          ))}
        </div>

        {/* Progress Bar (Interactive) */}
        <div className="absolute inset-x-0 bottom-0 z-30 h-[3px] w-full bg-black/20 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:h-[6px]">
          <div className="group/progress relative h-full w-full bg-white/10">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={currentTime}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onChange={(event) => {
                event.stopPropagation()
                const time = Number(event.target.value)
                if (audioRef.current) {
                  audioRef.current.currentTime = time
                  setCurrentTime(time)
                }
              }}
              className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
            />
            <div
              className="absolute left-0 top-0 h-full bg-accent"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>
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
