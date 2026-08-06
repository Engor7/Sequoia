import type { ComponentType } from 'react'
import {
  EasingIcon,
  ExpressionsIcon,
  FunctionsIcon,
  GridAnimateIcon,
  KeyframesIcon,
  LogsIcon,
  SafeZoneIcon,
  SubtitleIcon,
  TextIcon,
  TransformIcon,
  type IconProps,
} from '../../shared/ui/icon'

export const pageItems = [
  { id: 'main', label: 'Main', Icon: EasingIcon, opticalScale: 0.95 },
  {
    id: 'keyframes',
    label: 'Keyframes',
    Icon: KeyframesIcon,
    opticalScale: 1.05,
  },
  { id: 'text', label: 'Text', Icon: TextIcon, opticalScale: 0.95 },
  {
    id: 'transform',
    label: 'Transform',
    Icon: TransformIcon,
    opticalScale: 1.05,
  },
  {
    id: 'expressions',
    label: 'Expressions',
    Icon: ExpressionsIcon,
    opticalScale: 1.1,
  },
  {
    id: 'functions',
    label: 'Functions',
    Icon: FunctionsIcon,
    opticalScale: 1,
  },
  {
    id: 'safe-zone',
    label: 'Safe Zone',
    Icon: SafeZoneIcon,
    opticalScale: 1,
  },
  {
    id: 'grid-animate',
    label: 'Grid Animate',
    Icon: GridAnimateIcon,
    opticalScale: 1,
  },
  {
    id: 'subtitle',
    label: 'Subtitle',
    Icon: SubtitleIcon,
    opticalScale: 0.95,
  },
  { id: 'logs', label: 'Logs', Icon: LogsIcon, opticalScale: 1 },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  Icon: ComponentType<IconProps>
  opticalScale: number
}>

export type PageId = (typeof pageItems)[number]['id']
