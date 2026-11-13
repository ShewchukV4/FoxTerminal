import { useMemo, useState } from 'react'
import { hub } from '../lib/hub'
import type { DeckState } from '../types'

const ICONS: Record<string, string> = {
  code: '💻', terminal: '⌨️', globe: '🌐', github: '🐙', folder: '📁',
  'volume-up': '🔊', 'volume-down': '🔉', 'volume-x': '🔇', lock: '🔒',
  message: '💬', game: '🎮', play: '⏯️', 'skip-forward': '⏭️', 'skip-back': '⏮️',
  youtube: '▶️', camera: '📷',
}

export function Deck({ deck, onDeck }: { deck: DeckState | null; onDeck: (d: DeckState) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)

  const profile = useMemo(() => {
    if (!deck) return null
    return deck.profiles.find((p) => p.id === deck.activeProfileId) || deck.profiles[0] || null
  }, [deck])

  const buttons = useMemo(() => {
    if (!profile) return []
    return profile.buttons
      .filter((b) => (folderId ? b.folderId === folderId : !b.folderId))
      .sort((a, b) => a.row - b.row || a.col - b.col)
  }, [profile, folderId])

  async function run(actionId: string) {
    if (!profile) return
    setBusy(actionId)
    setMsg(null)
    try {
      const res = await hub.executeAction(actionId, profile.id)
      if (!res.ok) setMsg(res.error || 'Помилка')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setBusy(null)
    }
  }

  async function switchProfile(id: string) {
    if (!deck) return
    const next = { ...deck, activeProfileId: id }
    onDeck(next)
    setFolderId(null)
    try { await hub.saveDeck(next) } catch { /* local ok */ }
  }

  if (!deck || !profile) {
    return <div className="page"><p className="muted">Завантаження колоди…</p></div>
  }

  return (
    <div className="page">
      <div className="topbar">
        <h1>Stream Deck</h1>
        <button className="btn secondary" onClick={() => hub.cancelMacro()}>Stop macro</button>
      </div>
      <div className="profiles">
        {deck.profiles.map((p) => (
          <button
            key={p.id}
            className={`chip ${p.id === profile.id ? 'active' : ''}`}
            onClick={() => switchProfile(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
      {folderId && (
        <button className="btn secondary" style={{ marginBottom: 12 }} onClick={() => setFolderId(null)}>
          ← Назад
        </button>
      )}
      {!folderId && profile.folders.length > 0 && (
        <div className="deck-grid" style={{ marginBottom: 12 }}>
          {profile.folders.map((f) => (
            <button
              key={f.id}
              className="deck-btn"
              style={{ background: f.color }}
              onClick={() => setFolderId(f.id)}
            >
              <span className="ico">📂</span>
              {f.name}
            </button>
          ))}
        </div>
      )}
      <div className="deck-grid">
        {buttons.map((b) => (
          <button
            key={b.id}
            className="deck-btn"
            style={{ background: b.color, opacity: busy === b.actionId ? 0.7 : 1 }}
            disabled={!!busy}
            onClick={() => run(b.actionId)}
          >
            <span className="ico">{ICONS[b.icon || ''] || '✦'}</span>
            {b.label}
          </button>
        ))}
      </div>
      {msg && <p className="error">{msg}</p>}
    </div>
  )
}
