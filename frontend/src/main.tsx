import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthProvider'
import { ColorModeProvider } from './contexts/ColorModeProvider'
import { KmsProvider } from './contexts/KmsProvider'
import './index.css'

// A rolling deployment can replace lazy chunks while an older page is open.
// Reload once so the browser receives the new index and matching asset hashes.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorModeProvider>
      <BrowserRouter>
        <AuthProvider>
          <KmsProvider>
            <App />
          </KmsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ColorModeProvider>
  </StrictMode>,
)
