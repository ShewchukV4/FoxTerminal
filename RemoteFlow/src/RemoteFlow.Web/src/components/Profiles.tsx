import type { DeckState } from '../types'
import { hub } from '../lib/hub'

export function Profiles({ deck, onDeck }: { deck: DeckState | null; onDeck: (d: DeckState) => void }) {
  if (!deck) return <div className="page"><p className="muted">Немає профілів</p></div>
  const current = deck

  async function activate(id: string) {
    const next: DeckState = { ...current, activeProfileId: id }
    onDeck(next)
    await hub.saveDeck(next)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'remoteflow-deck.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importJson(file: File) {
    const text = await file.text()
    const parsed = JSON.parse(text) as DeckState
    if (!parsed.profiles?.length) throw new Error('Invalid deck file')
    onDeck(parsed)
    await hub.saveDeck(parsed)
  }

  return (
    <div className="page">
      <div className="topbar">
        <h1>Profiles</h1>
      </div>
      {deck.profiles.map((p) => (
        <div className="card" key={p.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <strong>{p.name}</strong>
              <div className="muted">{p.buttons.length} кнопок · {p.actions.length} дій</div>
            </div>
            <button
              className={`btn ${deck.activeProfileId === p.id ? '' : 'secondary'}`}
              onClick={() => activate(p.id)}
            >
              {deck.activeProfileId === p.id ? 'Активний' : 'Обрати'}
            </button>
          </div>
        </div>
      ))}
      <div className="card">
        <button className="btn secondary block" onClick={exportJson} style={{ marginBottom: 10 }}>
          Експорт JSON
        </button>
        <label className="btn secondary block" style={{ display: 'block', textAlign: 'center' }}>
          Імпорт JSON
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importJson(f).catch((err) => alert(err.message))
            }}
          />
        </label>
      </div>
    </div>
  )
}
