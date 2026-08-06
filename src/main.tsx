import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { installGlobalErrorLogging } from './shared/logging/error-log'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/cyrillic-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/cyrillic-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/cyrillic-600.css'
import './app/styles/globals.css'
import './app/styles/custom.scss'

installGlobalErrorLogging()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
