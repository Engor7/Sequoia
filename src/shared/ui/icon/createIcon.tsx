import type { ReactNode } from 'react'
import { SvgIcon, type IconProps } from './SvgIcon'

/**
 * Creates a consistently sized, color-inheriting icon component.
 */
export function createIcon(
  displayName: string,
  viewBox: string,
  artwork: ReactNode,
) {
  function Icon(props: IconProps) {
    return (
      <SvgIcon {...props} viewBox={viewBox}>
        {artwork}
      </SvgIcon>
    )
  }

  Icon.displayName = displayName

  return Icon
}
