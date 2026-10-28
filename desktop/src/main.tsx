import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyStoredTheme, subscribeThemeSync } from './theme'
import './styles.css'
import './themes.css'

applyStoredTheme()
subscribeThemeSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
