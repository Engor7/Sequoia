import type { ComponentType } from 'react'
import {
  CopyKeyframesIcon,
  FlipKeyframesIcon,
  PasteAbsoluteIcon,
  PasteRelativeIcon,
  ShiftBackOneFrameIcon,
  ShiftBackTenFramesIcon,
  ShiftForwardOneFrameIcon,
  ShiftForwardTenFramesIcon,
  StaggerAscendingIcon,
  StaggerDescendingIcon,
  StaggerRandomIcon,
  type IconProps,
} from '../../shared/ui/icon'
import type { KeyframeDiagramId } from './toolDiagrams'

export type KeyframeToolAction =
  | 'alignFirstKey'
  | 'alignInPoint'
  | 'alignLastKey'
  | 'alignOutPoint'
  | 'constantSpeed'
  | 'copy'
  | 'duplicate'
  | 'duplicateFlip'
  | 'flip'
  | 'interval'
  | 'intervalClean'
  | 'paste'
  | 'shift'
  | 'snapFrame'
  | 'staggerAscending'
  | 'staggerDescending'
  | 'staggerRandom'
  | 'stretchCTI'
  | 'stretchFirstKey'
  | 'stretchLastKey'

export type KeyframeScope = 'global' | 'layer' | 'property'
export type KeyframeStepUnit = 'frames' | 'seconds'
export type KeyframeStretchUnit = 'frames' | 'percent' | 'seconds'
export type KeyframePasteOrigin = 'cti' | 'inPoint' | 'outPoint' | 'selection'
export type KeyframePasteMode = 'absolute' | 'relative'

export type KeyframeToolHint = {
  description: string
  label: string
}

export type KeyframeTool = {
  action: KeyframeToolAction
  /** Shown on the button when the tool is explained by a diagram instead of a glyph. */
  code?: string
  description: string
  diagram?: KeyframeDiagramId
  frames?: number
  hints?: KeyframeToolHint[]
  Icon?: ComponentType<IconProps>
  id: string
  label: string
  needsClipboard?: boolean
  pasteMode?: KeyframePasteMode
}

export type KeyframeToolSectionId =
  | 'align'
  | 'cleanup'
  | 'copyPaste'
  | 'duplicate'
  | 'shift'
  | 'stagger'
  | 'stretch'

export type KeyframeToolSection = {
  id: KeyframeToolSectionId
  /** Shown in place of `title` in the heading. `title` stays the spoken name. */
  shortTitle?: string
  title: string
  tools: KeyframeTool[]
}

export type KeyframeToolModifiers = {
  altKey: boolean
  ctrlOrMetaKey: boolean
  shiftKey: boolean
}

export type KeyframeToolSettings = {
  pasteOrigin: KeyframePasteOrigin
  stepUnit: KeyframeStepUnit
  stepValue: number
  stretchUnit: KeyframeStretchUnit
  stretchValue: number
}

export type KeyframeCommand = {
  action: KeyframeToolAction
  autoUpdate: boolean
  frames: number
  origin: KeyframePasteOrigin | ''
  pasteMode: KeyframePasteMode
  scope: KeyframeScope
  unit: KeyframeStepUnit | KeyframeStretchUnit | ''
  value: number
}

const scopeHints: KeyframeToolHint[] = [
  { description: 'ключи каждого слоя двигаются как одна группа.', label: 'Клик' },
  { description: 'каждое свойство обрабатывается отдельно.', label: 'Alt' },
  {
    description: 'всё выделение обрабатывается как один диапазон.',
    label: 'Shift',
  },
]

const pasteHints: KeyframeToolHint[] = [
  {
    description: 'заменяет ключ, который уже стоит в точке вставки.',
    label: 'Ctrl / Cmd',
  },
]

const duplicateTools: KeyframeTool[] = [
  {
    action: 'duplicate',
    code: 'DUP',
    description: 'Копирует выбранные ключи в позицию курсора времени.',
    diagram: 'duplicate',
    hints: scopeHints,
    id: 'duplicate',
    label: 'Duplicate Keyframes',
  },
  {
    action: 'duplicateFlip',
    code: 'D+R',
    description:
      'Копирует выбранные ключи в позицию курсора времени и разворачивает их порядок.',
    diagram: 'duplicateFlip',
    hints: scopeHints,
    id: 'duplicate-flip',
    label: 'Duplicate + Reverse',
  },
  {
    action: 'flip',
    description: 'Отражает выбранные ключи по времени внутри диапазона выделения.',
    hints: scopeHints,
    Icon: FlipKeyframesIcon,
    id: 'flip',
    label: 'Flip',
  },
]

const alignTools: KeyframeTool[] = [
  {
    action: 'alignFirstKey',
    code: 'CTI',
    description: 'Перемещает первый выбранный ключ в позицию курсора времени.',
    diagram: 'alignFirstKey',
    hints: scopeHints,
    id: 'align-first-key',
    label: 'First Key on CTI',
  },
  {
    action: 'alignLastKey',
    code: 'LCT',
    description: 'Перемещает последний выбранный ключ в позицию курсора времени.',
    diagram: 'alignLastKey',
    hints: scopeHints,
    id: 'align-last-key',
    label: 'Last Key on CTI',
  },
  {
    action: 'alignInPoint',
    code: 'IN',
    description:
      'Перемещает выбранные ключи так, чтобы первый ключ совпал с началом слоя.',
    diagram: 'alignInPoint',
    hints: scopeHints,
    id: 'align-in-point',
    label: 'First Key on Layer In',
  },
  {
    action: 'alignOutPoint',
    code: 'OUT',
    description:
      'Перемещает выбранные ключи так, чтобы последний ключ совпал с концом слоя.',
    diagram: 'alignOutPoint',
    hints: scopeHints,
    id: 'align-out-point',
    label: 'Last Key on Layer Out',
  },
]

const staggerTools: KeyframeTool[] = [
  {
    action: 'staggerDescending',
    description:
      'Сдвигает выбранные группы ключей на заданный шаг в обратном порядке выделения.',
    hints: scopeHints,
    Icon: StaggerDescendingIcon,
    id: 'stagger-descending',
    label: 'Descending Order',
  },
  {
    action: 'staggerAscending',
    description:
      'Сдвигает выбранные группы ключей на заданный шаг в порядке выделения.',
    hints: scopeHints,
    Icon: StaggerAscendingIcon,
    id: 'stagger-ascending',
    label: 'Ascending Order',
  },
  {
    action: 'staggerRandom',
    description:
      'Сдвигает выбранные группы ключей на заданный шаг в случайном порядке.',
    hints: scopeHints,
    Icon: StaggerRandomIcon,
    id: 'stagger-random',
    label: 'Randomize Order',
  },
  {
    action: 'interval',
    code: 'INT',
    description: 'Расставляет выбранные ключи с равным интервалом по заданному шагу.',
    diagram: 'interval',
    id: 'interval',
    label: 'Interval',
  },
]

const stretchTools: KeyframeTool[] = [
  {
    action: 'stretchFirstKey',
    code: 'ST1',
    description: 'Меняет тайминг выбранных ключей относительно первого ключа.',
    diagram: 'stretchFirstKey',
    hints: scopeHints,
    id: 'stretch-first-key',
    label: 'Stretch from First Key',
  },
  {
    action: 'stretchLastKey',
    code: 'STL',
    description: 'Меняет тайминг выбранных ключей относительно последнего ключа.',
    diagram: 'stretchLastKey',
    hints: scopeHints,
    id: 'stretch-last-key',
    label: 'Stretch from Last Key',
  },
  {
    action: 'stretchCTI',
    code: 'STC',
    description: 'Меняет тайминг выбранных ключей относительно курсора времени.',
    diagram: 'stretchCTI',
    id: 'stretch-cti',
    label: 'Stretch from Playhead',
  },
]

const copyPasteTools: KeyframeTool[] = [
  {
    action: 'copy',
    description:
      'Копирует выбранные ключи одного слоя вместе с кривыми для последующей вставки.',
    Icon: CopyKeyframesIcon,
    id: 'copy',
    label: 'Copy',
  },
  {
    action: 'paste',
    description:
      'Вставляет скопированные ключи в выбранные слои с исходными значениями.',
    hints: pasteHints,
    Icon: PasteAbsoluteIcon,
    id: 'paste-absolute',
    label: 'Paste Absolute',
    needsClipboard: true,
    pasteMode: 'absolute',
  },
  {
    action: 'paste',
    description:
      'Вставляет скопированные ключи со смещением относительно текущих значений слоя.',
    hints: pasteHints,
    Icon: PasteRelativeIcon,
    id: 'paste-relative',
    label: 'Paste Relative',
    needsClipboard: true,
    pasteMode: 'relative',
  },
]

const cleanupTools: KeyframeTool[] = [
  {
    action: 'snapFrame',
    code: 'SNF',
    description: 'Привязывает выбранные ключи к ближайшему целому кадру.',
    diagram: 'snapFrame',
    id: 'snap-frame',
    label: 'Snap Frame',
  },
  {
    action: 'constantSpeed',
    code: 'CST',
    description:
      'Выравнивает скорость между двумя выбранными ключами, сохраняя их кривую.',
    diagram: 'constantSpeed',
    id: 'constant-speed',
    label: 'Constant Speed',
  },
  {
    action: 'intervalClean',
    code: 'CLN',
    description:
      'Удаляет невыделенные ключи между первым и последним выбранными ключами.',
    diagram: 'intervalClean',
    id: 'interval-clean',
    label: 'Overlap Cleaning',
  },
]

const shiftTools: KeyframeTool[] = [
  {
    action: 'shift',
    description: 'Сдвигает выбранные ключи на десять кадров раньше.',
    frames: -10,
    Icon: ShiftBackTenFramesIcon,
    id: 'shift-minus-10',
    label: 'Shift −10 Frames',
  },
  {
    action: 'shift',
    description: 'Сдвигает выбранные ключи на один кадр раньше.',
    frames: -1,
    Icon: ShiftBackOneFrameIcon,
    id: 'shift-minus-1',
    label: 'Shift −1 Frame',
  },
  {
    action: 'shift',
    description: 'Сдвигает выбранные ключи на один кадр позже.',
    frames: 1,
    Icon: ShiftForwardOneFrameIcon,
    id: 'shift-plus-1',
    label: 'Shift +1 Frame',
  },
  {
    action: 'shift',
    description: 'Сдвигает выбранные ключи на десять кадров позже.',
    frames: 10,
    Icon: ShiftForwardTenFramesIcon,
    id: 'shift-plus-10',
    label: 'Shift +10 Frames',
  },
]

export const keyframeToolSections: KeyframeToolSection[] = [
  { id: 'duplicate', title: 'Duplicate / Flip', tools: duplicateTools },
  { id: 'align', title: 'Align', tools: alignTools },
  { id: 'stagger', title: 'Stagger', tools: staggerTools },
  { id: 'stretch', title: 'Stretch', tools: stretchTools },
  {
    id: 'copyPaste',
    shortTitle: 'C / P',
    title: 'Copy / Paste',
    tools: copyPasteTools,
  },
  { id: 'cleanup', title: 'Cleanup', tools: cleanupTools },
  { id: 'shift', title: 'Shift', tools: shiftTools },
]

/**
 * After Effects has no single "selection" concept for keyframes, so the
 * modifiers pick how the selected keys are grouped before they are retimed.
 */
export function scopeFromModifiers({
  altKey,
  shiftKey,
}: KeyframeToolModifiers): KeyframeScope {
  if (altKey === shiftKey) {
    return 'layer'
  }

  return altKey ? 'property' : 'global'
}

function isStaggerAction(action: KeyframeToolAction) {
  return (
    action === 'interval' ||
    action === 'staggerAscending' ||
    action === 'staggerDescending' ||
    action === 'staggerRandom'
  )
}

function isStretchAction(action: KeyframeToolAction) {
  return (
    action === 'stretchCTI' ||
    action === 'stretchFirstKey' ||
    action === 'stretchLastKey'
  )
}

/**
 * Turns a tool press into a host command, or `null` when the typed value cannot
 * drive that tool.
 */
export function buildKeyframeCommand(
  tool: KeyframeTool,
  modifiers: KeyframeToolModifiers,
  settings: KeyframeToolSettings,
): KeyframeCommand | null {
  const command: KeyframeCommand = {
    action: tool.action,
    autoUpdate: false,
    frames: 0,
    origin: '',
    pasteMode: 'absolute',
    scope: scopeFromModifiers(modifiers),
    unit: '',
    value: 0,
  }

  if (isStaggerAction(tool.action)) {
    if (!Number.isFinite(settings.stepValue)) {
      return null
    }

    return { ...command, unit: settings.stepUnit, value: settings.stepValue }
  }

  if (isStretchAction(tool.action)) {
    if (!Number.isFinite(settings.stretchValue) || settings.stretchValue <= 0) {
      return null
    }

    return {
      ...command,
      scope: tool.action === 'stretchCTI' ? 'global' : command.scope,
      unit: settings.stretchUnit,
      value: settings.stretchValue,
    }
  }

  if (tool.action === 'paste') {
    return {
      ...command,
      autoUpdate: modifiers.ctrlOrMetaKey,
      origin: settings.pasteOrigin,
      pasteMode: tool.pasteMode ?? 'absolute',
    }
  }

  if (tool.action === 'shift') {
    if (!Number.isFinite(tool.frames)) {
      return null
    }

    return { ...command, frames: tool.frames ?? 0 }
  }

  return command
}

export function buildKeyframeScript(command: KeyframeCommand) {
  const args = [
    JSON.stringify(command.action),
    JSON.stringify(command.scope),
    String(command.value),
    JSON.stringify(command.unit),
    String(command.frames),
    JSON.stringify(command.origin),
    JSON.stringify(command.pasteMode),
    String(command.autoUpdate),
  ]

  return `Sequoia.runKeyframeTool(${args.join(', ')})`
}
