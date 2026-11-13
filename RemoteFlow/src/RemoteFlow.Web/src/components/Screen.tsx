import { useEffect, useRef, useState } from 'react'
import { hub } from '../lib/hub'
import type { FramePacket, MonitorInfo } from '../types'

export function Screen() {
  const imgRef = useRef<HTMLImageElement>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monitors, setMonitors] = useState<MonitorInfo[]>([])
  const [monitor, setMonitor] = useState(0)
  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const dragging = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    void hub.getMonitors().then(setMonitors).catch(() => undefined)
    return () => {
      void hub.stopScreen().catch(() => undefined)
      void hub.releaseAll()
    }
  }, [])

  useEffect(() => {
    // Frame handler is registered at connect time in App; listen via custom event bridge
    const onFrame = (ev: Event) => {
      const packet = (ev as CustomEvent<FramePacket>).detail
      const url = `data:image/jpeg;base64,${packet.base64}`
      setFrameUrl((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return url
      })
    }
    window.addEventListener('rf-frame', onFrame as EventListener)
    return () => window.removeEventListener('rf-frame', onFrame as EventListener)
  }, [])

  async function start() {
    setError(null)
    try {
      const res = await hub.startScreen(monitor)
      if (!res.ok) {
        setError(res.error || 'Не вдалося почати трансляцію')
        return
      }
      setActive(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка')
    }
  }

  async function stop() {
    await hub.stopScreen()
    setActive(false)
    setFrameUrl(null)
  }

  function normFromEvent(clientX: number, clientY: number) {
    const el = imgRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const x = (clientX - r.left) / r.width
    const y = (clientY - r.top) / r.height
    if (x < 0 || y < 0 || x > 1 || y > 1) return null
    return { x, y }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!active) return
    const p = normFromEvent(e.clientX, e.clientY)
    if (!p) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
    lastPos.current = p
    void hub.mouseAbsolute(monitor, p.x, p.y)
    void hub.mouseButton(0, 0)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const p = normFromEvent(e.clientX, e.clientY)
    if (!p) return
    lastPos.current = p
    void hub.mouseAbsolute(monitor, p.x, p.y)
  }

  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    void hub.mouseButton(0, 1)
  }

  return (
    <div className="page">
      <div className="topbar">
        <h1>Screen</h1>
        <span className={`badge ${active ? 'on' : 'off'}`}>{active ? 'LIVE' : 'Off'}</span>
      </div>
      <div className="card">
        <p className="muted">
          Трансляція вимагає увімкненого «Allow screen sharing» на Windows Agent.
          Користувач ПК бачить індикатор ACTIVE у Dashboard.
        </p>
        <label className="muted">Монітор</label>
        <select
          className="input"
          value={monitor}
          onChange={async (e) => {
            const idx = Number(e.target.value)
            setMonitor(idx)
            if (active) await hub.selectMonitor(idx)
          }}
        >
          {monitors.length === 0 && <option value={0}>Primary</option>}
          {monitors.map((m) => (
            <option key={m.index} value={m.index}>
              {m.isPrimary ? 'Primary' : `Monitor ${m.index}`} · {m.width}×{m.height}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          {!active ? (
            <button className="btn block" onClick={start}>Start</button>
          ) : (
            <button className="btn danger block" onClick={stop}>Stop</button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="screen-stage">
        {frameUrl ? (
          <img
            ref={imgRef}
            src={frameUrl}
            alt="Remote desktop"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        ) : (
          <div style={{ padding: 40, textAlign: 'center' }} className="muted">
            Немає кадру
          </div>
        )}
      </div>
      {active && (
        <div className="card">
          <div className="kb-row">
            <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Win' })}>Win</button>
            <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Escape' })}>Esc</button>
            <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Alt+Tab' })}>Alt+Tab</button>
            <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Copy' })}>Copy</button>
            <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Paste' })}>Paste</button>
          </div>
        </div>
      )}
    </div>
  )
}
