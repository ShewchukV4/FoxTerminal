import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import type {
  DeckState,
  FramePacket,
  MonitorInfo,
  ServerStatus,
} from '../types'
import { getBaseUrl, getCredentials } from './session'

let connection: HubConnection | null = null

export function getConnection() {
  return connection
}

export async function connectHub(onFrame?: (f: FramePacket) => void) {
  const { deviceId, deviceToken } = getCredentials()
  if (!deviceId || !deviceToken) throw new Error('Not paired')

  if (connection?.state === HubConnectionState.Connected) return connection

  await disconnectHub()

  // Browser WebSockets cannot send custom headers — auth only via access_token query.
  // iPhone + PC hotspot: WebSockets/SSE often hang forever. LongPolling only.
  const accessToken = `${deviceId}.${deviceToken}`
  connection = new HubConnectionBuilder()
    .withUrl(`${getBaseUrl()}/hub`, {
      accessTokenFactory: () => accessToken,
      transport: HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build()

  connection.onreconnecting(() => {
    void connection?.invoke('ReleaseAllInput').catch(() => undefined)
  })
  connection.onclose(() => {
    // agent also releases on disconnect
  })
  if (onFrame) connection.on('Frame', onFrame)

  await connection.start()
  return connection
}

export async function disconnectHub() {
  if (!connection) return
  try {
    await connection.invoke('ReleaseAllInput')
  } catch { /* ignore */ }
  try {
    await connection.stop()
  } catch { /* ignore */ }
  connection = null
}

export async function hubInvoke<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
  if (!connection || connection.state !== HubConnectionState.Connected) {
    throw new Error('Not connected')
  }
  return connection.invoke<T>(method, ...args)
}

export const hub = {
  getStatus: () => hubInvoke<ServerStatus>('GetStatus'),
  getDeck: () => hubInvoke<DeckState>('GetDeck'),
  saveDeck: (state: DeckState) => hubInvoke<{ ok: boolean; error?: string }>('SaveDeck', state),
  getMonitors: () => hubInvoke<MonitorInfo[]>('GetMonitors'),
  executeAction: (actionId: string, profileId?: string) =>
    hubInvoke<{ ok: boolean; error?: string }>('ExecuteAction', { actionId, profileId }),
  cancelMacro: () => hubInvoke('CancelMacro'),
  mouseMove: (dx: number, dy: number) => hubInvoke('MouseMove', { dx, dy }),
  mouseButton: (button: number, action: number) => hubInvoke('MouseButton', { button, action }),
  mouseScroll: (dx: number, dy: number) => hubInvoke('MouseScroll', { dx, dy }),
  mouseAbsolute: (monitorIndex: number, x: number, y: number) =>
    hubInvoke('MouseAbsolute', { monitorIndex, x, y }),
  keyboard: (payload: Record<string, unknown>) => hubInvoke('Keyboard', payload),
  releaseAll: () => hubInvoke('ReleaseAllInput'),
  startScreen: (monitorIndex = 0) =>
    hubInvoke<{ ok: boolean; error?: string }>('StartScreenShare', monitorIndex),
  stopScreen: () => hubInvoke<{ ok: boolean; error?: string }>('StopScreenShare'),
  selectMonitor: (monitorIndex: number) => hubInvoke('SelectMonitor', monitorIndex),
}
