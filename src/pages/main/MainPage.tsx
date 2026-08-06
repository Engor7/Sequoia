import { Button, Modal, Tooltip, type PressEvent } from '@heroui/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type SetStateAction,
} from 'react'
import {
  BlinkerIcon,
  BounceIcon,
  ColorControlsIcon,
  ExplodeExtractShapesIcon,
  FaderIcon,
  FitCompHeightIcon,
  FitCompWidthIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  KeyframeCircleIcon,
  KeyframeDiamondIcon,
  KeyframeSquareIcon,
  MergeShapesIcon,
  NullControllerIcon,
  OvershootIcon,
  PathNullsIcon,
  SpinIcon,
  VectorToShapeIcon,
  WigglePropertyIcon,
} from '../../shared/ui/icon'
import { runHostCommand } from '../../shared/cep/host-command'
import {
  refreshSelectedMotionEffects,
  useSelectedMotionEffects,
  type MotionEffectId,
} from '../../shared/cep/motion-effects'
import { PageLayout } from '../../shared/ui/page/PageLayout'
import {
  cloneCurveHandles,
  easingPresets,
  type CurveHandles,
  type CurvePoint,
  type EasingPreset,
} from './easingPresets'

type HandleName = keyof CurveHandles
type KeyframeConversionMode = 'autoBezier' | 'hold' | 'linear'

const keyframeConversionLabels: Record<KeyframeConversionMode, string> = {
  autoBezier: 'Auto Bezier Keyframes',
  hold: 'Hold Keyframes',
  linear: 'Linear Keyframes',
}

type AnchorPointPosition = {
  horizontal: 0 | 0.5 | 1
  id: string
  label: string
  vertical: 0 | 0.5 | 1
}

type PresetGridMetrics = {
  capacity: number
  columns: number
  height: number
  rows: number
}

const defaultHandles: CurveHandles = {
  end: { x: 0.1, y: 1 },
  start: { x: 0.9, y: 0 },
}
const previewFrameCount = 14
const gridLines = [60, 120, 180, 240] as const
const plotStart = 15
const plotEnd = 285
const plotSize = plotEnd - plotStart
const presetGridGap = 6
const presetGridMinimumCellWidth = 42
const presetGridMinimumCellHeight = 36
const thumbnailSampleCount = 36
const motionEffectTooltipOpenDelay = 700
/** Clear of the trigger. HeroUI's own no-arrow default of 3px sits too close. */
const tooltipOffset = 10
const anchorPointPositions: AnchorPointPosition[] = [
  { horizontal: 0, id: 'top-left', label: 'Top left', vertical: 0 },
  { horizontal: 0.5, id: 'top-center', label: 'Top center', vertical: 0 },
  { horizontal: 1, id: 'top-right', label: 'Top right', vertical: 0 },
  { horizontal: 0, id: 'middle-left', label: 'Middle left', vertical: 0.5 },
  { horizontal: 0.5, id: 'center', label: 'Center', vertical: 0.5 },
  { horizontal: 1, id: 'middle-right', label: 'Middle right', vertical: 0.5 },
  { horizontal: 0, id: 'bottom-left', label: 'Bottom left', vertical: 1 },
  { horizontal: 0.5, id: 'bottom-center', label: 'Bottom center', vertical: 1 },
  { horizontal: 1, id: 'bottom-right', label: 'Bottom right', vertical: 1 },
]

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(Math.max(value, minimum), maximum)
}

function cubicCoordinate(
  start: number,
  handleStart: number,
  handleEnd: number,
  end: number,
  amount: number,
) {
  const inverse = 1 - amount

  return (
    inverse * inverse * inverse * start +
    3 * inverse * inverse * amount * handleStart +
    3 * inverse * amount * amount * handleEnd +
    amount * amount * amount * end
  )
}

function sampleCurveAtTime(handles: CurveHandles, time: number) {
  let lower = 0
  let upper = 1

  for (let iteration = 0; iteration < 18; iteration += 1) {
    const middle = (lower + upper) / 2
    const x = cubicCoordinate(
      0,
      handles.start.x,
      handles.end.x,
      1,
      middle,
    )

    if (x < time) {
      lower = middle
    } else {
      upper = middle
    }
  }

  return cubicCoordinate(
    0,
    handles.start.y,
    handles.end.y,
    1,
    (lower + upper) / 2,
  )
}

function curvePointToSvg(point: CurvePoint) {
  return {
    x: plotStart + point.x * plotSize,
    y: plotEnd - point.y * plotSize,
  }
}

function curvePositionToPreview(position: number) {
  return `${clamp(position) * 100}%`
}

type MotionPreviewProps = {
  handles: CurveHandles
  isPlaying: boolean
  onPreviewEnter: () => void
  onPreviewLeave: () => void
}

function MotionPreview({
  handles,
  isPlaying,
  onPreviewEnter,
  onPreviewLeave,
}: MotionPreviewProps) {
  const previewFrames = useMemo(
    () =>
      Array.from({ length: previewFrameCount }, (_, index) => {
        const time = index / (previewFrameCount - 1)

        return {
          position: sampleCurveAtTime(handles, time),
        }
      }),
    [handles],
  )

  return (
    <div className="easing-preview">
      <div
        className="easing-preview__viewport"
        onMouseEnter={onPreviewEnter}
        onMouseLeave={onPreviewLeave}
      >
        <div
          aria-label="Animation spacing preview for the current easing curve"
          className="easing-preview__track"
          role="img"
        >
          {previewFrames.map(({ position }, index) => (
            <span
              aria-hidden="true"
              className="easing-preview__frame"
              key={index}
              style={{ left: curvePositionToPreview(position) }}
            />
          ))}

          <span
            aria-hidden="true"
            className={`easing-preview__active-frame${
              isPlaying ? ' easing-preview__active-frame--playing' : ''
            }`}
            style={{
              animationTimingFunction: `cubic-bezier(${handles.start.x}, ${handles.start.y}, ${handles.end.x}, ${handles.end.y})`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

type CurveCanvasProps = {
  handles: CurveHandles
  onHandlesChange: Dispatch<SetStateAction<CurveHandles>>
  onPreviewEnter: () => void
  onPreviewLeave: () => void
}

function CurveCanvas({
  handles,
  onHandlesChange,
  onPreviewEnter,
  onPreviewLeave,
}: CurveCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const draggedHandleRef = useRef<HandleName | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const clientToCurvePoint = useCallback(
    (clientX: number, clientY: number): CurvePoint => {
      const bounds = svgRef.current?.getBoundingClientRect()

      if (!bounds) {
        return { x: 0, y: 0 }
      }

      const svgX = ((clientX - bounds.left) / bounds.width) * 300
      const svgY = ((clientY - bounds.top) / bounds.height) * 300
      const normalizedY = (plotEnd - svgY) / plotSize

      return {
        x: clamp((svgX - plotStart) / plotSize),
        y: clamp(normalizedY),
      }
    },
    [],
  )

  const updateHandle = useCallback(
    (handle: HandleName, point: CurvePoint) => {
      onHandlesChange((currentHandles) => ({
        ...currentHandles,
        [handle]: point,
      }))
    },
    [onHandlesChange],
  )

  useEffect(() => {
    if (!isDragging) {
      return undefined
    }

    const handleMouseMove = (event: MouseEvent) => {
      const draggedHandle = draggedHandleRef.current

      if (!draggedHandle) {
        return
      }

      event.preventDefault()
      updateHandle(
        draggedHandle,
        clientToCurvePoint(event.clientX, event.clientY),
      )
    }
    const stopDragging = () => {
      draggedHandleRef.current = null
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopDragging)
    window.addEventListener('blur', stopDragging)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopDragging)
      window.removeEventListener('blur', stopDragging)
    }
  }, [clientToCurvePoint, isDragging, updateHandle])

  const beginDrag = (
    event: ReactMouseEvent<SVGCircleElement>,
    handle: HandleName,
  ) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    draggedHandleRef.current = handle
    setIsDragging(true)
  }

  const handleKeyboardEdit = (
    event: KeyboardEvent<SVGCircleElement>,
    handle: HandleName,
  ) => {
    const step = event.shiftKey ? 0.05 : 0.01
    let deltaX = 0
    let deltaY = 0

    if (event.key === 'ArrowLeft') deltaX = -step
    if (event.key === 'ArrowRight') deltaX = step
    if (event.key === 'ArrowDown') deltaY = -step
    if (event.key === 'ArrowUp') deltaY = step

    if (deltaX === 0 && deltaY === 0) {
      return
    }

    event.preventDefault()
    updateHandle(handle, {
      x: clamp(handles[handle].x + deltaX),
      y: clamp(handles[handle].y + deltaY),
    })
  }

  const startAnchor = curvePointToSvg({ x: 0, y: 0 })
  const endAnchor = curvePointToSvg({ x: 1, y: 1 })
  const startHandle = curvePointToSvg(handles.start)
  const endHandle = curvePointToSvg(handles.end)

  return (
    <div
      className="easing-curve__canvas"
      onMouseEnter={onPreviewEnter}
      onMouseLeave={onPreviewLeave}
    >
      <svg
        aria-label="Cubic Bezier easing curve with two draggable handles"
        className="easing-curve__svg"
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        role="img"
        viewBox="0 0 300 300"
      >
        {gridLines.map((position) => (
          <line
            className="easing-curve__grid-line"
            key={`vertical-${position}`}
            x1={position}
            x2={position}
            y1="0"
            y2="300"
          />
        ))}
        {gridLines.map((position) => (
          <line
            className="easing-curve__grid-line"
            key={`horizontal-${position}`}
            x1="0"
            x2="300"
            y1={position}
            y2={position}
          />
        ))}

        <line
          className="easing-curve__handle-line easing-curve__handle-line--start"
          x1={startAnchor.x}
          x2={startHandle.x}
          y1={startAnchor.y}
          y2={startHandle.y}
        />
        <line
          className="easing-curve__handle-line easing-curve__handle-line--end"
          x1={endHandle.x}
          x2={endAnchor.x}
          y1={endHandle.y}
          y2={endAnchor.y}
        />

        <path
          className="easing-curve__path"
          d={`M ${startAnchor.x} ${startAnchor.y} C ${startHandle.x} ${startHandle.y}, ${endHandle.x} ${endHandle.y}, ${endAnchor.x} ${endAnchor.y}`}
        />

        <circle
          aria-label="Start easing handle"
          className="easing-curve__handle-hit-area"
          cx={startHandle.x}
          cy={startHandle.y}
          onKeyDown={(event) => handleKeyboardEdit(event, 'start')}
          onMouseDown={(event) => beginDrag(event, 'start')}
          r="14"
          role="button"
          tabIndex={0}
        />
        <circle
          aria-hidden="true"
          className="easing-curve__handle easing-curve__handle--start"
          cx={startHandle.x}
          cy={startHandle.y}
          r="7"
        />
        <circle
          aria-label="End easing handle"
          className="easing-curve__handle-hit-area"
          cx={endHandle.x}
          cy={endHandle.y}
          onKeyDown={(event) => handleKeyboardEdit(event, 'end')}
          onMouseDown={(event) => beginDrag(event, 'end')}
          r="14"
          role="button"
          tabIndex={0}
        />
        <circle
          aria-hidden="true"
          className="easing-curve__handle easing-curve__handle--end"
          cx={endHandle.x}
          cy={endHandle.y}
          r="7"
        />

        <rect
          aria-hidden="true"
          className="easing-curve__anchor easing-curve__anchor--start"
          height="20"
          width="20"
          x={startAnchor.x - 10}
          y={startAnchor.y - 10}
        />
        <rect
          aria-hidden="true"
          className="easing-curve__anchor easing-curve__anchor--end"
          height="20"
          width="20"
          x={endAnchor.x - 10}
          y={endAnchor.y - 10}
        />
      </svg>
    </div>
  )
}

function EasingPresetThumbnail({ handles }: { handles: CurveHandles }) {
  const curvePath = useMemo(() => {
    const height = 28
    const width = 52
    const startX = 6
    const startY = 34

    return Array.from({ length: thumbnailSampleCount }, (_, index) => {
      const time = index / (thumbnailSampleCount - 1)
      const position = sampleCurveAtTime(handles, time)
      const x = startX + time * width
      const y = startY - position * height

      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    }).join(' ')
  }, [handles])

  return (
    <svg
      aria-hidden="true"
      className="easing-preset-card__thumbnail"
      preserveAspectRatio="none"
      viewBox="0 0 64 40"
    >
      <line
        className="easing-preset-card__reference"
        x1="6"
        x2="58"
        y1="34"
        y2="6"
      />
      <path className="easing-preset-card__curve" d={curvePath} />
    </svg>
  )
}

type EasingPresetCardProps = {
  layout: 'catalog' | 'compact'
  onSelect: (preset: EasingPreset) => void
  preset: EasingPreset
}

function EasingPresetCard({
  layout,
  onSelect,
  preset,
}: EasingPresetCardProps) {
  const selectPreset = () => onSelect(preset)

  return (
    <Button
      aria-label={`Select ${preset.label} easing preset`}
      className={`easing-preset-card easing-preset-card--${layout}`}
      onMouseUp={(event) => {
        if (event.button === 0) {
          selectPreset()
        }
      }}
      onPress={selectPreset}
      size="sm"
      type="button"
      variant="ghost"
    >
      <EasingPresetThumbnail handles={preset.handles} />
      {layout === 'catalog' ? (
        <span className="easing-preset-card__label">{preset.label}</span>
      ) : null}
    </Button>
  )
}

type MorePresetsButtonProps = {
  buttonRef: Ref<HTMLButtonElement>
  onOpen: () => void
}

function MorePresetsButton({ buttonRef, onOpen }: MorePresetsButtonProps) {
  return (
    <Button
      aria-label="Open all easing presets"
      className="easing-preset-card easing-preset-card--compact easing-preset-card--more"
      onMouseUp={(event) => {
        if (event.button === 0) {
          onOpen()
        }
      }}
      onPress={onOpen}
      ref={buttonRef}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span aria-hidden="true" className="easing-preset-card__ellipsis">
        •••
      </span>
    </Button>
  )
}

function usePresetGridMetrics(
  editorRef: RefObject<HTMLDivElement | null>,
  gridRef: RefObject<HTMLDivElement | null>,
) {
  const [metrics, setMetrics] = useState<PresetGridMetrics>({
    capacity: 1,
    columns: 1,
    height: 0,
    rows: 1,
  })

  useLayoutEffect(() => {
    let animationFrame = 0

    const measure = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const editor = editorRef.current
        const grid = gridRef.current

        if (!editor || !grid) {
          return
        }

        const editorBounds = editor.getBoundingClientRect()
        const gridBounds = grid.getBoundingClientRect()
        const isStacked = gridBounds.top > editorBounds.top + 1
        const height = isStacked
          ? presetGridMinimumCellHeight
          : Math.round(editorBounds.height)
        const width = gridBounds.width
        const maximumColumns = Math.max(
          1,
          Math.floor(
            (width + presetGridGap) /
              (presetGridMinimumCellWidth + presetGridGap),
          ),
        )
        const maximumRows = isStacked
          ? 1
          : Math.max(
              1,
              Math.floor(
                (height + presetGridGap) /
                  (presetGridMinimumCellHeight + presetGridGap),
              ),
            )
        const availableItems = easingPresets.length + 1
        let columns = 1
        let rows = 1
        let capacity = 1
        let aspectPenalty = Number.POSITIVE_INFINITY

        for (
          let candidateColumns = 1;
          candidateColumns <= maximumColumns;
          candidateColumns += 1
        ) {
          for (
            let candidateRows = 1;
            candidateRows <= maximumRows;
            candidateRows += 1
          ) {
            const candidateCapacity = candidateColumns * candidateRows

            if (candidateCapacity > availableItems) {
              continue
            }

            const cellWidth =
              (width - presetGridGap * (candidateColumns - 1)) /
              candidateColumns
            const cellHeight =
              (height - presetGridGap * (candidateRows - 1)) / candidateRows
            const candidateAspectPenalty = Math.abs(
              Math.log(cellWidth / cellHeight / 1.25),
            )

            if (
              candidateCapacity > capacity ||
              (candidateCapacity === capacity &&
                candidateAspectPenalty < aspectPenalty)
            ) {
              aspectPenalty = candidateAspectPenalty
              capacity = candidateCapacity
              columns = candidateColumns
              rows = candidateRows
            }
          }
        }

        setMetrics((currentMetrics) => {
          if (
            currentMetrics.capacity === capacity &&
            currentMetrics.columns === columns &&
            currentMetrics.height === height &&
            currentMetrics.rows === rows
          ) {
            return currentMetrics
          }

          return { capacity, columns, height, rows }
        })
      })
    }

    measure()
    window.addEventListener('resize', measure)

    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null

    if (resizeObserver) {
      if (editorRef.current) resizeObserver.observe(editorRef.current)
      if (gridRef.current) resizeObserver.observe(gridRef.current)
    }

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', measure)
      resizeObserver?.disconnect()
    }
  }, [editorRef, gridRef])

  return metrics
}

type EasingPresetsGridProps = {
  buttonRef: Ref<HTMLButtonElement>
  containerRef: Ref<HTMLDivElement>
  metrics: PresetGridMetrics
  onOpenAll: () => void
  onSelect: (preset: EasingPreset) => void
}

function EasingPresetsGrid({
  buttonRef,
  containerRef,
  metrics,
  onOpenAll,
  onSelect,
}: EasingPresetsGridProps) {
  const visiblePresets = easingPresets.slice(
    0,
    Math.max(0, metrics.capacity - 1),
  )
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${metrics.columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${metrics.rows}, minmax(0, 1fr))`,
    height: metrics.height > 0 ? `${metrics.height}px` : undefined,
  }

  return (
    <div
      aria-label="Easing presets"
      className="easing-presets-grid"
      ref={containerRef}
      role="group"
      style={gridStyle}
    >
      {visiblePresets.map((preset) => (
        <EasingPresetCard
          key={preset.id}
          layout="compact"
          onSelect={onSelect}
          preset={preset}
        />
      ))}
      <MorePresetsButton buttonRef={buttonRef} onOpen={onOpenAll} />
    </div>
  )
}

type EasingPresetsModalProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSelect: (preset: EasingPreset) => void
}

function EasingPresetsModal({
  isOpen,
  onOpenChange,
  onSelect,
}: EasingPresetsModalProps) {
  const closeModal = () => onOpenChange(false)
  const selectPreset = (preset: EasingPreset) => {
    onSelect(preset)
    closeModal()
  }

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      variant="opaque"
    >
      <Modal.Container placement="center" scroll="inside" size="lg">
        <Modal.Dialog className="easing-presets-modal">
          <Modal.CloseTrigger
            aria-label="Close easing presets"
            className="easing-presets-modal__close"
            onMouseUp={(event) => {
              if (event.button === 0) {
                closeModal()
              }
            }}
            onPress={closeModal}
          />
          <Modal.Header className="easing-presets-modal__header">
            <Modal.Heading>Easing Presets</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="easing-presets-modal__body">
            <div
              aria-label="All easing presets"
              className="easing-presets-catalog"
              role="group"
            >
              {easingPresets.map((preset) => (
                <EasingPresetCard
                  key={preset.id}
                  layout="catalog"
                  onSelect={selectPreset}
                  preset={preset}
                />
              ))}
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

type CurveEditorProps = {
  containerRef: Ref<HTMLDivElement>
  handles: CurveHandles
  onHandlesChange: Dispatch<SetStateAction<CurveHandles>>
}

function CurveEditor({
  containerRef,
  handles,
  onHandlesChange,
}: CurveEditorProps) {
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const startPreview = () => setIsPreviewPlaying(true)
  const stopPreview = () => setIsPreviewPlaying(false)
  const convertKeyframes = useCallback((mode: KeyframeConversionMode) => {
    runHostCommand({
      id: `convert-${mode}`,
      label: keyframeConversionLabels[mode],
      partialUnit: 'keyframes',
      script: `Sequoia.convertSelectedKeyframes("${mode}")`,
    })
  }, [])
  const applyEasing = useCallback(() => {
    runHostCommand({
      id: 'apply-easing',
      label: 'Apply Easing',
      partialUnit: 'keyframes',
      script: `Sequoia.applyEasing(${handles.start.x}, ${handles.start.y}, ${handles.end.x}, ${handles.end.y})`,
    })
  }, [handles])

  return (
    <div className="easing-editor" ref={containerRef}>
      <MotionPreview
        handles={handles}
        isPlaying={isPreviewPlaying}
        onPreviewEnter={startPreview}
        onPreviewLeave={stopPreview}
      />
      <CurveCanvas
        handles={handles}
        onHandlesChange={onHandlesChange}
        onPreviewEnter={startPreview}
        onPreviewLeave={stopPreview}
      />
      <div className="easing-actions">
        <div
          aria-label="Selected keyframe conversion"
          className="easing-keyframe-actions"
          role="group"
        >
          <Button
            aria-label="Convert selected keyframes to linear interpolation"
            className="easing-keyframe-action"
            isIconOnly
            onMouseUp={(event) => {
              if (event.button === 0) {
                convertKeyframes('linear')
              }
            }}
            onPress={() => convertKeyframes('linear')}
            size="sm"
            type="button"
            variant="outline"
          >
            <KeyframeDiamondIcon />
          </Button>
          <Button
            aria-label="Convert selected keyframes to hold interpolation"
            className="easing-keyframe-action"
            isIconOnly
            onMouseUp={(event) => {
              if (event.button === 0) {
                convertKeyframes('hold')
              }
            }}
            onPress={() => convertKeyframes('hold')}
            size="sm"
            type="button"
            variant="outline"
          >
            <KeyframeSquareIcon />
          </Button>
          <Button
            aria-label="Convert selected keyframes to auto Bezier interpolation"
            className="easing-keyframe-action"
            isIconOnly
            onMouseUp={(event) => {
              if (event.button === 0) {
                convertKeyframes('autoBezier')
              }
            }}
            onPress={() => convertKeyframes('autoBezier')}
            size="sm"
            type="button"
            variant="outline"
          >
            <KeyframeCircleIcon />
          </Button>
        </div>

        <Button
          className="easing-apply-action"
          onMouseEnter={startPreview}
          onMouseLeave={stopPreview}
          onMouseUp={(event) => {
            if (event.button === 0) {
              applyEasing()
            }
          }}
          onPress={applyEasing}
          size="sm"
          type="button"
          variant="primary"
        >
          Apply
        </Button>
      </div>
    </div>
  )
}

type MotionEffectControlDescription = {
  description: string
  label: string
}

type EasingMotionEffectActionProps = {
  applyScript: string
  ariaLabel: string
  controls: MotionEffectControlDescription[]
  description: string
  effectId: MotionEffectId
  effectName: string
  icon: ReactNode
  removeScript: string
  tooltipTitle?: string
}

type EasingToolModifiers = {
  altKey: boolean
  shiftKey: boolean
}

type EasingHostToolActionProps = {
  description: string
  icon: ReactNode
  label: string
  onAction: (modifiers: EasingToolModifiers) => void
}

function EasingHostToolAction({
  description,
  icon,
  label,
  onAction,
}: EasingHostToolActionProps) {
  const runFromPress = useCallback(
    (event: PressEvent) => {
      onAction({ altKey: event.altKey, shiftKey: event.shiftKey })
    },
    [onAction],
  )
  const runFromMouse = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return
      }

      onAction({ altKey: event.altKey, shiftKey: event.shiftKey })
    },
    [onAction],
  )

  return (
    <Tooltip closeDelay={120} delay={motionEffectTooltipOpenDelay}>
      <Button
        aria-label={`${label}. ${description}`}
        className="easing-tool-action"
        isIconOnly
        onMouseUp={runFromMouse}
        onPress={runFromPress}
        size="sm"
        type="button"
        variant="outline"
      >
        {icon}
      </Button>
      <Tooltip.Content
          className="easing-motion-tooltip"
          offset={tooltipOffset}
          placement="top start"
        >
        <div className="easing-motion-tooltip__content">
          <p className="easing-motion-tooltip__title">{label}</p>
          <p>{description}</p>
        </div>
      </Tooltip.Content>
    </Tooltip>
  )
}

function EasingMotionEffectAction({
  applyScript,
  ariaLabel,
  controls,
  description,
  effectId,
  effectName,
  icon,
  removeScript,
  tooltipTitle,
}: EasingMotionEffectActionProps) {
  const tooltipTimerRef = useRef<number | null>(null)
  const hasSelectedProperties = useSelectedMotionEffects().has(effectId)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)

  const clearTooltipTimer = useCallback(() => {
    if (tooltipTimerRef.current === null) {
      return
    }

    window.clearTimeout(tooltipTimerRef.current)
    tooltipTimerRef.current = null
  }, [])

  const scheduleTooltipOpen = useCallback(() => {
    clearTooltipTimer()
    tooltipTimerRef.current = window.setTimeout(() => {
      tooltipTimerRef.current = null
      setIsTooltipOpen(true)
    }, motionEffectTooltipOpenDelay)
  }, [clearTooltipTimer])

  const scheduleTooltipClose = useCallback(() => {
    clearTooltipTimer()
    tooltipTimerRef.current = window.setTimeout(() => {
      tooltipTimerRef.current = null
      setIsTooltipOpen(false)
    }, 120)
  }, [clearTooltipTimer])

  const openTooltipForFocus = useCallback(() => {
    clearTooltipTimer()
    setIsTooltipOpen(true)
  }, [clearTooltipTimer])

  const handleTooltipOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        return
      }

      clearTooltipTimer()
      setIsTooltipOpen(false)
    },
    [clearTooltipTimer],
  )

  useEffect(
    () => () => {
      clearTooltipTimer()
    },
    [clearTooltipTimer],
  )

  const applyEffect = useCallback(() => {
    runHostCommand({
      id: `apply-${effectId}`,
      label: effectName,
      onSettled: refreshSelectedMotionEffects,
      partialUnit: 'properties',
      partialVerb: 'was applied to',
      script: applyScript,
    })
  }, [applyScript, effectId, effectName])

  const removeEffect = useCallback(() => {
    runHostCommand({
      id: `remove-${effectId}`,
      label: effectName,
      onSettled: refreshSelectedMotionEffects,
      onSuccess: () => setIsTooltipOpen(false),
      partialUnit: 'properties',
      partialVerb: 'was removed from',
      script: removeScript,
    })
  }, [effectId, effectName, removeScript])

  return (
    <div className="easing-motion-action">
      {hasSelectedProperties ? (
        <Button
          aria-label={`Полностью удалить ${effectName}`}
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
        closeDelay={120}
        delay={motionEffectTooltipOpenDelay}
        isOpen={isTooltipOpen}
        onOpenChange={handleTooltipOpenChange}
      >
        <Button
          aria-label={ariaLabel}
          className="easing-tool-action"
          isIconOnly
          onBlur={scheduleTooltipClose}
          onFocus={openTooltipForFocus}
          onMouseEnter={scheduleTooltipOpen}
          onMouseLeave={scheduleTooltipClose}
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
          {icon}
        </Button>
        <Tooltip.Content
          className="easing-motion-tooltip"
          offset={tooltipOffset}
          placement="top start"
        >
          <div className="easing-motion-tooltip__content">
            <p className="easing-motion-tooltip__title">
              {tooltipTitle ?? `${effectName}-анимация`}
            </p>
            <p>{description}</p>
            <dl className="easing-motion-tooltip__controls">
              {controls.map((control) => (
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

function EasingTools() {
  const setAnchorPoint = useCallback((position: AnchorPointPosition) => {
    runHostCommand({
      id: `anchor-${position.id}`,
      label: 'Anchor Point',
      partialUnit: 'layers',
      script: `Sequoia.setAnchorPoint(${position.horizontal}, ${position.vertical})`,
    })
  }, [])

  const runToolAction = useCallback(
    (id: string, label: string, script: string) => {
      runHostCommand({ id, label, script })
    },
    [],
  )

  return (
    <section aria-label="Easing tools" className="easing-tools">
      <div className="easing-tools__section">
        <div
          aria-label="Anchor point position"
          className="easing-anchor-grid"
          role="group"
        >
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
      </div>

      <div className="easing-tools__section">
        <div
          aria-label="Additional actions"
          className="easing-tool-actions"
          role="group"
        >
          <div
            aria-label="Layer transform actions"
            className="easing-tool-actions__group"
            role="group"
          >
            <EasingHostToolAction
              description="Отражает выбранные слои по горизонтали."
              icon={<FlipHorizontalIcon size={14} />}
              label="Flip Horizontal"
              onAction={() =>
                runToolAction(
                  'flip-horizontal',
                  'Flip Horizontal',
                  'Sequoia.flipSelectedLayers("horizontal")',
                )
              }
            />
            <EasingHostToolAction
              description="Отражает выбранные слои по вертикали."
              icon={<FlipVerticalIcon size={14} />}
              label="Flip Vertical"
              onAction={() =>
                runToolAction(
                  'flip-vertical',
                  'Flip Vertical',
                  'Sequoia.flipSelectedLayers("vertical")',
                )
              }
            />
            <EasingHostToolAction
              description="Масштабирует выбранные слои по ширине композиции с сохранением пропорций."
              icon={<FitCompWidthIcon size={15} />}
              label="Fit to Comp Width"
              onAction={() =>
                runToolAction(
                  'fit-width',
                  'Fit to Comp Width',
                  'Sequoia.fitSelectedLayers("width")',
                )
              }
            />
            <EasingHostToolAction
              description="Масштабирует выбранные слои по высоте композиции с сохранением пропорций."
              icon={<FitCompHeightIcon size={15} />}
              label="Fit to Comp Height"
              onAction={() =>
                runToolAction(
                  'fit-height',
                  'Fit to Comp Height',
                  'Sequoia.fitSelectedLayers("height")',
                )
              }
            />
          </div>

          <div
            aria-label="Motion effects"
            className="easing-tool-actions__group"
            role="group"
          >
            <EasingMotionEffectAction
              applyScript="Sequoia.applyWiggle()"
              ariaLabel="Применить Wiggle Property"
              controls={[
                {
                  description: 'Скорость случайного движения.',
                  label: 'Frequency',
                },
                {
                  description: 'Общая сила движения.',
                  label: 'Amount',
                },
                {
                  description: 'Отдельный контроль силы по X, Y и Z.',
                  label: 'Individual Axis',
                },
                {
                  description: 'Двигает все оси вместе.',
                  label: 'Lock Dimensions',
                },
                {
                  description: 'Создаёт другой случайный рисунок.',
                  label: 'Random Seed',
                },
                {
                  description: 'Делает движение ступенчатым.',
                  label: 'Frame Rate',
                },
              ]}
              description="Добавляет случайное движение выбранным свойствам."
              effectId="wiggle"
              effectName="Wiggle"
              icon={<WigglePropertyIcon size={16} />}
              removeScript="Sequoia.removeSelectedWiggle()"
              tooltipTitle="Wiggle Property"
            />
            <EasingMotionEffectAction
              applyScript="Sequoia.applyBounce()"
              ariaLabel="Применить Bounce-анимацию"
              controls={[
                {
                  description:
                    'Высота первого отскока в % от движения; 0 — выкл.',
                  label: 'Amount',
                },
                {
                  description: 'Длительность отскоков в секундах.',
                  label: 'Duration',
                },
                {
                  description: 'Чем выше, тем больше мелких отскоков.',
                  label: 'Elasticity',
                },
              ]}
              description="Затухающий отскок после последнего ключа без пересечения конечной точки."
              effectId="bounce"
              effectName="Bounce"
              icon={<BounceIcon size={15} />}
              removeScript="Sequoia.removeSelectedBounce()"
            />
            <EasingMotionEffectAction
              applyScript="Sequoia.applyOvershoot()"
              ariaLabel="Применить Overshoot-анимацию"
              controls={[
                {
                  description:
                    'Размер первого перелёта в % от последнего движения; 0 — выкл.',
                  label: 'Amount',
                },
                {
                  description: 'Длительность затухания в секундах.',
                  label: 'Duration',
                },
                {
                  description: 'Чем выше, тем больше колебаний.',
                  label: 'Elasticity',
                },
              ]}
              description="Затухающая инерция после последнего ключа с пересечением конечной точки."
              effectId="overshoot"
              effectName="Overshoot"
              icon={<OvershootIcon size={15} />}
              removeScript="Sequoia.removeSelectedOvershoot()"
            />
            <EasingMotionEffectAction
              applyScript="Sequoia.applySpin()"
              ariaLabel="Применить Spin Animation"
              controls={[
                {
                  description: 'Меняет направление вращения.',
                  label: 'Reverse',
                },
                {
                  description: 'Скорость вращения в градусах в секунду.',
                  label: 'Speed',
                },
                {
                  description: 'Делает вращение ступенчатым.',
                  label: 'Frame Rate',
                },
                {
                  description: 'Сдвигает стартовый угол.',
                  label: 'Offset',
                },
              ]}
              description="Добавляет постоянное вращение выбранным rotation-свойствам."
              effectId="spin"
              effectName="Spin"
              icon={<SpinIcon size={14} />}
              removeScript="Sequoia.removeSelectedSpin()"
              tooltipTitle="Spin Animation"
            />
            <EasingMotionEffectAction
              applyScript="Sequoia.applyBlinker()"
              ariaLabel="Применить Blinker / Flicker"
              controls={[
                {
                  description: 'Скорость мерцания.',
                  label: 'Speed',
                },
                {
                  description: 'Включает жёсткое переключение вкл/выкл.',
                  label: 'Enable Fixed',
                },
                {
                  description: 'Добавляет неровный тайминг.',
                  label: 'Random Timing',
                },
                {
                  description: 'Задаёт диапазон прозрачности.',
                  label: 'Max/Min Opacity',
                },
              ]}
              description="Добавляет мерцание прозрачности."
              effectId="blinker"
              effectName="Blinker / Flicker"
              icon={<BlinkerIcon size={16} />}
              removeScript="Sequoia.removeSelectedBlinker()"
              tooltipTitle="Blinker / Flicker"
            />
            <EasingMotionEffectAction
              applyScript="Sequoia.applyFader()"
              ariaLabel="Применить Fader"
              controls={[
                {
                  description: 'Длительность fade в кадрах.',
                  label: 'Animation',
                },
                {
                  description: 'Использует прямой fade вместо плавного.',
                  label: 'Linear',
                },
              ]}
              description="Добавляет автоматический fade прозрачности."
              effectId="fader"
              effectName="Fader"
              icon={<FaderIcon size={14} />}
              removeScript="Sequoia.removeSelectedFader()"
              tooltipTitle="Fader"
            />
          </div>

          <div
            aria-label="Shape and controller actions"
            className="easing-tool-actions__group"
            role="group"
          >
            <EasingHostToolAction
              description="Клик разбивает shape-группы на отдельные слои. Alt-клик конвертирует исходный слой или извлекает выбранные фигуры."
              icon={<ExplodeExtractShapesIcon size={15} />}
              label="Explode / Extract Shapes"
              onAction={({ altKey }) =>
                runToolAction(
                  `explode-extract-${altKey}`,
                  'Explode / Extract Shapes',
                  `Sequoia.explodeExtractShapes(${altKey})`,
                )
              }
            />
            <EasingHostToolAction
              description="Клик объединяет выбранные слои или shape-группы в один Shape Layer. Alt-клик объединяет выбранные Shape Layers."
              icon={<MergeShapesIcon size={15} />}
              label="Merge Shapes"
              onAction={({ altKey }) =>
                runToolAction(
                  `merge-shapes-${altKey}`,
                  'Merge Shapes',
                  `Sequoia.mergeShapes(${altKey})`,
                )
              }
            />
            <EasingHostToolAction
              description="Клик создаёт один Null в центре выделения. Alt-клик создаёт стандартный Null. Shift-клик создаёт отдельный Null для каждого слоя."
              icon={<NullControllerIcon size={15} />}
              label="Null Controller"
              onAction={({ altKey, shiftKey }) =>
                runToolAction(
                  `null-controller-${altKey}-${shiftKey}`,
                  'Null Controller',
                  `Sequoia.createNullControllers(${altKey}, ${shiftKey})`,
                )
              }
            />
            <EasingHostToolAction
              description="Клик заставляет Null следовать точкам выбранного Path. Alt-клик заставляет точки Path следовать созданным Null."
              icon={<PathNullsIcon size={14} />}
              label="Path Nulls"
              onAction={({ altKey }) =>
                runToolAction(
                  `path-nulls-${altKey}`,
                  'Path Nulls',
                  `Sequoia.linkPathNulls(${altKey})`,
                )
              }
            />
            <EasingHostToolAction
              description="Собирает уникальные цвета выделенных слоёв в один слой-палитру и связывает совпадающие цветовые свойства."
              icon={<ColorControlsIcon size={14} />}
              label="Color Controls"
              onAction={() =>
                runToolAction(
                  'color-controls',
                  'Color Controls',
                  'Sequoia.createColorControls()',
                )
              }
            />
            <EasingHostToolAction
              description="Клик создаёт Shape Layer из выбранных векторных слоёв. Alt-клик удаляет исходники. Shift-клик дополнительно чистит группы артбордов Illustrator."
              icon={<VectorToShapeIcon size={15} />}
              label="Vector to Shape"
              onAction={({ altKey, shiftKey }) =>
                runToolAction(
                  `vector-to-shape-${altKey}-${shiftKey}`,
                  'Vector to Shape',
                  `Sequoia.convertVectorToShape(${altKey}, ${shiftKey})`,
                )
              }
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export function MainPage() {
  const editorRef = useRef<HTMLDivElement>(null)
  const presetsGridRef = useRef<HTMLDivElement>(null)
  const morePresetsButtonRef = useRef<HTMLButtonElement>(null)
  const wasPresetModalOpenRef = useRef(false)
  const [handles, setHandles] = useState<CurveHandles>(defaultHandles)
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false)
  const gridMetrics = usePresetGridMetrics(editorRef, presetsGridRef)

  const selectPreset = useCallback((preset: EasingPreset) => {
    setHandles(cloneCurveHandles(preset.handles))
  }, [])

  useEffect(() => {
    const wasOpen = wasPresetModalOpenRef.current
    wasPresetModalOpenRef.current = isPresetModalOpen

    if (!wasOpen || isPresetModalOpen) {
      return undefined
    }

    const animationFrame = window.requestAnimationFrame(() => {
      morePresetsButtonRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [isPresetModalOpen])

  return (
    <PageLayout>
      <div className="easing-workspace">
        <CurveEditor
          containerRef={editorRef}
          handles={handles}
          onHandlesChange={setHandles}
        />
        <EasingPresetsGrid
          buttonRef={morePresetsButtonRef}
          containerRef={presetsGridRef}
          metrics={gridMetrics}
          onOpenAll={() => setIsPresetModalOpen(true)}
          onSelect={selectPreset}
        />
      </div>
      <EasingTools />
      <EasingPresetsModal
        isOpen={isPresetModalOpen}
        onOpenChange={setIsPresetModalOpen}
        onSelect={selectPreset}
      />
    </PageLayout>
  )
}
