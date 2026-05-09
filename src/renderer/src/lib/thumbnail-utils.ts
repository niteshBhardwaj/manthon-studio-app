type VideoAssetLike = {
  id: string
  type: 'video' | 'image' | 'audio'
  storage_path: string
  mime_type: string
  thumbnail_path?: string | null
}

const THUMBNAIL_QUALITY = 0.82
const THUMBNAIL_MAX_WIDTH = 1280
const FRAME_THUMBNAIL_MAX_WIDTH = 320

function toAssetUrl(path: string): string {
  return `asset:///${path.replace(/\\/g, '/')}`
}

function normalizeBase64(data: string): string {
  return data.includes(',') ? (data.split(',').pop() ?? '') : data
}

function waitForLoadedMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('error', handleError)
    }
    const handleLoadedMetadata = (): void => {
      cleanup()
      resolve()
    }
    const handleError = (): void => {
      cleanup()
      reject(new Error('Failed to load video metadata'))
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

function seekTo(video: HTMLVideoElement, requestedTime: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
    const targetTime =
      duration > 0 ? Math.min(Math.max(requestedTime, 0), Math.max(duration - 0.05, 0)) : 0

    const cleanup = (): void => {
      window.clearTimeout(timeout)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
    }
    const handleSeeked = (): void => {
      cleanup()
      resolve()
    }
    const handleError = (): void => {
      cleanup()
      reject(new Error('Failed to seek video'))
    }
    const timeout = window.setTimeout((): void => {
      cleanup()
      reject(new Error('Timed out while extracting video frame'))
    }, 8000)

    video.addEventListener('seeked', handleSeeked, { once: true })
    video.addEventListener('error', handleError, { once: true })

    if (Math.abs(video.currentTime - targetTime) < 0.01) {
      window.requestAnimationFrame((): void => {
        cleanup()
        resolve()
      })
      return
    }

    video.currentTime = targetTime
  })
}

async function extractVideoFrame(
  src: string,
  timeSeconds: number,
  maxWidth = THUMBNAIL_MAX_WIDTH
): Promise<string> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = src

  try {
    video.load()
    await waitForLoadedMetadata(video)
    await seekTo(video, timeSeconds)

    const sourceWidth = video.videoWidth || 1
    const sourceHeight = video.videoHeight || 1
    const scale = Math.min(1, maxWidth / sourceWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sourceWidth * scale))
    canvas.height = Math.max(1, Math.round(sourceHeight * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context is unavailable')

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return normalizeBase64(canvas.toDataURL('image/webp', THUMBNAIL_QUALITY))
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}

export async function extractVideoThumbnail(src: string): Promise<string> {
  return extractVideoFrame(src, 0.1)
}

export async function extractFrameAtTime(src: string, timeSeconds: number): Promise<string> {
  return extractVideoFrame(src, timeSeconds, FRAME_THUMBNAIL_MAX_WIDTH)
}

export async function generateVideoThumbnailForAsset(
  asset: VideoAssetLike
): Promise<string | null> {
  if (asset.type !== 'video' || asset.thumbnail_path || !window.manthan?.generateThumbnail)
    return null

  try {
    const thumbnail = await extractVideoThumbnail(toAssetUrl(asset.storage_path))
    return await window.manthan.generateThumbnail(asset.id, thumbnail, 'image/webp')
  } catch (error) {
    console.warn('Failed to extract thumbnail from asset URL, trying base64 fallback', error)
  }

  try {
    const base64 = await window.manthan.readAsset?.(asset.id)
    if (!base64) return null
    const thumbnail = await extractVideoThumbnail(`data:${asset.mime_type};base64,${base64}`)
    return await window.manthan.generateThumbnail(asset.id, thumbnail, 'image/webp')
  } catch (error) {
    console.warn('Failed to extract thumbnail from video asset', error)
  }

  return null
}

export async function generateVideoThumbnailsForAssets(assets: VideoAssetLike[]): Promise<void> {
  const videoAssets = assets.filter((asset) => asset.type === 'video' && !asset.thumbnail_path)
  for (const asset of videoAssets) {
    await generateVideoThumbnailForAsset(asset)
  }
}
