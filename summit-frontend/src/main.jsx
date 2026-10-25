import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Antes que nada: escucha el aviso de Chrome de que la app se puede instalar (ver instalacion.js)
import './instalacion'
import App from './App.jsx'
import { avisarSalidaPendiente } from './services/auth'

// Si se cerró sesión sin conexión, se le avisa al servidor apenas haya internet (ver services/auth.js)
avisarSalidaPendiente()
window.addEventListener('online', avisarSalidaPendiente)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
