import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes self-hosteadas vía @fontsource (reemplaza el link a Google Fonts
// de index.html): Inter para cuerpo, Sora para títulos (font-heading en
// tailwind.config.js). Mismos pesos que se usaban de DM Sans/Syne.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/sora/600.css'
import '@fontsource/sora/700.css'
import '@fontsource/sora/800.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
