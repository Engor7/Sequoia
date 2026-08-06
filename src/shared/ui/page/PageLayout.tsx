import { Heading } from '@heroui/react'
import type { ReactNode } from 'react'

type PageLayoutProps = {
  children?: ReactNode
  title?: string
}

export function PageLayout({ children, title }: PageLayoutProps) {
  return (
    <div className="tool-page">
      {title ? (
        <Heading className="tool-page__title" level={1}>
          {title}
        </Heading>
      ) : null}
      {children ? (
        <div
          className={
            title
              ? 'tool-page__content'
              : 'tool-page__content tool-page__content--flush'
          }
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
