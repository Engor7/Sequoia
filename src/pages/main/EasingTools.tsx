import { Button, Tooltip, type PressEvent } from '@heroui/react'
import { useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import { runHostCommand } from '../../shared/cep/host-command'
import {
  refreshSelectedMotionEffects,
  useSelectedMotionEffects,
} from '../../shared/cep/motion-effects'
import {
  tooltipCloseDelay,
  tooltipOffset,
  tooltipOpenDelay,
  useHoverTooltip,
} from '../../shared/ui/tooltip/hoverTooltip'
import {
  anchorPointPositions,
  layerTransformTools,
  motionEffectTools,
  shapeAndControllerTools,
  type AnchorPointPosition,
  type EasingToolModifiers,
  type HostTool,
  type MotionEffectTool,
} from './motionTools'

function readModifiers(
  event: PressEvent | ReactMouseEvent<HTMLButtonElement>,
): EasingToolModifiers {
  return { altKey: event.altKey, shiftKey: event.shiftKey }
}

function HostToolAction({ tool }: { tool: HostTool }) {
  const { Icon } = tool
  const runTool = useCallback(
    (modifiers: EasingToolModifiers) => {
      runHostCommand({
        id: `${tool.id}-${modifiers.altKey}-${modifiers.shiftKey}`,
        label: tool.label,
        script: tool.buildScript(modifiers),
      })
    },
    [tool],
  )

  return (
    <Tooltip closeDelay={tooltipCloseDelay} delay={tooltipOpenDelay}>
      <Button
        aria-label={`${tool.label}. ${tool.description}`}
        className="easing-tool-action"
        isIconOnly
        onMouseUp={(event) => {
          // CEP may expose PointerEvent while only emitting legacy mouse events.
          if (event.button === 0) {
            runTool(readModifiers(event))
          }
        }}
        onPress={(event) => runTool(readModifiers(event))}
        size="sm"
        type="button"
        variant="outline"
      >
        <Icon size={tool.iconSize} />
      </Button>
      <Tooltip.Content
        className="easing-motion-tooltip"
        offset={tooltipOffset}
        placement="top start"
      >
        <div className="easing-motion-tooltip__content">
          <p className="easing-motion-tooltip__title">{tool.label}</p>
          <p>{tool.description}</p>
        </div>
      </Tooltip.Content>
    </Tooltip>
  )
}

/**
 * Applies a motion pseudo-effect, and offers a removal button while the
 * selection already carries it.
 */
function MotionEffectAction({ tool }: { tool: MotionEffectTool }) {
  const { close: closeTooltip, isOpen, triggerProps } = useHoverTooltip()
  const { Icon } = tool
  const isApplied = useSelectedMotionEffects().has(tool.id)

  const applyEffect = useCallback(() => {
    runHostCommand({
      id: `apply-${tool.id}`,
      label: tool.name,
      onSettled: refreshSelectedMotionEffects,
      partialUnit: 'properties',
      partialVerb: 'was applied to',
      script: tool.applyScript,
    })
  }, [tool])

  const removeEffect = useCallback(() => {
    runHostCommand({
      id: `remove-${tool.id}`,
      label: tool.name,
      onSettled: refreshSelectedMotionEffects,
      onSuccess: closeTooltip,
      partialUnit: 'properties',
      partialVerb: 'was removed from',
      script: tool.removeScript,
    })
  }, [closeTooltip, tool])

  return (
    <div className="easing-motion-action">
      {isApplied ? (
        <Button
          aria-label={`Полностью удалить ${tool.name}`}
          className="easing-motion-remove"
          isIconOnly
          onMouseUp={(event) => {
            if (event.button === 0) {
              removeEffect()
            }
          }}
          onPress={removeEffect}
          size="sm"
          type="button"
          variant="danger"
        >
          <span aria-hidden="true">×</span>
        </Button>
      ) : null}
      <Tooltip
        closeDelay={tooltipCloseDelay}
        delay={tooltipOpenDelay}
        isOpen={isOpen}
        onOpenChange={(nextIsOpen) => {
          if (!nextIsOpen) {
            closeTooltip()
          }
        }}
      >
        <Button
          aria-label={tool.applyLabel}
          className="easing-tool-action"
          isIconOnly
          {...triggerProps}
          onMouseUp={(event) => {
            if (event.button === 0) {
              applyEffect()
            }
          }}
          onPress={applyEffect}
          size="sm"
          type="button"
          variant="outline"
        >
          <Icon size={tool.iconSize} />
        </Button>
        <Tooltip.Content
          className="easing-motion-tooltip"
          offset={tooltipOffset}
          placement="top start"
        >
          <div className="easing-motion-tooltip__content">
            <p className="easing-motion-tooltip__title">{tool.title}</p>
            <p>{tool.description}</p>
            <dl className="easing-motion-tooltip__controls">
              {tool.controls.map((control) => (
                <div key={control.label}>
                  <dt>{control.label}</dt>
                  <dd>{control.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Tooltip.Content>
      </Tooltip>
    </div>
  )
}

function AnchorPointGrid() {
  const setAnchorPoint = useCallback((position: AnchorPointPosition) => {
    runHostCommand({
      id: `anchor-${position.id}`,
      label: 'Anchor Point',
      partialUnit: 'layers',
      script: `Sequoia.setAnchorPoint(${position.horizontal}, ${position.vertical})`,
    })
  }, [])

  return (
    <div aria-label="Anchor point position" className="easing-anchor-grid" role="group">
      {anchorPointPositions.map((position) => (
        <Button
          aria-label={`Set anchor point to ${position.label.toLowerCase()}`}
          className="easing-anchor-action"
          isIconOnly
          key={position.id}
          onMouseUp={(event) => {
            if (event.button === 0) {
              setAnchorPoint(position)
            }
          }}
          onPress={() => setAnchorPoint(position)}
          size="sm"
          type="button"
          variant="outline"
        >
          <span aria-hidden="true" className="easing-anchor-action__dot" />
        </Button>
      ))}
    </div>
  )
}

export function EasingTools() {
  return (
    <section aria-label="Easing tools" className="easing-tools">
      <div className="easing-tools__section">
        <AnchorPointGrid />
      </div>

      <div className="easing-tools__section">
        <div aria-label="Additional actions" className="easing-tool-actions" role="group">
          <div
            aria-label="Layer transform actions"
            className="easing-tool-actions__group"
            role="group"
          >
            {layerTransformTools.map((tool) => (
              <HostToolAction key={tool.id} tool={tool} />
            ))}
          </div>

          <div
            aria-label="Motion effects"
            className="easing-tool-actions__group"
            role="group"
          >
            {motionEffectTools.map((tool) => (
              <MotionEffectAction key={tool.id} tool={tool} />
            ))}
          </div>

          <div
            aria-label="Shape and controller actions"
            className="easing-tool-actions__group"
            role="group"
          >
            {shapeAndControllerTools.map((tool) => (
              <HostToolAction key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
