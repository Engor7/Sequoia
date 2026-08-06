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

let cachedBridge: CepScriptBridge | undefined
let cachedReloadScript: string | undefined

function getCepScriptBridge() {
  if (cachedBridge) {
    return cachedBridge
  }

  cachedBridge =
    typeof window.CSInterface === 'function'
      ? new window.CSInterface()
      : window.__adobe_cep__

  return cachedBridge
}

/**
 * Picks up host script edits without restarting After Effects.
 *
 * Re-evaluating `host.jsx` also pulls in every tool file it loads, which is
 * thousands of lines, so the generated snippet stamps the folder and only
 * re-evaluates when a `.jsx` file actually changed on disk.
 */
function buildDevelopmentHostReloadScript(bridge: CepScriptBridge) {
  if (!import.meta.env.DEV || typeof bridge.getSystemPath !== 'function') {
    return ''
  }

  const extensionPath = decodeURI(bridge.getSystemPath('extension')).replace(
    /\/$/,
    '',
  )
  const scriptFolder = JSON.stringify(`${extensionPath}/jsx`)
  const hostScriptPath = JSON.stringify(`${extensionPath}/jsx/host.jsx`)

  return `(function () {
  var files = new Folder(${scriptFolder}).getFiles("*.jsx") || [];
  var stamps = [];

  for (var index = 0; index < files.length; index += 1) {
    stamps.push(files[index].name + ":" + files[index].modified.getTime());
  }

  stamps.sort();
  var stamp = stamps.join(";");

  if ($.global.__sequoiaHostStamp !== stamp) {
    $.global.__sequoiaHostStamp = stamp;
    $.evalFile(new File(${hostScriptPath}));
  }
})();`
}

function getDevelopmentHostReloadScript(bridge: CepScriptBridge) {
  if (cachedReloadScript === undefined) {
    cachedReloadScript = buildDevelopmentHostReloadScript(bridge)
  }

  return cachedReloadScript
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
