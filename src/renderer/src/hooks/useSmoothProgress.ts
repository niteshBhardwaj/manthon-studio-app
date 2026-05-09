import { useEffect, useState } from 'react'

export function useSmoothProgress(targetProgress: number, active: boolean): number {
  const normalizedTarget = Math.max(0, Math.min(100, targetProgress || 0))
  const [displayProgress, setDisplayProgress] = useState(normalizedTarget)

  useEffect(() => {
    if (!active) {
      const timer = window.setTimeout(() => setDisplayProgress(normalizedTarget), 0)
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(() => {
      setDisplayProgress((current) => Math.max(current, normalizedTarget))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [active, normalizedTarget])

  useEffect(() => {
    if (!active) return

    const timer = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= 99 || current >= normalizedTarget + 18) return current

        const distanceToTarget = normalizedTarget - current
        const step = distanceToTarget > 0 ? Math.max(0.4, Math.min(2, distanceToTarget / 5)) : 0.18

        return Math.min(99, current + step)
      })
    }, 180)

    return () => window.clearInterval(timer)
  }, [active, normalizedTarget])

  return displayProgress
}
