import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonte de interface (Plus Jakarta Sans, OFL, auto-hospedada). O @font-face de
// Gilroy em index.css tem prioridade: se você tiver uma licença e colocar os
// .woff2 em public/fonts/, ela assume sozinha.
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
