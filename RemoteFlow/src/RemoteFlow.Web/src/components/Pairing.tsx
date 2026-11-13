import { useCallback, useEffect, useRef, useState } from 'react'
import { completePairing, requestPairing } from '../lib/api'
import { saveCredentials } from '../lib/session'

export function Pairing({ onPaired }: { onPaired: () => void }) {
  const [name, setName] = useState('iPhone')
  const [code, setCode] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [status, setStatus] = useState('Готовий до підключення')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const startedRef = useRef(false)
  const doneRef = useRef(false)

  const finish = useCallback((deviceId: string, deviceToken: string) => {
    if (doneRef.current) return
    doneRef.current = true
    saveCredentials(deviceId, deviceToken, name)
    setStatus('Підключено — відкриваю панель…')
    onPaired()
  }, [name, onPaired])

  const pollOnce = useCallback(async (id: string) => {
    const res = await completePairing(id)
    if (res.status === 'approved' && res.deviceId && res.deviceToken) {
      finish(res.deviceId, res.deviceToken)
      return true
    }
    if (res.status === 'rejected') {
      setError('Запит відхилено на Windows')
      setBusy(false)
      setRequestId(null)
      startedRef.current = false
      return true
    }
    if (res.status === 'expired' || res.status === 'approved_consumed') {
      setError('Код застарів — натисніть кнопку ще раз')
      setBusy(false)
      setRequestId(null)
      startedRef.current = false
      return true
    }
    setStatus('Натисніть Approve у RemoteFlow на ноутбуці…')
    return false
  }, [finish])

  useEffect(() => {
    if (!requestId) return
    let stop = false
    const tick = async () => {
      if (stop || doneRef.current) return
      try {
        await pollOnce(requestId)
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : 'Помилка')
      }
    }
    void tick()
    const timer = window.setInterval(() => { void tick() }, 800)
    const onVis = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [requestId, pollOnce])

  async function start() {
    if (busy || startedRef.current) return
    startedRef.current = true
    doneRef.current = false
    setError(null)
    setBusy(true)
    try {
      // Drop stale SW that used to swallow /connect.html and stale API answers.
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      const res = await requestPairing(name.trim() || 'iPhone')
      setCode(res.pairingCode)
      setRequestId(res.requestId)
      setStatus('Натисніть Approve у RemoteFlow на ноутбуці…')
      const url = new URL(window.location.href)
      if (url.searchParams.has('pair') || url.searchParams.has('autopair')) {
        url.search = ''
        window.history.replaceState({}, '', url.pathname)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося надіслати запит')
      setBusy(false)
      startedRef.current = false
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('pair') === '1' || q.get('autopair') === '1') {
      void start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page">
      <div className="topbar">
        <h1>RemoteFlow</h1>
        <span className="badge">Pairing</span>
      </div>
      <div className="card">
        <p className="muted">
          Натисніть кнопку один раз. На ноутбуці в RemoteFlow натисніть <b>Approve</b>.
          Не тисніть повторно, поки код на екрані один.
        </p>
        <label className="muted">Назва пристрою</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        {code && <div className="pair-code">{code}</div>}
        <p className={`muted ${busy ? 'waiting' : ''}`}>{status}</p>
        {error && <p className="error">{error}</p>}
        <button className="btn block" onClick={() => { startedRef.current = false; void start() }} disabled={busy}>
          {busy ? 'Очікування Approve…' : 'Запит на підключення'}
        </button>
      </div>
    </div>
  )
}
