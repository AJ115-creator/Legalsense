import './instrument'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { ThemeProvider } from './context/ThemeContext'
import { UploadProvider } from './context/UploadContext'
import App from './App'
import './index.css'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider afterSignOutUrl="/">
      <ThemeProvider>
        <UploadProvider>
          <App />
        </UploadProvider>
      </ThemeProvider>
    </ClerkProvider>
  </StrictMode>
)
