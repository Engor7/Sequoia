export type ErrorLogEntry = {
  details?: string
  id: number
  message: string
  source: string
  timestamp: number
}

type ErrorLogInput = Pick<ErrorLogEntry, 'message' | 'source'> & {
  details?: string
}

const MAX_ERROR_LOGS = 200

let errorLogs: ReadonlyArray<ErrorLogEntry> = []
let nextErrorLogId = 1
let isGlobalErrorLoggingInstalled = false

const errorLogListeners = new Set<() => void>()

function notifyErrorLogListeners() {
  errorLogListeners.forEach((listener) => listener())
}

function stringifyUnknown(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  try {
    const serialized = JSON.stringify(value, null, 2)

    if (serialized) {
      return serialized
    }
  } catch {
    // Fall back to the platform string representation for circular objects.
  }

  return String(value)
}

export function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      details: error.stack && error.stack !== error.message ? error.stack : undefined,
      message: error.message || error.name,
    }
  }

  return {
    details: undefined,
    message: stringifyUnknown(error),
  }
}

export function addErrorLog({ details, message, source }: ErrorLogInput) {
  const entry: ErrorLogEntry = {
    details,
    id: nextErrorLogId,
    message,
    source,
    timestamp: Date.now(),
  }

  nextErrorLogId += 1
  errorLogs = [entry, ...errorLogs].slice(0, MAX_ERROR_LOGS)
  notifyErrorLogListeners()
}

export function clearErrorLogs() {
  if (errorLogs.length === 0) {
    return
  }

  errorLogs = []
  notifyErrorLogListeners()
}

export function getErrorLogsSnapshot() {
  return errorLogs
}

export function subscribeErrorLogs(listener: () => void) {
  errorLogListeners.add(listener)

  return () => errorLogListeners.delete(listener)
}

export function installGlobalErrorLogging() {
  if (isGlobalErrorLoggingInstalled || typeof window === 'undefined') {
    return
  }

  isGlobalErrorLoggingInstalled = true

  window.addEventListener('error', (event) => {
    const describedError = event.error
      ? describeError(event.error)
      : { details: undefined, message: event.message || 'Unknown browser error' }
    const location = event.filename
      ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}`
      : undefined
    const details = [location, describedError.details].filter(Boolean).join('\n')

    addErrorLog({
      details: details || undefined,
      message: describedError.message,
      source: 'Browser',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const describedError = describeError(event.reason)

    addErrorLog({
      details: describedError.details,
      message: describedError.message,
      source: 'Promise',
    })
  })
}
