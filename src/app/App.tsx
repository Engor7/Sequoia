import { useEffect } from 'react'
import { HomePage } from '../pages/home/HomePage'

export function App() {
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    const reloadPanel = (event: KeyboardEvent) => {
      if (event.key === 'F5' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r')) {
        event.preventDefault()
        window.location.reload()
      }
    }

    window.addEventListener('keydown', reloadPanel)

    return () => window.removeEventListener('keydown', reloadPanel)
  }, [])

  return <HomePage />
}
