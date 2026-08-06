import { useLayoutEffect, useState, type RefObject } from 'react'
import { easingPresets } from './easingPresets'

export type PresetGridMetrics = {
  capacity: number
  columns: number
  height: number
  rows: number
}

const presetGridGap = 6
const presetGridMinimumCellWidth = 42
const presetGridMinimumCellHeight = 36

/**
 * Chooses how many preset cards fit beside or under the curve editor, picking
 * the layout that holds the most cards and then the one closest to a 1.25
 * aspect ratio.
 */
export function usePresetGridMetrics(
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
