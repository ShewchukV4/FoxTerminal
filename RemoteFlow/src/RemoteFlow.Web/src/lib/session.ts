const DEVICE_ID = 'rf_device_id'
const DEVICE_TOKEN = 'rf_device_token'
const DEVICE_NAME = 'rf_device_name'

export function getCredentials() {
  return {
    deviceId: localStorage.getItem(DEVICE_ID),
    deviceToken: localStorage.getItem(DEVICE_TOKEN),
    deviceName: localStorage.getItem(DEVICE_NAME) || 'iPhone',
  }
}

export function saveCredentials(deviceId: string, deviceToken: string, deviceName: string) {
  localStorage.setItem(DEVICE_ID, deviceId)
  localStorage.setItem(DEVICE_TOKEN, deviceToken)
  localStorage.setItem(DEVICE_NAME, deviceName)
}

export function clearCredentials() {
  localStorage.removeItem(DEVICE_ID)
  localStorage.removeItem(DEVICE_TOKEN)
}

export function getBaseUrl() {
  // When served by the Agent, same origin. For vite dev, use VITE_AGENT_URL.
  const env = import.meta.env.VITE_AGENT_URL as string | undefined
  if (env) return env.replace(/\/$/, '')
  return window.location.origin
}
