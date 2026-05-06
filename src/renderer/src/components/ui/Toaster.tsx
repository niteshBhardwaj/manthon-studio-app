import { useEffect, type JSX } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useAppStore } from '../../stores/app-store'

const toneClasses = {
  info: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-50',
  success: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-400/20 bg-rose-500/10 text-rose-50'
} as const

const toneIcon = {
  info: Info,
  success: CheckCircle2,
  error: XCircle
} as const

function ToastItem({
  id,
  title,
  message,
  tone
}: {
  id: string
  title: string
  message?: string
  tone: 'info' | 'success' | 'error'
}): JSX.Element {
  const removeToast = useAppStore((state) => state.removeToast)

  useEffect(() => {
    const timeout = window.setTimeout(() => removeToast(id), 3000)
    return () => window.clearTimeout(timeout)
  }, [id, removeToast])

  const Icon = toneIcon[tone]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 32, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 32, scale: 0.96 }}
      transition={{ type: 'spring', bounce: 0.18, duration: 0.3 }}
      className={`w-[22rem] rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${toneClasses[tone]}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-black/20 p-1.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          {message ? <div className="mt-1 text-xs text-white/70">{message}</div> : null}
        </div>
      </div>
    </motion.div>
  )
}

export function Toaster(): JSX.Element | null {
  const toasts = useAppStore((state) => state.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  )
}
