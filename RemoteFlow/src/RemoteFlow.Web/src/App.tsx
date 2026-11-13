import { useCallback, useEffect, useState } from 'react'
import { Deck } from './components/Deck'
import { Pairing } from './components/Pairing'
import { Profiles } from './components/Profiles'
import { Screen } from './components/Screen'
import { SettingsView } from './components/SettingsView'
import { Touchpad } from './components/Touchpad'
import { connectHub, disconnectHub, hub } from './lib/hub'
import { clearCredentials, getCredentials } from './lib/session'
import type { DeckState, FramePacket, ServerStatus, TabId } from './types'

export default function App() {
  const [paired, setPaired] = useState(() => {
    const c = getCredentials()
    return !!(c.deviceId && c.deviceToken)
  })
  const [connected, setConnected] = useState(false)
  const [tab, setTab] = useState<TabId>('deck')
  const [deck, setDeck] = useState<DeckState | null>(null)
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [booting, setBooting] = useState(false)

  const resetPairing = useCallback(() => {
    clearCredentials()
    setPaired(false)
    setConnected(false)
    setDeck(null)
    setStatus(null)
    setError(null)
  }, [])

  const boot = useCallback(async () => {
    setError(null)
    setBooting(true)
    try {
      await connectHub((frame: FramePacket) => {
        window.dispatchEvent(new CustomEvent('rf-frame', { detail: frame }))
      })
      setConnected(true)
      const [d, s] = await Promise.all([hub.getDeck(), hub.getStatus()])
      setDeck(d)
      setStatus(s)
    } catch (e) {
      setConnected(false)
      const text = e instanceof Error ? e.message : 'Connection failed'
      // Show error — do NOT auto-reset (that spammed new pairing codes).
      setError(text)
    } finally {
      setBooting(false)
    }
  }, [resetPairing])

  useEffect(() => {
    if (!paired) return
    void boot()
    return () => {
      void disconnectHub()
    }
  }, [paired, boot])

  if (!paired) {
    return (
      <div className="app">
        <Pairing onPaired={() => setPaired(true)} />
      </div>
    )
  }

  if (booting && !connected && !error) {
    return (
      <div className="app">
        <div className="page">
          <div className="card">
            <h1>RemoteFlow</h1>
            <p className="muted waiting">З’єднання з ПК через LongPolling…</p>
            <p className="muted">Залиште цю вкладку відкритою 2–3 секунди.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {error && (
        <div className="page">
          <div className="card">
            <p className="error">{error}</p>
            <p className="muted">
              Переконайтесь, що телефон у Wi‑Fi <b>RemoteFlow</b> (пароль 12345678) і VPN вимкнений.
            </p>
            <button className="btn block" onClick={() => void boot()}>Повторити</button>
            <button className="btn secondary block" style={{ marginTop: 8 }} onClick={resetPairing}>
              Підключитись заново
            </button>
          </div>
        </div>
      )}
      {!error && tab === 'deck' && <Deck deck={deck} onDeck={setDeck} />}
      {!error && tab === 'touchpad' && <Touchpad />}
      {!error && tab === 'screen' && <Screen />}
      {!error && tab === 'profiles' && <Profiles deck={deck} onDeck={setDeck} />}
      {!error && tab === 'settings' && (
        <SettingsView
          status={status}
          onUnpair={() => {
            void disconnectHub()
            resetPairing()
          }}
        />
      )}
      <nav className="nav">
        {(
          [
            ['deck', '🎛️', 'Deck'],
            ['touchpad', '🖱️', 'Pad'],
            ['screen', '🖥️', 'Screen'],
            ['profiles', '📁', 'Profiles'],
            ['settings', '⚙️', 'Settings'],
          ] as const
        ).map(([id, ico, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <span className="ico">{ico}</span>
            {label}
          </button>
        ))}
      </nav>
      <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 50 }}>
        <span className={`badge ${connected ? 'on' : 'off'}`}>{connected ? 'Online' : 'Offline'}</span>
      </div>
    </div>
  )
}
