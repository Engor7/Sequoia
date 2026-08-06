import type { ComponentType } from 'react'
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
  MergeShapesIcon,
  NullControllerIcon,
  OvershootIcon,
  PathNullsIcon,
  SpinIcon,
  VectorToShapeIcon,
  WigglePropertyIcon,
  type IconProps,
} from '../../shared/ui/icon'
import type { MotionEffectId } from '../../shared/cep/motion-effects'

export type MotionEffectControl = {
  description: string
  label: string
}

/**
 * A pseudo-effect the panel can apply to the selection and remove again.
 *
 * `controls` mirrors the child properties of the bundled `.ffx`, so the
 * tooltip explains the same names the user sees in Effect Controls.
 */
export type MotionEffectTool = {
  applyLabel: string
  applyScript: string
  controls: MotionEffectControl[]
  description: string
  Icon: ComponentType<IconProps>
  iconSize: number
  id: MotionEffectId
  /** Effect name as it appears in After Effects, used in log entries. */
  name: string
  removeScript: string
  title: string
}

export const motionEffectTools: MotionEffectTool[] = [
  {
    applyLabel: 'Применить Wiggle Property',
    applyScript: 'Sequoia.applyWiggle()',
    controls: [
      { description: 'Скорость случайного движения.', label: 'Frequency' },
      { description: 'Общая сила движения.', label: 'Amount' },
      {
        description: 'Отдельный контроль силы по X, Y и Z.',
        label: 'Individual Axis',
      },
      { description: 'Двигает все оси вместе.', label: 'Lock Dimensions' },
      { description: 'Создаёт другой случайный рисунок.', label: 'Random Seed' },
      { description: 'Делает движение ступенчатым.', label: 'Frame Rate' },
    ],
    description: 'Добавляет случайное движение выбранным свойствам.',
    Icon: WigglePropertyIcon,
    iconSize: 16,
    id: 'wiggle',
    name: 'Wiggle',
    removeScript: 'Sequoia.removeSelectedWiggle()',
    title: 'Wiggle Property',
  },
  {
    applyLabel: 'Применить Bounce-анимацию',
    applyScript: 'Sequoia.applyBounce()',
    controls: [
      {
        description: 'Высота первого отскока в % от движения; 0 — выкл.',
        label: 'Amount',
      },
      { description: 'Длительность отскоков в секундах.', label: 'Duration' },
      {
        description: 'Чем выше, тем больше мелких отскоков.',
        label: 'Elasticity',
      },
    ],
    description:
      'Затухающий отскок после последнего ключа без пересечения конечной точки.',
    Icon: BounceIcon,
    iconSize: 15,
    id: 'bounce',
    name: 'Bounce',
    removeScript: 'Sequoia.removeSelectedBounce()',
    title: 'Bounce-анимация',
  },
  {
    applyLabel: 'Применить Overshoot-анимацию',
    applyScript: 'Sequoia.applyOvershoot()',
    controls: [
      {
        description:
          'Размер первого перелёта в % от последнего движения; 0 — выкл.',
        label: 'Amount',
      },
      { description: 'Длительность затухания в секундах.', label: 'Duration' },
      { description: 'Чем выше, тем больше колебаний.', label: 'Elasticity' },
    ],
    description:
      'Затухающая инерция после последнего ключа с пересечением конечной точки.',
    Icon: OvershootIcon,
    iconSize: 15,
    id: 'overshoot',
    name: 'Overshoot',
    removeScript: 'Sequoia.removeSelectedOvershoot()',
    title: 'Overshoot-анимация',
  },
  {
    applyLabel: 'Применить Spin Animation',
    applyScript: 'Sequoia.applySpin()',
    controls: [
      { description: 'Меняет направление вращения.', label: 'Reverse' },
      { description: 'Скорость вращения в градусах в секунду.', label: 'Speed' },
      { description: 'Делает вращение ступенчатым.', label: 'Frame Rate' },
      { description: 'Сдвигает стартовый угол.', label: 'Offset' },
    ],
    description: 'Добавляет постоянное вращение выбранным rotation-свойствам.',
    Icon: SpinIcon,
    iconSize: 14,
    id: 'spin',
    name: 'Spin',
    removeScript: 'Sequoia.removeSelectedSpin()',
    title: 'Spin Animation',
  },
  {
    applyLabel: 'Применить Blinker / Flicker',
    applyScript: 'Sequoia.applyBlinker()',
    controls: [
      { description: 'Скорость мерцания.', label: 'Speed' },
      {
        description: 'Включает жёсткое переключение вкл/выкл.',
        label: 'Enable Fixed',
      },
      { description: 'Добавляет неровный тайминг.', label: 'Random Timing' },
      {
        description: 'Задаёт диапазон прозрачности.',
        label: 'Max/Min Opacity',
      },
    ],
    description: 'Добавляет мерцание прозрачности.',
    Icon: BlinkerIcon,
    iconSize: 16,
    id: 'blinker',
    name: 'Blinker / Flicker',
    removeScript: 'Sequoia.removeSelectedBlinker()',
    title: 'Blinker / Flicker',
  },
  {
    applyLabel: 'Применить Fader',
    applyScript: 'Sequoia.applyFader()',
    controls: [
      { description: 'Длительность fade в кадрах.', label: 'Animation' },
      {
        description: 'Использует прямой fade вместо плавного.',
        label: 'Linear',
      },
    ],
    description: 'Добавляет автоматический fade прозрачности.',
    Icon: FaderIcon,
    iconSize: 14,
    id: 'fader',
    name: 'Fader',
    removeScript: 'Sequoia.removeSelectedFader()',
    title: 'Fader',
  },
]

export type EasingToolModifiers = {
  altKey: boolean
  shiftKey: boolean
}

/** A one-shot action on the selection, with modifiers picking the variant. */
export type HostTool = {
  buildScript: (modifiers: EasingToolModifiers) => string
  description: string
  Icon: ComponentType<IconProps>
  iconSize: number
  id: string
  label: string
}

export const layerTransformTools: HostTool[] = [
  {
    buildScript: () => 'Sequoia.flipSelectedLayers("horizontal")',
    description: 'Отражает выбранные слои по горизонтали.',
    Icon: FlipHorizontalIcon,
    iconSize: 14,
    id: 'flip-horizontal',
    label: 'Flip Horizontal',
  },
  {
    buildScript: () => 'Sequoia.flipSelectedLayers("vertical")',
    description: 'Отражает выбранные слои по вертикали.',
    Icon: FlipVerticalIcon,
    iconSize: 14,
    id: 'flip-vertical',
    label: 'Flip Vertical',
  },
  {
    buildScript: () => 'Sequoia.fitSelectedLayers("width")',
    description:
      'Масштабирует выбранные слои по ширине композиции с сохранением пропорций.',
    Icon: FitCompWidthIcon,
    iconSize: 15,
    id: 'fit-width',
    label: 'Fit to Comp Width',
  },
  {
    buildScript: () => 'Sequoia.fitSelectedLayers("height")',
    description:
      'Масштабирует выбранные слои по высоте композиции с сохранением пропорций.',
    Icon: FitCompHeightIcon,
    iconSize: 15,
    id: 'fit-height',
    label: 'Fit to Comp Height',
  },
]

export const shapeAndControllerTools: HostTool[] = [
  {
    buildScript: ({ altKey }) => `Sequoia.explodeExtractShapes(${altKey})`,
    description:
      'Клик разбивает shape-группы на отдельные слои. Alt-клик конвертирует исходный слой или извлекает выбранные фигуры.',
    Icon: ExplodeExtractShapesIcon,
    iconSize: 15,
    id: 'explode-extract',
    label: 'Explode / Extract Shapes',
  },
  {
    buildScript: ({ altKey }) => `Sequoia.mergeShapes(${altKey})`,
    description:
      'Клик объединяет выбранные слои или shape-группы в один Shape Layer. Alt-клик объединяет выбранные Shape Layers.',
    Icon: MergeShapesIcon,
    iconSize: 15,
    id: 'merge-shapes',
    label: 'Merge Shapes',
  },
  {
    buildScript: ({ altKey, shiftKey }) =>
      `Sequoia.createNullControllers(${altKey}, ${shiftKey})`,
    description:
      'Клик создаёт один Null в центре выделения. Alt-клик создаёт стандартный Null. Shift-клик создаёт отдельный Null для каждого слоя.',
    Icon: NullControllerIcon,
    iconSize: 15,
    id: 'null-controller',
    label: 'Null Controller',
  },
  {
    buildScript: ({ altKey }) => `Sequoia.linkPathNulls(${altKey})`,
    description:
      'Клик заставляет Null следовать точкам выбранного Path. Alt-клик заставляет точки Path следовать созданным Null.',
    Icon: PathNullsIcon,
    iconSize: 14,
    id: 'path-nulls',
    label: 'Path Nulls',
  },
  {
    buildScript: () => 'Sequoia.createColorControls()',
    description:
      'Собирает уникальные цвета выделенных слоёв в один слой-палитру и связывает совпадающие цветовые свойства.',
    Icon: ColorControlsIcon,
    iconSize: 14,
    id: 'color-controls',
    label: 'Color Controls',
  },
  {
    buildScript: ({ altKey, shiftKey }) =>
      `Sequoia.convertVectorToShape(${altKey}, ${shiftKey})`,
    description:
      'Клик создаёт Shape Layer из выбранных векторных слоёв. Alt-клик удаляет исходники. Shift-клик дополнительно чистит группы артбордов Illustrator.',
    Icon: VectorToShapeIcon,
    iconSize: 15,
    id: 'vector-to-shape',
    label: 'Vector to Shape',
  },
]

export type AnchorPointPosition = {
  horizontal: 0 | 0.5 | 1
  id: string
  label: string
  vertical: 0 | 0.5 | 1
}

export const anchorPointPositions: AnchorPointPosition[] = [
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
