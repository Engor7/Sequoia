/**
 * Timeline sketches that explain what a keyframe tool does.
 *
 * Coordinates use the same scale as the keyframe diamond: one keyframe is 20
 * units wide, so every diagram reads like a zoomed-in slice of the timeline.
 */

export type KeyframeDiagramTone = 'ghost' | 'outline' | 'solid'

export type KeyframeDiagramKey = {
  /** `ghost` marks the state before the tool ran, `outline` marks removed keys. */
  tone?: KeyframeDiagramTone
  x: number
  y: number
}

export type KeyframeDiagramArrow = {
  from: number
  /** `to` points at the target only, `both` measures a span. */
  head: 'both' | 'none' | 'to'
  to: number
  y: number
}

export type KeyframeDiagramLayerBar = {
  end: number
  /** Time of the layer edge the keys are aligned to. */
  marker: number
  start: number
  y: number
}

export type KeyframeDiagram = {
  arrows?: KeyframeDiagramArrow[]
  /** Muted frame line the keys snap to. */
  guide?: number
  height: number
  keys: KeyframeDiagramKey[]
  layerBar?: KeyframeDiagramLayerBar
  /** Time cursor position. */
  playhead?: number
  width: number
}

export type KeyframeDiagramId =
  | 'alignFirstKey'
  | 'alignInPoint'
  | 'alignLastKey'
  | 'alignOutPoint'
  | 'constantSpeed'
  | 'duplicate'
  | 'duplicateFlip'
  | 'interval'
  | 'intervalClean'
  | 'snapFrame'
  | 'stretchCTI'
  | 'stretchFirstKey'
  | 'stretchLastKey'

export const keyframeDiagrams: Record<KeyframeDiagramId, KeyframeDiagram> = {
  alignFirstKey: {
    height: 59,
    keys: [
      { x: 10, y: 15 },
      { x: 10, y: 45 },
      { x: 40, y: 45 },
    ],
    playhead: 10,
    width: 50,
  },
  alignInPoint: {
    height: 67,
    keys: [
      { x: 10, y: 27 },
      { x: 10, y: 57 },
      { x: 40, y: 57 },
    ],
    layerBar: { end: 94, marker: 10, start: 10, y: 4 },
    width: 94,
  },
  alignLastKey: {
    height: 59,
    keys: [
      { x: 10, y: 15 },
      { x: 10, y: 45 },
      { x: 40, y: 45 },
    ],
    playhead: 40,
    width: 50,
  },
  alignOutPoint: {
    height: 67,
    keys: [
      { x: 53, y: 27 },
      { x: 53, y: 57 },
      { x: 83, y: 57 },
    ],
    layerBar: { end: 83, marker: 83, start: 0, y: 4 },
    width: 93,
  },
  constantSpeed: {
    arrows: [{ from: 53, head: 'none', to: 100, y: 29 }],
    height: 62,
    keys: [
      { tone: 'ghost', x: 23, y: 53 },
      { x: 46, y: 29 },
      { x: 107, y: 29 },
    ],
    width: 153,
  },
  duplicate: {
    height: 59,
    keys: [
      { tone: 'ghost', x: 10, y: 15 },
      { tone: 'ghost', x: 10, y: 45 },
      { tone: 'ghost', x: 40, y: 45 },
      { x: 70, y: 15 },
      { x: 70, y: 45 },
      { x: 101, y: 45 },
    ],
    playhead: 70,
    width: 111,
  },
  duplicateFlip: {
    height: 59,
    keys: [
      { tone: 'ghost', x: 10, y: 15 },
      { tone: 'ghost', x: 10, y: 45 },
      { tone: 'ghost', x: 40, y: 45 },
      { x: 70, y: 45 },
      { x: 101, y: 15 },
      { x: 101, y: 45 },
    ],
    playhead: 70,
    width: 111,
  },
  interval: {
    arrows: [{ from: 25, head: 'both', to: 78, y: 10 }],
    height: 21,
    keys: [
      { x: 10, y: 10 },
      { x: 93, y: 10 },
    ],
    width: 104,
  },
  intervalClean: {
    height: 62,
    keys: [
      { x: 16, y: 31 },
      { tone: 'outline', x: 56, y: 10 },
      { tone: 'outline', x: 56, y: 52 },
      { tone: 'outline', x: 97, y: 10 },
      { tone: 'outline', x: 97, y: 52 },
      { x: 137, y: 31 },
    ],
    width: 153,
  },
  snapFrame: {
    arrows: [
      { from: 20, head: 'to', to: 56, y: 30 },
      { from: 133, head: 'to', to: 98, y: 30 },
    ],
    guide: 77,
    height: 60,
    keys: [{ x: 77, y: 30 }],
    width: 153,
  },
  stretchCTI: {
    arrows: [{ from: 6, head: 'both', to: 147, y: 44 }],
    height: 60,
    keys: [
      { x: 20, y: 18 },
      { x: 50, y: 18 },
      { x: 130, y: 18 },
    ],
    playhead: 75,
    width: 153,
  },
  stretchFirstKey: {
    arrows: [{ from: 10, head: 'to', to: 140, y: 34 }],
    height: 44,
    keys: [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 100, y: 10 },
    ],
    width: 146,
  },
  stretchLastKey: {
    arrows: [{ from: 132, head: 'to', to: 8, y: 34 }],
    height: 44,
    keys: [
      { x: 42, y: 10 },
      { x: 72, y: 10 },
      { x: 132, y: 10 },
    ],
    width: 142,
  },
}

const availableWidth = 226
const availableHeight = 72

/**
 * One scale for every diagram, so a keyframe is always drawn at the same size
 * no matter how wide the sketch around it is.
 */
export const keyframeDiagramScale = Object.values(keyframeDiagrams).reduce(
  (scale, diagram) =>
    Math.min(
      scale,
      availableWidth / diagram.width,
      availableHeight / diagram.height,
    ),
  Number.POSITIVE_INFINITY,
)
