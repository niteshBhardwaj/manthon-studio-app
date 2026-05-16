const BINARY_KEYS = new Set(['data', 'imageBytes', 'videoBytes'])

function looksLikeLargeBase64(value: string): boolean {
  if (value.length <= 256) return false
  return /^[A-Za-z0-9+/=]+$/.test(value.slice(0, 64))
}

export function sanitizePayloadForLog(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayloadForLog(item))
  }

  if (typeof payload !== 'object' || payload === null) {
    return payload
  }

  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).map(([key, value]) => {
      if (BINARY_KEYS.has(key) && typeof value === 'string' && looksLikeLargeBase64(value)) {
        const sizeKB = Math.round((value.length * 0.75) / 1024)
        return [key, `[BASE64 TRIMMED - ${sizeKB} KB]`]
      }

      return [key, sanitizePayloadForLog(value)]
    })
  )
}
