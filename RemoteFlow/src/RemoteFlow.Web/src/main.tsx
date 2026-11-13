import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Drop stale service workers that can serve broken old JS on iPhone.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) void r.unregister()
  })
  if ('caches' in window) {
    void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  }
}

createRoot(document.getElementById('root')!).render(<App />)
