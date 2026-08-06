import {
  Button,
  NumberField,
  Tabs,
  Tooltip,
  type PressEvent,
} from '@heroui/react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { evalHostScript } from '../../shared/cep/cs-interface'
import { runHostCommand } from '../../shared/cep/host-command'
import { addErrorLog } from '../../shared/logging/error-log'
import { PageLayout } from '../../shared/ui/page/PageLayout'
import { ToolDiagram } from './ToolDiagram'
import { keyframeDiagrams } from './toolDiagrams'
import {
  buildKeyframeCommand,
  buildKeyframeScript,
  keyframeToolSections,
  type KeyframePasteOrigin,
  type KeyframeStepUnit,
  type KeyframeStretchUnit,
  type KeyframeTool,
  type KeyframeToolModifiers,
  type KeyframeToolSettings,
} from './keyframeTools'

const tooltipOpenDelay = 700
const tooltipCloseDelay = 120
/** Clear of the trigger. HeroUI's own no-arrow default of 3px sits too close. */
const tooltipOffset = 10
const errorLogSource = 'Keyframes'

type SegmentedOption<Value extends string> = {
  description: string
  id: Value
  label: string
  title: string
}

const stepUnitLabels: SegmentedOption<KeyframeStepUnit>[] = [
  {
    description: 'Шаг задаётся в кадрах.',
    id: 'frames',
    label: 'fr',
    title: 'Frames',
  },
  {
    description: 'Шаг задаётся в секундах.',
    id: 'seconds',
    label: 'sec',
    title: 'Seconds',
  },
]

const stretchUnitLabels: SegmentedOption<KeyframeStretchUnit>[] = [
  {
    description: 'Длительность диапазона меняется в процентах от исходной.',
    id: 'percent',
    label: '%',
    title: 'Percent',
  },
  {
    description: 'Диапазон ключей приводится к длительности в кадрах.',
    id: 'frames',
    label: 'fr',
    title: 'Frames',
  },
  {
    description: 'Диапазон ключей приводится к длительности в секундах.',
    id: 'seconds',
    label: 'sec',
    title: 'Seconds',
  },
]

const pasteOriginLabels: SegmentedOption<KeyframePasteOrigin>[] = [
  {
    description: 'Вставляет ключи относительно начала слоя.',
    id: 'inPoint',
    label: 'In',
    title: 'Layer In',
  },
  {
    description: 'Вставляет ключи относительно конца слоя.',
    id: 'outPoint',
    label: 'Out',
    title: 'Layer Out',
  },
  {
    description: 'Вставляет ключи от позиции курсора времени.',
    id: 'cti',
    label: 'CTI',
    title: 'Playhead',
  },
  {
    description: 'Вставляет ключи от первого выбранного ключа свойства.',
    id: 'selection',
    label: 'Keys',
    title: 'Selected Keys',
  },
]

/**
 * Hover and focus state for a tooltip.
 *
 * After Effects delivers React Aria hover events unreliably, so the open state
 * is driven from raw mouse events instead of the built-in trigger behaviour.
 */
function useHoverTooltip() {
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
    triggerProps: {
      onBlur: close,
      onFocus: open,
      onMouseEnter: () => schedule(true, tooltipOpenDelay),
      onMouseLeave: () => schedule(false, tooltipCloseDelay),
    },
  }
}

type TooltipInfoProps = {
  description: string
  title: string
}

/** Tooltip body for controls that only need a name and a short explanation. */
function TooltipInfo({ description, title }: TooltipInfoProps) {
  return (
    <Tooltip.Content
      className="keyframes-tooltip keyframes-tooltip--compact"
      offset={tooltipOffset}
      placement="top start"
    >
      <div className="keyframes-tooltip__content">
        <p className="keyframes-tooltip__title">{title}</p>
        <p>{description}</p>
      </div>
    </Tooltip.Content>
  )
}

type ControlTooltipProps = {
  children: ReactNode
  description: string
  title: string
}

/**
 * Explains a control that carries no visible label. The wrapper stays out of
 * the tab order so the field inside keeps its own focus behaviour.
 */
function ControlTooltip({ children, description, title }: ControlTooltipProps) {
  const { close, isOpen, triggerProps } = useHoverTooltip()

  return (
    <Tooltip
      closeDelay={tooltipCloseDelay}
      delay={tooltipOpenDelay}
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          close()
        }
      }}
    >
      <Tooltip.Trigger
        className="keyframes-control"
        role="presentation"
        tabIndex={-1}
        {...triggerProps}
      >
        {children}
      </Tooltip.Trigger>
      <TooltipInfo description={description} title={title} />
    </Tooltip>
  )
}

type SegmentedOptionTabProps<Value extends string> = {
  onSelect: (value: Value) => void
  option: SegmentedOption<Value>
}

/**
 * Single segment, carrying its own tooltip so the description shows up next to
 * the segment under the pointer.
 *
 * The explicit `onMouseUp` handler keeps the control usable with a physical
 * mouse inside After Effects, where React Aria press events are unreliable.
 */
function SegmentedOptionTab<Value extends string>({
  onSelect,
  option,
}: SegmentedOptionTabProps<Value>) {
  const { close, isOpen, triggerProps } = useHoverTooltip()

  return (
    <Tooltip
      closeDelay={tooltipCloseDelay}
      delay={tooltipOpenDelay}
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          close()
        }
      }}
    >
      <Tabs.Tab
        className="keyframes-segmented__option"
        id={option.id}
        {...triggerProps}
        onMouseUp={(event) => {
          if (event.button === 0) {
            onSelect(option.id)
          }
        }}
      >
        {option.label}
        <Tabs.Indicator />
      </Tabs.Tab>
      <TooltipInfo description={option.description} title={option.title} />
    </Tooltip>
  )
}

type SegmentedControlProps<Value extends string> = {
  label: string
  onChange: (value: Value) => void
  options: SegmentedOption<Value>[]
  value: Value
}

/**
 * Mutually exclusive unit picker built on HeroUI tabs, so the selection is
 * carried by the sliding indicator instead of a background tint.
 */
function SegmentedControl<Value extends string>({
  label,
  onChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  return (
    <Tabs
      className="keyframes-segmented"
      onSelectionChange={(key) => onChange(String(key) as Value)}
      selectedKey={value}
    >
      <Tabs.ListContainer className="keyframes-segmented__track">
        <Tabs.List aria-label={label} className="keyframes-segmented__list">
          {options.map((option) => (
            <SegmentedOptionTab
              key={option.id}
              onSelect={onChange}
              option={option}
            />
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}

type ToolControlsProps = {
  children: ReactNode
  label: string
}

function ToolControls({ children, label }: ToolControlsProps) {
  return (
    <div aria-label={label} className="keyframes-controls" role="group">
      {children}
    </div>
  )
}

type KeyframeToolButtonProps = {
  isDisabled?: boolean
  onRun: (tool: KeyframeTool, modifiers: KeyframeToolModifiers) => void
  tool: KeyframeTool
}

function KeyframeToolButton({
  isDisabled,
  onRun,
  tool,
}: KeyframeToolButtonProps) {
  const {
    close: closeTooltip,
    isOpen: isTooltipOpen,
    triggerProps: tooltipTriggerProps,
  } = useHoverTooltip()
  const { Icon } = tool
  const diagram = tool.diagram ? keyframeDiagrams[tool.diagram] : undefined

  const runFromPress = useCallback(
    (event: PressEvent) => {
      onRun(tool, {
        altKey: event.altKey,
        ctrlOrMetaKey: event.ctrlKey || event.metaKey,
        shiftKey: event.shiftKey,
      })
    },
    [onRun, tool],
  )

  const runFromMouse = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      // The mouse fallback bypasses React Aria, so it must honour the
      // disabled state on its own.
      if (event.button !== 0 || isDisabled) {
        return
      }

      onRun(tool, {
        altKey: event.altKey,
        ctrlOrMetaKey: event.ctrlKey || event.metaKey,
        shiftKey: event.shiftKey,
      })
    },
    [isDisabled, onRun, tool],
  )

  return (
    <Tooltip
      closeDelay={tooltipCloseDelay}
      delay={tooltipOpenDelay}
      isOpen={isTooltipOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          closeTooltip()
        }
      }}
    >
      <Button
        aria-label={`${tool.label}. ${tool.description}`}
        className={`keyframes-tool${tool.code ? ' keyframes-tool--code' : ''}`}
        isDisabled={isDisabled}
        isIconOnly
        {...tooltipTriggerProps}
        onMouseUp={runFromMouse}
        onPress={runFromPress}
        size="sm"
        type="button"
        variant="outline"
      >
        {Icon ? <Icon size={16} /> : <span aria-hidden="true">{tool.code}</span>}
      </Button>
      <Tooltip.Content
        className="keyframes-tooltip"
        offset={tooltipOffset}
        placement="top start"
      >
        <div className="keyframes-tooltip__content">
          <p className="keyframes-tooltip__title">{tool.label}</p>
          {diagram ? (
            <div className="keyframes-tooltip__diagram">
              <ToolDiagram diagram={diagram} />
            </div>
          ) : null}
          <p>{tool.description}</p>
          {tool.hints ? (
            <dl className="keyframes-tooltip__hints">
              {tool.hints.map((hint) => (
                <div key={hint.label}>
                  <dt>{hint.label}</dt>
                  <dd>{hint.description}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </Tooltip.Content>
    </Tooltip>
  )
}

export function KeyframesPage() {
  const [hasClipboard, setHasClipboard] = useState(false)
  const [pasteOrigin, setPasteOrigin] = useState<KeyframePasteOrigin>('inPoint')
  const [stepUnit, setStepUnit] = useState<KeyframeStepUnit>('seconds')
  const [stepValue, setStepValue] = useState(1)
  const [stretchUnit, setStretchUnit] = useState<KeyframeStretchUnit>('percent')
  const [stretchValue, setStretchValue] = useState(75)

  useEffect(() => {
    let isDisposed = false

    evalHostScript('Sequoia.hasKeyframeClipboard()', (result) => {
      if (!isDisposed) {
        setHasClipboard(result.trim() === '1')
      }
    })

    return () => {
      isDisposed = true
    }
  }, [])

  const runTool = useCallback(
    (tool: KeyframeTool, modifiers: KeyframeToolModifiers) => {
      const settings: KeyframeToolSettings = {
        pasteOrigin,
        stepUnit,
        stepValue,
        stretchUnit,
        stretchValue,
      }
      const command = buildKeyframeCommand(tool, modifiers, settings)

      if (!command) {
        addErrorLog({
          message: `${tool.label} needs a valid value above zero.`,
          source: errorLogSource,
        })
        return
      }

      runHostCommand({
        id: `${tool.id}-${modifiers.altKey}-${modifiers.shiftKey}-${modifiers.ctrlOrMetaKey}`,
        label: tool.label,
        onSuccess: () => {
          if (tool.action === 'copy') {
            setHasClipboard(true)
          }
        },
        partialUnit: 'keyframes',
        script: buildKeyframeScript(command),
      })
    },
    [pasteOrigin, stepUnit, stepValue, stretchUnit, stretchValue],
  )

  return (
    <PageLayout>
      <div className="keyframes-page">
        {keyframeToolSections.map((section) => (
          <section
            aria-label={section.title}
            className="keyframes-section"
            key={section.id}
          >
            <div className="keyframes-section__header">
              <h2 className="keyframes-section__title">
                {section.shortTitle ?? section.title}
              </h2>

              {section.id === 'stagger' ? (
                <ToolControls label="Step">
                  <ControlTooltip
                    description="Шаг между группами ключей для Stagger и Interval."
                    title="Step"
                  >
                    <NumberField
                      aria-label="Stagger step"
                      className="keyframes-field"
                      minValue={0}
                      onChange={setStepValue}
                      step={1}
                      value={stepValue}
                    >
                      <NumberField.Group className="keyframes-field__group">
                        <NumberField.Input className="keyframes-field__input" />
                      </NumberField.Group>
                    </NumberField>
                  </ControlTooltip>
                  <SegmentedControl
                    label="Stagger step unit"
                    onChange={setStepUnit}
                    options={stepUnitLabels}
                    value={stepUnit}
                  />
                </ToolControls>
              ) : null}

              {section.id === 'stretch' ? (
                <ToolControls label="Amount">
                  <ControlTooltip
                    description="Величина растяжения для инструментов Stretch."
                    title="Amount"
                  >
                    <NumberField
                      aria-label="Stretch amount"
                      className="keyframes-field"
                      minValue={0}
                      onChange={setStretchValue}
                      step={1}
                      value={stretchValue}
                    >
                      <NumberField.Group className="keyframes-field__group">
                        <NumberField.Input className="keyframes-field__input" />
                      </NumberField.Group>
                    </NumberField>
                  </ControlTooltip>
                  <SegmentedControl
                    label="Stretch amount unit"
                    onChange={setStretchUnit}
                    options={stretchUnitLabels}
                    value={stretchUnit}
                  />
                </ToolControls>
              ) : null}

              {section.id === 'copyPaste' ? (
                <ToolControls label="Paste at">
                  <SegmentedControl
                    label="Paste origin"
                    onChange={setPasteOrigin}
                    options={pasteOriginLabels}
                    value={pasteOrigin}
                  />
                </ToolControls>
              ) : null}
            </div>

            <div
              aria-label={`${section.title} tools`}
              className="keyframes-tools"
              role="group"
            >
              {section.tools.map((tool) => (
                <KeyframeToolButton
                  isDisabled={tool.needsClipboard ? !hasClipboard : undefined}
                  key={tool.id}
                  onRun={runTool}
                  tool={tool}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageLayout>
  )
}
