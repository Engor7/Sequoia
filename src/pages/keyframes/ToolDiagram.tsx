import { keyframeDiamondPath } from '../../shared/ui/icon'
import { keyframeDiagramScale } from './toolDiagrams'
import type {
  KeyframeDiagram,
  KeyframeDiagramArrow,
  KeyframeDiagramTone,
} from './toolDiagrams'

const playheadWidth = 4
const arrowHeadSize = 7

const toneClassName: Record<KeyframeDiagramTone, string> = {
  ghost: 'tool-diagram__key tool-diagram__key--ghost',
  outline: 'tool-diagram__key tool-diagram__key--outline',
  solid: 'tool-diagram__key',
}

function arrowHead(x: number, y: number, direction: 1 | -1) {
  const tail = x - direction * arrowHeadSize

  return `M ${tail} ${y - arrowHeadSize} L ${x} ${y} L ${tail} ${y + arrowHeadSize}`
}

function arrowPath({ from, head, to, y }: KeyframeDiagramArrow) {
  const direction = to >= from ? 1 : -1
  const segments = [`M ${from} ${y} L ${to} ${y}`]

  if (head === 'to' || head === 'both') {
    segments.push(arrowHead(to, y, direction))
  }

  if (head === 'both') {
    segments.push(arrowHead(from, y, direction === 1 ? -1 : 1))
  }

  return segments.join(' ')
}

/**
 * Draws the timeline sketch that explains a keyframe tool inside its tooltip.
 */
export function ToolDiagram({ diagram }: { diagram: KeyframeDiagram }) {
  return (
    <svg
      aria-hidden="true"
      className="tool-diagram"
      focusable="false"
      height={Math.round(diagram.height * keyframeDiagramScale)}
      viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      width={Math.round(diagram.width * keyframeDiagramScale)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {diagram.guide === undefined ? null : (
        <rect
          className="tool-diagram__guide"
          height={diagram.height}
          width={playheadWidth}
          x={diagram.guide - playheadWidth / 2}
          y={0}
        />
      )}

      {diagram.layerBar ? (
        <>
          <rect
            className="tool-diagram__layer-bar"
            height={4}
            width={diagram.layerBar.end - diagram.layerBar.start}
            x={diagram.layerBar.start}
            y={diagram.layerBar.y}
          />
          <rect
            className="tool-diagram__layer-marker"
            height={12}
            width={playheadWidth}
            x={diagram.layerBar.marker - playheadWidth / 2}
            y={diagram.layerBar.y - 4}
          />
        </>
      ) : null}

      {diagram.playhead === undefined ? null : (
        <rect
          className="tool-diagram__playhead"
          height={diagram.height}
          width={playheadWidth}
          x={diagram.playhead - playheadWidth / 2}
          y={0}
        />
      )}

      {(diagram.arrows ?? []).map((arrow, index) => (
        <path
          className="tool-diagram__arrow"
          d={arrowPath(arrow)}
          key={`arrow-${index}`}
        />
      ))}

      {diagram.keys.map((key, index) => (
        <path
          className={toneClassName[key.tone ?? 'solid']}
          d={keyframeDiamondPath}
          key={`key-${index}`}
          transform={`translate(${key.x} ${key.y})`}
        />
      ))}
    </svg>
  )
}
