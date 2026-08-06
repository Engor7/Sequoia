import type { CurveHandles, CurvePoint } from './easingPresets'

/** SVG viewBox is 300 square; the plot inset leaves room for the anchors. */
export const plotStart = 15
export const plotEnd = 285
export const plotSize = plotEnd - plotStart

export function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function cubicCoordinate(
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

export function sampleCurveAtTime(handles: CurveHandles, time: number) {
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

export function curvePointToSvg(point: CurvePoint) {
  return {
    x: plotStart + point.x * plotSize,
    y: plotEnd - point.y * plotSize,
  }
}

export function curvePositionToPreview(position: number) {
  return `${clamp(position) * 100}%`
}
