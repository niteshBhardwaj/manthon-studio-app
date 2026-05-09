import { type JSX, useCallback, useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react'
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
  const [loop, setLoop] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  const isHovered = externalHovered ?? internalHovered

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const barsRef = useRef<(HTMLSpanElement | null)[]>([])

  const bars = Array.from({ length: 22 })

  const initWebAudio = useCallback(() => {
    if (!audioRef.current) return
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        audioContextRef.current = new AudioContextClass()
      }

      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 64
      }

      if (!sourceRef.current) {
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current)
        sourceRef.current.connect(analyserRef.current)
        analyserRef.current.connect(audioContextRef.current.destination)
      }

      if (audioContextRef.current.state === 'suspended') {
        void audioContextRef.current.resume()
      }
    } catch (error) {
      console.warn('Web Audio API not supported or already initialized', error)
    }
  }, [])

  const updateBars = useCallback(() => {
    if (!analyserRef.current || !isPlaying) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    barsRef.current.forEach((bar, index) => {
      if (!bar) return
      const value = dataArray[index] || 0
      const heightPercent = 10 + (value / 255) * 90
      bar.style.height = `${heightPercent}%`
    })

    animationRef.current = requestAnimationFrame(updateBars)
  }, [isPlaying])

  useEffect(() => {
    if (isPlaying) {
      initWebAudio()
      animationRef.current = requestAnimationFrame(updateBars)
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.height = '10%'
      })
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, updateBars, initWebAudio])

  useEffect(() => {
    if (autoPlay && src && audioRef.current) {
      void audioRef.current.play().catch(() => undefined)
    }
  }, [autoPlay, src])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = loop
      audioRef.current.playbackRate = playbackRate
    }
  }, [loop, playbackRate])

  const togglePlay = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation()
      const audio = audioRef.current
      if (!audio) return

      initWebAudio()

      if (audio.paused) {
        void audio.play().catch(() => undefined)
        setIsPlaying(true)
      } else {
        audio.pause()
        setIsPlaying(false)
      }
    },
    [initWebAudio]
  )

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
          'group relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_28%_18%,rgba(99,179,237,0.4),transparent_28%),linear-gradient(135deg,#182235_0%,#263b52_48%,#25403f_100%)] px-5 text-white',
          className
        )}
        onMouseEnter={() => setInternalHovered(true)}
        onMouseLeave={() => setInternalHovered(false)}
      >
        <audio
          ref={audioRef}
          src={src}
          loop
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        <Music
          className={cn(
            'h-10 w-10 text-white/80 transition-all duration-500 drop-shadow',
            isPlaying ? 'opacity-0 scale-150' : 'scale-100 opacity-60'
          )}
        />

        {/* Time Remaining Indicator */}
        <div className="absolute right-2 bottom-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/90 backdrop-blur-md z-30">
          -
          {duration && isFinite(duration)
            ? formatTime(Math.max(0, duration - currentTime))
            : '0:00'}
        </div>

        <div className="mt-5 flex h-12 w-full max-w-48 items-end justify-center gap-1.5">
          {bars.map((_, index) => (
            <span
              key={`${id || src}-${index}`}
              ref={(el) => {
                barsRef.current[index] = el
              }}
              className={cn(
                'w-1.5 rounded-full transition-[height] duration-75',
                index % 3 === 0 ? 'bg-accent' : index % 3 === 1 ? 'bg-blue-400/80' : 'bg-white/60'
              )}
              style={{ height: '10%' }}
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
    <div
      className={cn(
        'relative flex flex-col items-center justify-between aspect-video w-full min-w-[320px] md:min-w-[600px] min-h-[16rem] max-h-[92vh] overflow-hidden rounded-[1.5rem] bg-[radial-gradient(circle_at_28%_18%,rgba(99,179,237,0.4),transparent_28%),linear-gradient(135deg,#182235_0%,#263b52_48%,#25403f_100%)] p-6 text-white',
        className
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        muted={muted}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Animated Bars Visualizer */}
      <div className="flex flex-1 w-full items-center justify-center px-4">
        <div className="flex h-32 w-full items-end justify-center gap-2 ">
          {bars.map((_, index) => (
            <span
              key={`${id || src}-${index}`}
              ref={(el) => {
                barsRef.current[index] = el
              }}
              className={cn(
                'block w-2 rounded-full transition-[height] duration-75',
                index % 3 === 0 ? 'bg-accent' : index % 3 === 1 ? 'bg-blue-400/80' : 'bg-white/60'
              )}
              style={{ height: '10%' }}
            />
          ))}
        </div>
      </div>

      {/* VideoPlayerControls-style Bottom Bar */}
      <div className="w-full max-w-3xl shrink-0 space-y-4 rounded-2xl bg-black/40 p-5 shadow-lg backdrop-blur-xl border border-white/5">
        {/* Progress Scrubber */}
        <div className="group/progress relative h-1.5 w-full rounded-full bg-white/20">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
          />
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-accent"
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
          />
          <div
            className="absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full bg-accent opacity-0 shadow-md transition-opacity group-hover/progress:opacity-100"
            style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
          />
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>

            <div className="flex items-center gap-2 rounded-full bg-black/25 px-2 py-1">
              <button onClick={toggleMute} className="text-white/80 hover:text-white">
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
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setVolume(v)
                  if (audioRef.current) audioRef.current.volume = v
                  if (v > 0) setMuted(false)
                }}
                className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/20 accent-accent"
              />
            </div>

            <div className="text-xs font-medium tabular-nums text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={String(playbackRate)}
              onChange={(e) => setPlaybackRate(Number(e.target.value))}
              className="h-9 cursor-pointer appearance-none rounded-full border border-white/10 bg-black/25 px-3 text-xs text-white outline-none hover:bg-black/40"
            >
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
            <button
              onClick={() => setLoop(!loop)}
              title="Toggle loop"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                loop ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
              )}
            >
              <Repeat className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
