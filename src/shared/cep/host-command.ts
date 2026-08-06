import { addErrorLog } from '../logging/error-log'
import { evalHostScript } from './cs-interface'

/**
 * Every `Sequoia.*` endpoint answers in one of these shapes:
 *
 * - `ok|<count>` — the action changed `count` things.
 * - `noop|<count>` — the action applied, but nothing needed changing.
 * - `partial|<count>|<details>` — part of the selection was skipped.
 * - `error|<message>` — the action could not run.
 *
 * CEP adds `EvalScript_ErrMessage` of its own when the script itself failed.
 */
export type HostResult =
  | { count: number; details?: string; type: 'partial' }
  | { count: number; type: 'noop' }
  | { count: number; type: 'ok' }
  | { message?: string; type: 'error' }
  | { type: 'evalError' }

const repeatedActionDelay = 200
const lastActionTimes = new Map<string, number>()

function parseCount(value: string) {
  const count = Number.parseInt(value, 10)

  return Number.isFinite(count) ? count : 0
}

export function parseHostResult(rawResult: string): HostResult {
  const result = rawResult.trim()

  if (result === 'EvalScript_ErrMessage') {
    return { type: 'evalError' }
  }

  const separator = result.indexOf('|')
  const prefix = separator === -1 ? result : result.slice(0, separator)
  const payload = separator === -1 ? '' : result.slice(separator + 1)

  if (prefix === 'ok' || prefix === 'noop') {
    return { count: parseCount(payload), type: prefix }
  }

  if (prefix === 'partial') {
    const detailsSeparator = payload.indexOf('|')

    return {
      count: parseCount(
        detailsSeparator === -1 ? payload : payload.slice(0, detailsSeparator),
      ),
      details:
        detailsSeparator === -1
          ? undefined
          : payload.slice(detailsSeparator + 1) || undefined,
      type: 'partial',
    }
  }

  if (prefix === 'error') {
    return { message: payload || undefined, type: 'error' }
  }

  return { message: result || undefined, type: 'error' }
}

export type RunHostCommandOptions = {
  /**
   * Debounce key. A repeat within 200ms is dropped, because After Effects can
   * deliver both a React Aria press and the legacy mouse fallback for one click.
   */
  id: string
  /** Names the action in log entries and in the fallback messages. */
  label: string
  /** Called for every outcome, before the result is logged. */
  onSettled?: () => void
  /** Called for `ok`, so a caller can react to a real change. */
  onSuccess?: (count: number) => void
  script: string
  /** Verb used in the partial message, for example "applied to". */
  partialVerb?: string
  /** Noun counted in the partial message. Defaults to "items". */
  partialUnit?: string
}

/**
 * Runs a host script, dropping duplicate presses and turning anything that is
 * not a clean success into a log entry.
 */
export function runHostCommand({
  id,
  label,
  onSettled,
  onSuccess,
  script,
  partialVerb = 'changed',
  partialUnit = 'items',
}: RunHostCommandOptions) {
  const now = Date.now()
  const lastRun = lastActionTimes.get(id)

  if (lastRun !== undefined && now - lastRun < repeatedActionDelay) {
    return
  }

  lastActionTimes.set(id, now)
  evalHostScript(script, (rawResult) => {
    const result = parseHostResult(rawResult)

    onSettled?.()

    if (result.type === 'ok') {
      onSuccess?.(result.count)
      return
    }

    // evalHostScript already logs a failed evaluation, with the script that
    // caused it, so logging it again here would only duplicate the entry.
    if (result.type === 'noop' || result.type === 'evalError') {
      return
    }

    if (result.type === 'partial') {
      addErrorLog({
        details: result.details,
        message: `${label} ${partialVerb} ${result.count || 'some'} ${partialUnit}, but part of the selection was skipped.`,
        source: label,
      })
      return
    }

    addErrorLog({
      message: result.message ?? `${label} could not be completed.`,
      source: label,
    })
  })
}
