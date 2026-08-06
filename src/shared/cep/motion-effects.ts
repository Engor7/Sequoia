import { useSyncExternalStore } from 'react'
import { evalHostScript } from './cs-interface'

/**
 * Which motion effects the current After Effects selection already carries.
 *
 * After Effects has no selection-changed event a panel can listen to, so this
 * has to be polled. One store polls once for every effect, because the host
 * call is served on the After Effects UI thread and a poll per button was
 * enough to make the application stutter.
 */
export type MotionEffectId =
  | 'blinker'
  | 'bounce'
  | 'fader'
  | 'overshoot'
  | 'spin'
  | 'wiggle'

const pollInterval = 700
/** CEP can drop an `evalScript` callback, which would wedge polling forever. */
const requestTimeout = 5000

const listeners = new Set<() => void>()

let selectedEffects: ReadonlySet<string> = new Set()
let pendingRequestStartedAt = 0
let pollTimer = 0

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

/**
 * Replaces the snapshot only when the set actually changed, so
 * `useSyncExternalStore` sees a stable reference between identical polls.
 */
function applyResult(result: string) {
  const ids = result
    .trim()
    .split(',')
    .filter((id) => id.length > 0)
  const hasSameEffects =
    ids.length === selectedEffects.size &&
    ids.every((id) => selectedEffects.has(id))

  if (hasSameEffects) {
    return
  }

  selectedEffects = new Set(ids)
  notifyListeners()
}

function poll(reloadHostInDevelopment: boolean) {
  const now = Date.now()

  if (pendingRequestStartedAt && now - pendingRequestStartedAt < requestTimeout) {
    return
  }

  pendingRequestStartedAt = now
  evalHostScript(
    'Sequoia.getSelectedMotionEffects()',
    (result) => {
      pendingRequestStartedAt = 0
      applyResult(result)
    },
    { reloadHostInDevelopment },
  )
}

/** Picks up a change made by the panel itself without waiting for the next poll. */
export function refreshSelectedMotionEffects() {
  pendingRequestStartedAt = 0
  poll(false)
}

function subscribeSelectedMotionEffects(listener: () => void) {
  listeners.add(listener)

  if (listeners.size === 1) {
    poll(true)
    pollTimer = window.setInterval(() => poll(false), pollInterval)
  }

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0) {
      window.clearInterval(pollTimer)
      pollTimer = 0
      pendingRequestStartedAt = 0
    }
  }
}

function getSelectedMotionEffectsSnapshot() {
  return selectedEffects
}

export function useSelectedMotionEffects() {
  return useSyncExternalStore(
    subscribeSelectedMotionEffects,
    getSelectedMotionEffectsSnapshot,
    getSelectedMotionEffectsSnapshot,
  )
}
