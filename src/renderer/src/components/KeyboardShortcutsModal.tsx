import { type JSX, useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'

const SHORTCUT_GROUPS = [
  {
    title: 'Dashboard',
    shortcuts: [
      ['Arrow keys', 'Move selection'],
      ['Enter', 'Open selected media'],
      ['S', 'Star selected generation'],
      ['D', 'Download selected media'],
      ['Delete', 'Delete or cancel selected item']
    ]
  },
  {
    title: 'Video Player',
    shortcuts: [
      ['Space', 'Play or pause'],
      ['Left / Right', 'Seek 5 seconds'],
      ['F', 'Toggle fullscreen'],
      ['M', 'Mute or unmute']
    ]
  },
  {
    title: 'Prompt',
    shortcuts: [
      ['Enter', 'Generate'],
      ['Shift+Enter', 'New line'],
      ['Ctrl/Cmd+Enter', 'Generate'],
      ['Escape', 'Close config or modal']
    ]
  },
  {
    title: 'Global',
    shortcuts: [
      ['?', 'Show keyboard shortcuts'],
      ['Escape', 'Close modal or lightbox']
    ]
  }
]

export function KeyboardShortcutsModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}): JSX.Element | null {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-bg-primary shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Close keyboard shortcuts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map(([shortcut, action]) => (
                  <div
                    key={`${group.title}-${shortcut}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-xs"
                  >
                    <span className="text-text-secondary">{action}</span>
                    <kbd className="shrink-0 rounded-md border border-white/10 bg-black/35 px-2 py-1 font-mono text-[10px] text-text-primary">
                      {shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
