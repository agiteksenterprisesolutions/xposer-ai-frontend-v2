import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
// Arabic interface font, served from our own origin: no page loads anything
// from a third party (reporter privacy; "Before you report", XPAI-114).
// unicode-range subsets mean a browser only downloads it for Arabic text.
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <App />
  // </StrictMode>,
)