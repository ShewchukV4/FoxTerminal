export type ActionKind =
  | 'OpenUrl' | 'LaunchApp' | 'OpenFolder'
  | 'VolumeUp' | 'VolumeDown' | 'VolumeMute'
  | 'MediaPlayPause' | 'MediaNext' | 'MediaPrevious'
  | 'Screenshot' | 'LockWorkstation' | 'Hotkey' | 'Macro'

export interface ActionDefinition {
  id: string
  name: string
  kind: ActionKind | number
  target?: string
  icon?: string
  color?: string
  macroSteps?: { kind: ActionKind | number; target?: string; delayMs: number }[]
}

export interface DeckButton {
  id: string
  label: string
  icon?: string
  color: string
  row: number
  col: number
  rowSpan: number
  colSpan: number
  folderId?: string
  actionId: string
}

export interface DeckFolder {
  id: string
  name: string
  icon?: string
  color: string
}

export interface DeckProfile {
  id: string
  name: string
  buttons: DeckButton[]
  folders: DeckFolder[]
  actions: ActionDefinition[]
}

export interface DeckState {
  activeProfileId: string
  profiles: DeckProfile[]
}

export interface ServerStatus {
  isRunning: boolean
  localIp?: string
  port: number
  baseUrl?: string
  connectedDevices: number
  screenSharingActive: boolean
  remoteControlEnabled: boolean
  screenShareEnabled: boolean
}

export interface MonitorInfo {
  index: number
  name: string
  x: number
  y: number
  width: number
  height: number
  isPrimary: boolean
}

export interface FramePacket {
  monitorIndex: number
  width: number
  height: number
  timestampMs: number
  mime: string
  base64: string
}

export interface TouchpadSettings {
  sensitivity: number
  acceleration: number
  scrollSensitivity: number
}

export type TabId = 'deck' | 'touchpad' | 'screen' | 'profiles' | 'settings'
