import { useId, type ReactNode, type SVGProps } from 'react'

export type SvgIconProps = Omit<
  SVGProps<SVGSVGElement>,
  'children' | 'height' | 'title' | 'viewBox' | 'width'
> & {
  children: ReactNode
  size?: SVGProps<SVGSVGElement>['width']
  title?: string
  viewBox: string
}

export type IconProps = Omit<SvgIconProps, 'children' | 'viewBox'>

/**
 * Shared SVG shell for project icons.
 *
 * Icons without a title are decorative and hidden from assistive technology.
 * Add a title only when the icon itself conveys information.
 */
export function SvgIcon({
  children,
  ref,
  size = 16,
  title,
  viewBox,
  ...props
}: SvgIconProps) {
  const titleId = useId()
  const isDecorative = !title

  return (
    <svg
      ref={ref}
      aria-hidden={isDecorative ? true : undefined}
      aria-labelledby={isDecorative ? undefined : titleId}
      data-slot="icon"
      fill="currentColor"
      focusable="false"
      height={size}
      role={isDecorative ? undefined : 'img'}
      viewBox={viewBox}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      {children}
    </svg>
  )
}
