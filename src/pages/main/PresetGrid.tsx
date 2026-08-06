import { Button, Modal } from '@heroui/react'
import { useMemo, type CSSProperties, type Ref } from 'react'
import { sampleCurveAtTime } from './curveMath'
import { easingPresets, type CurveHandles, type EasingPreset } from './easingPresets'

import type { PresetGridMetrics } from './usePresetGridMetrics'

const thumbnailSampleCount = 36

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

type EasingPresetsGridProps = {
  buttonRef: Ref<HTMLButtonElement>
  containerRef: Ref<HTMLDivElement>
  metrics: PresetGridMetrics
  onOpenAll: () => void
  onSelect: (preset: EasingPreset) => void
}

export function EasingPresetsGrid({
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

export function EasingPresetsModal({
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
