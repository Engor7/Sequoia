import { addErrorLog, describeError } from '../logging/error-log'

declare global {
  interface Window {
    CSInterface?: new () => CepScriptBridge
    __adobe_cep__?: CepScriptBridge
  }
}

type CepScriptBridge = {
  evalScript: (script: string, callback?: (result: string) => void) => void
  getSystemPath?: (pathType: string) => string
}

type EvalHostScriptOptions = {
  reloadHostInDevelopment?: boolean
}

function getCepScriptBridge() {
  if (typeof window.CSInterface === 'function') {
    return new window.CSInterface()
  }

  return window.__adobe_cep__
}

function getDevelopmentHostReloadScript(bridge: CepScriptBridge) {
  if (!import.meta.env.DEV || typeof bridge.getSystemPath !== 'function') {
    return ''
  }

  const extensionPath = decodeURI(bridge.getSystemPath('extension')).replace(
    /\/$/,
    '',
  )
  const hostScriptPath = `${extensionPath}/jsx/host.jsx`

  return `$.evalFile(new File(${JSON.stringify(hostScriptPath)}));`
}

export function isCepRuntime() {
  return (
    typeof window !== 'undefined' &&
    (typeof window.CSInterface === 'function' ||
      typeof window.__adobe_cep__?.evalScript === 'function')
  )
}

export function evalHostScript(
  script: string,
  callback?: (result: string) => void,
  options: EvalHostScriptOptions = {},
) {
  if (typeof window === 'undefined') {
    return
  }

  const bridge = getCepScriptBridge()

  if (!bridge) {
    return
  }

  const reloadHostScript =
    options.reloadHostInDevelopment === false
      ? ''
      : getDevelopmentHostReloadScript(bridge)
  const scriptToEvaluate = reloadHostScript
    ? `${reloadHostScript}\n${script}`
    : script

  try {
    bridge.evalScript(scriptToEvaluate, (result) => {
      if (result.trim() === 'EvalScript_ErrMessage') {
        addErrorLog({
          details: script,
          message: 'ExtendScript execution failed.',
          source: 'CEP',
        })
      }

      callback?.(result)
    })
  } catch (error) {
    const describedError = describeError(error)

    addErrorLog({
      details: [describedError.details, script].filter(Boolean).join('\n\n'),
      message: describedError.message,
      source: 'CEP',
    })

    throw error
  }
}
