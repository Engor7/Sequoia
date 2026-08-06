import { Button } from '@heroui/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
  type SetStateAction,
} from 'react'
import { runHostCommand } from '../../shared/cep/host-command'
import {
  KeyframeCircleIcon,
  KeyframeDiamondIcon,
  KeyframeSquareIcon,
} from '../../shared/ui/icon'
import {
  clamp,
  curvePointToSvg,
  curvePositionToPreview,
  plotEnd,
  plotSize,
  plotStart,
  sampleCurveAtTime,
} from './curveMath'
import type { CurveHandles, CurvePoint } from './easingPresets'

type HandleName = keyof CurveHandles
type KeyframeConversionMode = 'autoBezier' | 'hold' | 'linear'

const keyframeConversionLabels: Record<KeyframeConversionMode, string> = {
  autoBezier: 'Auto Bezier Keyframes',
  hold: 'Hold Keyframes',
  linear: 'Linear Keyframes',
}

const previewFrameCount = 14
const gridLines = [60, 120, 180, 240] as const

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

type CurveEditorProps = {
  containerRef: Ref<HTMLDivElement>
  handles: CurveHandles
  onHandlesChange: Dispatch<SetStateAction<CurveHandles>>
}

export function CurveEditor({
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
