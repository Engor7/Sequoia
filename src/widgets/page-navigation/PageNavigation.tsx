import { Button, Tooltip } from '@heroui/react'
import { pageItems, type PageId } from './pageItems'

/** Clear of the trigger. HeroUI's own no-arrow default of 3px sits too close. */
const tooltipOffset = 10

type PageNavigationProps = {
  activePage: PageId
  onPageChange: (page: PageId) => void
}

export function PageNavigation({
  activePage,
  onPageChange,
}: PageNavigationProps) {
  return (
    <nav aria-label="Pages" className="page-navigation">
      {pageItems.map(({ id, label, Icon, opticalScale }) => {
        const isActive = id === activePage

        return (
          <Tooltip closeDelay={120} delay={1200} key={id}>
            <Button
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className="page-navigation__item page-navigation__button"
              isIconOnly
              onMouseUp={(event) => {
                // CEP may expose PointerEvent while only emitting legacy mouse events.
                if (event.button === 0) {
                  onPageChange(id)
                }
              }}
              onPress={() => onPageChange(id)}
              size="sm"
              type="button"
              variant={isActive ? 'secondary' : 'ghost'}
            >
              <Icon
                className="page-navigation__icon"
                style={{ transform: `scale(${opticalScale})` }}
              />
            </Button>
            <Tooltip.Content
              className="page-navigation__tooltip"
              offset={tooltipOffset}
              placement="bottom"
            >
              {label}
            </Tooltip.Content>
          </Tooltip>
        )
      })}
    </nav>
  )
}
