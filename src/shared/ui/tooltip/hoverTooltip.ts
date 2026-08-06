import { useCallback, useEffect, useRef, useState } from 'react'

export const tooltipOpenDelay = 700
export const tooltipCloseDelay = 120
/** Clear of the trigger. HeroUI's own no-arrow default of 3px sits too close. */
export const tooltipOffset = 10

/**
 * Hover and focus state for a tooltip.
 *
 * After Effects delivers React Aria hover events unreliably, so the open state
 * is driven from raw mouse events instead of the built-in trigger behaviour.
 */
export function useHoverTooltip() {
  const timerRef = useRef<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) {
      return
    }

    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const schedule = useCallback(
    (nextIsOpen: boolean, delay: number) => {
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setIsOpen(nextIsOpen)
      }, delay)
    },
    [clearTimer],
  )

  const close = useCallback(() => {
    clearTimer()
    setIsOpen(false)
  }, [clearTimer])

  const open = useCallback(() => {
    clearTimer()
    setIsOpen(true)
  }, [clearTimer])

  useEffect(
    () => () => {
      clearTimer()
    },
    [clearTimer],
  )

  return {
    close,
    isOpen,
    /** Passed to the trigger so it drives the tooltip from raw events. */
    triggerProps: {
      onBlur: close,
      onFocus: open,
      onMouseEnter: () => schedule(true, tooltipOpenDelay),
      onMouseLeave: () => schedule(false, tooltipCloseDelay),
    },
  }
}
