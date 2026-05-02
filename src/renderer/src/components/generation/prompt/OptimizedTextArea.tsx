import { type JSX, useEffect, useRef, useState, startTransition } from 'react'
import { cn } from '../../../lib/utils'

export function OptimizedTextArea({
  initialPrompt,
  onPromptChange,
  isExpanded,
  setIsExpanded,
  placeholder,
  onFocus,
  onBlur,
  onKeyDown,
  hasAttachmentButton
}: {
  initialPrompt: string
  onPromptChange: (val: string) => void
  isExpanded: boolean
  setIsExpanded: (val: boolean) => void
  placeholder: string
  onFocus: () => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  hasAttachmentButton: boolean
}): JSX.Element {
  const [localPrompt, setLocalPrompt] = useState(initialPrompt)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isTyping = useRef(false)

  useEffect(() => {
    if (!isTyping.current) {
      setLocalPrompt(initialPrompt)
    } else if (initialPrompt === '') {
      setLocalPrompt('')
    }
  }, [initialPrompt])

  useEffect(() => {
    if (!textareaRef.current) return

    textareaRef.current.style.height = '0px'
    const scrollHeight = textareaRef.current.scrollHeight
    textareaRef.current.style.height = `${scrollHeight}px`

    if (localPrompt.trim() === '') {
      if (isExpanded) setIsExpanded(false)
    } else if (!isExpanded && scrollHeight > 38) {
      setIsExpanded(true)
    }
  }, [localPrompt, isExpanded, setIsExpanded])

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = event.target.value
    setLocalPrompt(val)
    startTransition(() => {
      onPromptChange(val)
    })
  }

  const handleFocus = () => {
    isTyping.current = true
    onFocus()
  }

  const handleBlur = () => {
    isTyping.current = false
    onBlur()
  }

  return (
    <textarea
      ref={textareaRef}
      value={localPrompt}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={1}
      className={cn(
        'flex-1 resize-none bg-transparent text-[14px] leading-5 text-text-primary outline-none duration-300 placeholder:text-text-muted/55 scrollbar-hide',
        isExpanded
          ? 'max-h-48 min-h-[2rem] px-2 mb-14 py-1.5'
          : cn('max-h-32 min-h-[2rem] py-1.5 lg:pr-44', hasAttachmentButton ? 'pl-11' : 'px-2')
      )}
      style={{ transitionProperty: 'margin' }}
    />
  )
}
