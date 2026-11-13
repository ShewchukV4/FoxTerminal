import { useEffect, useRef, useState } from 'react'
import { hub } from '../lib/hub'

export function Touchpad() {
  const padRef = useRef<HTMLDivElement>(null)
  const last = useRef<{ x: number; y: number; t: number } | null>(null)
  const dragging = useRef(false)
  const [sens, setSens] = useState(1.2)
  const [accel, setAccel] = useState(0.35)
  const [showKb, setShowKb] = useState(false)
  const [text, setText] = useState('')
  const moveQueue = useRef({ dx: 0, dy: 0 })
  const flushTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      void hub.releaseAll()
      if (flushTimer.current) cancelAnimationFrame(flushTimer.current)
    }
  }, [])

  function flushMoves() {
    flushTimer.current = null
    const { dx, dy } = moveQueue.current
    moveQueue.current = { dx: 0, dy: 0 }
    if (dx === 0 && dy === 0) return
    void hub.mouseMove(dx * sens, dy * sens).catch(() => undefined)
  }

  function queueMove(dx: number, dy: number) {
    const mag = Math.hypot(dx, dy)
    const factor = 1 + accel * mag
    moveQueue.current.dx += dx * factor
    moveQueue.current.dy += dy * factor
    if (flushTimer.current == null) {
      flushTimer.current = requestAnimationFrame(flushMoves)
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    last.current = { x: t.clientX, y: t.clientY, t: performance.now() }
    if (e.touches.length === 1 && dragging.current) {
      void hub.mouseButton(0, 0)
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (!last.current) return
    if (e.touches.length >= 2) {
      // two-finger scroll
      const a = e.touches[0]
      const dy = a.clientY - last.current.y
      const dx = a.clientX - last.current.x
      last.current = { x: a.clientX, y: a.clientY, t: performance.now() }
      void hub.mouseScroll(dx / 40, dy / 40).catch(() => undefined)
      return
    }
    const t = e.touches[0]
    const dx = t.clientX - last.current.x
    const dy = t.clientY - last.current.y
    last.current = { x: t.clientX, y: t.clientY, t: performance.now() }
    queueMove(dx, dy)
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length === 0) {
      const was = last.current
      last.current = null
      if (dragging.current) {
        void hub.mouseButton(0, 1)
        return
      }
      if (was && performance.now() - was.t < 180) {
        // tap = click if little movement already handled; short tap
        void hub.mouseButton(0, 2)
      }
    }
  }

  async function sendText() {
    if (!text) return
    await hub.keyboard({ text })
    setText('')
  }

  return (
    <div className="page">
      <div className="topbar">
        <h1>Touchpad</h1>
        <button className="btn secondary" onClick={() => setShowKb((v) => !v)}>
          {showKb ? 'Hide KB' : 'Keyboard'}
        </button>
      </div>
      <div className="touch-wrap">
        <div
          ref={padRef}
          className="touchpad"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => { last.current = null; void hub.releaseAll() }}
        />
        <div className="touch-actions">
          <button className="btn secondary" onClick={() => hub.mouseButton(0, 2)}>L Click</button>
          <button className="btn secondary" onClick={() => hub.mouseButton(1, 2)}>R Click</button>
          <button
            className="btn secondary"
            onClick={async () => {
              dragging.current = !dragging.current
              await hub.mouseButton(0, dragging.current ? 0 : 1)
            }}
          >
            {dragging.current ? 'Dragging…' : 'Hold L'}
          </button>
        </div>
        <div className="card">
          <div className="slider-row">
            <label className="muted">Sensitivity {sens.toFixed(2)}</label>
            <input type="range" min={0.3} max={3} step={0.05} value={sens} onChange={(e) => setSens(+e.target.value)} />
          </div>
          <div className="slider-row">
            <label className="muted">Acceleration {accel.toFixed(2)}</label>
            <input type="range" min={0} max={1.5} step={0.05} value={accel} onChange={(e) => setAccel(+e.target.value)} />
          </div>
        </div>
        {showKb && (
          <div className="card">
            <input
              className="input"
              placeholder="Текст…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void sendText()
                }
              }}
            />
            <div className="kb-row">
              <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Enter' })}>Enter</button>
              <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Backspace' })}>⌫</button>
              <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Escape' })}>Esc</button>
              <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Tab' })}>Tab</button>
            </div>
            <div className="kb-row">
              <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Copy' })}>Copy</button>
              <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Paste' })}>Paste</button>
              <button className="btn secondary" onClick={() => hub.keyboard({ key: 'Undo' })}>Undo</button>
              <button className="btn secondary" onClick={sendText}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
