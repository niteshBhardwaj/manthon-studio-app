function loadVideo(videoSrc: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      video.onloadedmetadata = null
      video.onerror = null
    }

    video.onloadedmetadata = () => {
      cleanup()
      resolve(video)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Unable to load video'))
    }

    video.src = videoSrc
    video.load()
  })
}

function seekVideo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const safeDuration = duration > 0 ? Math.max(0, duration - 0.05) : timeSeconds
    const target = Math.max(0, Math.min(timeSeconds, safeDuration))

    const cleanup = () => {
      video.onseeked = null
      video.onerror = null
    }

    video.onseeked = () => {
      cleanup()
      resolve()
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Unable to seek video'))
    }

    video.currentTime = target
  })
}

async function extractFrame(videoSrc: string, timeSeconds: number): Promise<string> {
  const video = await loadVideo(videoSrc)
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720

  await seekVideo(video, timeSeconds)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas unavailable')
  }

  context.drawImage(video, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

export async function extractFirstFrame(videoSrc: string): Promise<string> {
  return extractFrame(videoSrc, 0)
}

export async function extractFrameAtTime(videoSrc: string, timeSeconds: number): Promise<string> {
  return extractFrame(videoSrc, timeSeconds)
}
