import type { ComponentType } from 'react'
import { useState } from 'react'
import { ExpressionsPage } from '../expressions/ExpressionsPage'
import { FunctionsPage } from '../functions/FunctionsPage'
import { GridAnimatePage } from '../grid-animate/GridAnimatePage'
import { KeyframesPage } from '../keyframes/KeyframesPage'
import { LogsPage } from '../logs/LogsPage'
import { MainPage } from '../main/MainPage'
import { SafeZonePage } from '../safe-zone/SafeZonePage'
import { SubtitlePage } from '../subtitle/SubtitlePage'
import { TextPage } from '../text/TextPage'
import { TransformPage } from '../transform/TransformPage'
import { PageNavigation } from '../../widgets/page-navigation/PageNavigation'
import type { PageId } from '../../widgets/page-navigation/pageItems'

const pages: Record<PageId, ComponentType> = {
  expressions: ExpressionsPage,
  functions: FunctionsPage,
  'grid-animate': GridAnimatePage,
  keyframes: KeyframesPage,
  logs: LogsPage,
  main: MainPage,
  'safe-zone': SafeZonePage,
  subtitle: SubtitlePage,
  text: TextPage,
  transform: TransformPage,
}

export function HomePage() {
  const [activePage, setActivePage] = useState<PageId>('main')
  const ActivePage = pages[activePage]

  return (
    <main className="app-shell">
      <header className="app-header">
        <PageNavigation
          activePage={activePage}
          onPageChange={setActivePage}
        />
      </header>
      <section
        className="page-content"
        data-page={activePage}
      >
        <ActivePage />
      </section>
    </main>
  )
}
