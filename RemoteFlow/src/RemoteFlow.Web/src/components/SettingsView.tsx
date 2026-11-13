import { clearCredentials, getCredentials } from '../lib/session'
import type { ServerStatus } from '../types'

export function SettingsView({
  status,
  onUnpair,
}: {
  status: ServerStatus | null
  onUnpair: () => void
}) {
  const creds = getCredentials()

  return (
    <div className="page">
      <div className="topbar">
        <h1>Settings</h1>
      </div>
      <div className="card">
        <p className="muted">Пристрій: <strong>{creds.deviceName}</strong></p>
        <p className="muted">ID: {creds.deviceId?.slice(0, 8)}…</p>
        <p className="muted">Remote control: {status?.remoteControlEnabled ? 'on' : 'off'}</p>
        <p className="muted">Screen share: {status?.screenShareEnabled ? 'allowed' : 'blocked'}</p>
        <p className="muted">
          Додати на головний екран iPhone: Share → Add to Home Screen.
        </p>
      </div>
      <button
        className="btn danger block"
        onClick={() => {
          clearCredentials()
          onUnpair()
        }}
      >
        Видалити авторизацію на цьому телефоні
      </button>
    </div>
  )
}
