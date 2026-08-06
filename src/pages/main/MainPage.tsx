import { useCallback, useEffect, useRef, useState } from 'react'
import { PageLayout } from '../../shared/ui/page/PageLayout'
import { CurveEditor } from './CurveEditor'
import { EasingTools } from './EasingTools'
import { EasingPresetsGrid, EasingPresetsModal } from './PresetGrid'
import { usePresetGridMetrics } from './usePresetGridMetrics'
import {
  cloneCurveHandles,
  type CurveHandles,
  type EasingPreset,
} from './easingPresets'

const defaultHandles: CurveHandles = {
  end: { x: 0.1, y: 1 },
  start: { x: 0.9, y: 0 },
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

  // Closing the modal should hand focus back to the button that opened it.
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
