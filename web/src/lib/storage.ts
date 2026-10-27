import type { ChatMessage, MessageStatus, Room } from '../types'
import { base64Decode, base64UrlEncode, isUuid, randomBytes, uuidv4 } from './bytes'

export interface Session {
  id: string
  token: string
}

export interface PersistedState {
  version: 2
  session: Session
  rooms: Room[]
  messages: Record<string, ChatMessage[]>
  activeRoomId: string | null
}

const STORAGE_KEY = 'z-msg:v2'
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const MAX_NAME_LENGTH = 48
const MAX_TEXT_LENGTH = 20_000
export const MAX_MESSAGES_PER_ROOM = 200

export function createSession(): Session {
  return {
    id: uuidv4(),
    token: base64UrlEncode(randomBytes(32)),
  }
}

function freshState(): PersistedState {
  return {
    version: 2,
    session: createSession(),
    rooms: [],
    messages: {},
    activeRoomId: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMessageStatus(value: unknown): value is MessageStatus {
  return value === 'pending' || value === 'delivered' || value === 'queued' || value === 'failed'
}

function sanitizeRoom(value: unknown): Room | null {
  if (!isRecord(value) || !isUuid(value.id)) return null
  if (typeof value.name !== 'string') return null
  const name = value.name.trim()
  if (!name || name.length > MAX_NAME_LENGTH) return null
  if (value.peerId !== null && !isUuid(value.peerId)) return null
  if (typeof value.key !== 'string') return null
  try {
    if (base64Decode(value.key).length !== 32) return null
  } catch {
    return null
  }
  const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now()
  const updatedAt = typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : createdAt
  const unread = typeof value.unread === 'number' && Number.isFinite(value.unread) && value.unread > 0 ? Math.floor(value.unread) : 0
  return {
    id: value.id,
    name,
    peerId: (value.peerId as string | null) ?? null,
    key: value.key,
    createdAt,
    updatedAt,
    unread,
  }
}

function sanitizeMessage(value: unknown, roomId: string): ChatMessage | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null
  if (value.roomId !== roomId) return null
  if (value.direction !== 'in' && value.direction !== 'out' && value.direction !== 'system') return null
  if (typeof value.text !== 'string' || value.text.length > MAX_TEXT_LENGTH) return null
  if (typeof value.at !== 'number' || !Number.isFinite(value.at)) return null

  const message: ChatMessage = {
    id: value.id,
    roomId,
    direction: value.direction,
    text: value.text,
    at: value.at,
  }
  if (value.direction === 'out' && isMessageStatus(value.status)) message.status = value.status
  for (const field of ['clientId', 'from', 'iv', 'ciphertext', 'to'] as const) {
    if (typeof value[field] === 'string') message[field] = value[field] as string
  }
  return message
}

function sanitizeState(value: unknown): PersistedState | null {
  if (!isRecord(value) || value.version !== 2) return null
  if (!isRecord(value.session)) return null
  const { id, token } = value.session
  if (!isUuid(id) || typeof token !== 'string' || !TOKEN_RE.test(token)) return null

  const rooms: Room[] = []
  if (Array.isArray(value.rooms)) {
    const seen = new Set<string>()
    for (const item of value.rooms) {
      const room = sanitizeRoom(item)
      if (!room || seen.has(room.id)) continue
      seen.add(room.id)
      rooms.push(room)
    }
  }

  const messages: Record<string, ChatMessage[]> = {}
  for (const room of rooms) {
    messages[room.id] = []
  }
  if (isRecord(value.messages)) {
    for (const room of rooms) {
      const list = value.messages[room.id]
      if (!Array.isArray(list)) continue
      messages[room.id] = list
        .map((item) => sanitizeMessage(item, room.id))
        .filter((item): item is ChatMessage => item !== null)
        .slice(-MAX_MESSAGES_PER_ROOM)
    }
  }

  const activeRoomId =
    typeof value.activeRoomId === 'string' && rooms.some((room) => room.id === value.activeRoomId)
      ? value.activeRoomId
      : rooms[0]?.id ?? null

  return {
    version: 2,
    session: { id, token },
    rooms,
    messages,
    activeRoomId,
  }
}

export function loadState(): PersistedState {
  if (typeof globalThis.localStorage === 'undefined') return freshState()
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    return sanitizeState(JSON.parse(raw)) ?? freshState()
  } catch {
    return freshState()
  }
}

function trimMessages(messages: Record<string, ChatMessage[]>, limit: number): Record<string, ChatMessage[]> {
  const trimmed: Record<string, ChatMessage[]> = {}
  for (const [roomId, list] of Object.entries(messages)) {
    trimmed[roomId] = list.slice(-limit)
  }
  return trimmed
}

export function saveState(state: PersistedState): boolean {
  if (typeof globalThis.localStorage === 'undefined') return false
  const snapshot = {
    ...state,
    messages: trimMessages(state.messages, MAX_MESSAGES_PER_ROOM),
  }
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    try {
      globalThis.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...snapshot, messages: trimMessages(state.messages, 50) }),
      )
      return true
    } catch {
      return false
    }
  }
}

export function clearStoredState(): void {
  if (typeof globalThis.localStorage === 'undefined') return
  try {
    globalThis.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures; the in-memory state is cleared by the caller.
  }
}
