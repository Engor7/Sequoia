export type CurvePoint = {
  x: number
  y: number
}

export type CurveHandles = {
  end: CurvePoint
  start: CurvePoint
}

export type EasingPreset = {
  handles: CurveHandles
  id: string
  label: string
}

function createPreset(
  id: string,
  label: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): EasingPreset {
  return {
    handles: {
      end: { x: x2, y: y2 },
      start: { x: x1, y: y1 },
    },
    id,
    label,
  }
}

export const easingPresets: EasingPreset[] = [
  createPreset('standard', 'Standard', 0.4, 0, 0.2, 1),
  createPreset('decelerate', 'Decelerate', 0, 0, 0.2, 1),
  createPreset('accelerate', 'Accelerate', 0.4, 0, 1, 1),
  createPreset('sharp', 'Sharp', 0.4, 0, 0.6, 1),
  createPreset('emphasized-out', 'Emphasized Out', 0.5, 0.7, 0.1, 1),
  createPreset('gentle-out', 'Gentle Out', 0.61, 1, 0.88, 1),
  createPreset('strong-out', 'Strong Out', 0.16, 1, 0.3, 1),
  createPreset('strong-in', 'Strong In', 0.7, 0, 0.84, 0),
  createPreset('strong-in-out', 'Strong In Out', 0.87, 0, 0.13, 1),
  createPreset('glide', 'Glide', 0.1, 0.9, 0.9, 0.1),
  createPreset('linear', 'Linear', 0, 0, 1, 1),
  createPreset('instant-start', 'Instant Start', 0, 1, 0, 1),
  createPreset('instant-finish', 'Instant Finish', 1, 0, 1, 0),
  createPreset('midpoint-snap', 'Midpoint Snap', 0.92, 0, 0.08, 1),
]

export function cloneCurveHandles(handles: CurveHandles): CurveHandles {
  return {
    end: { ...handles.end },
    start: { ...handles.start },
  }
}
