import { newId } from './id'
import { getBaseUrl, getCredentials } from './session'

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

export function requestPairing(deviceName: string) {
  return json<{ requestId: string; pairingCode: string; expiresAt: string }>(
    '/api/pair/request',
    { method: 'POST', body: JSON.stringify({ deviceName, clientNonce: newId() }) },
  )
}

export function completePairing(requestId: string) {
  return json<{
    status: string
    deviceId?: string
    deviceToken?: string
  }>('/api/pair/complete', {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  })
}

export function publicConfig() {
  return json<{ touchpad: { sensitivity: number; acceleration: number; scrollSensitivity: number } }>(
    '/api/config/public',
  )
}

export function authHeaders(): Record<string, string> {
  const { deviceId, deviceToken } = getCredentials()
  if (!deviceId || !deviceToken) return {}
  return {
    'X-Device-Id': deviceId,
    'X-Device-Token': deviceToken,
  }
}
