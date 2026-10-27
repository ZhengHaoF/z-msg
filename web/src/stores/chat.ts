import { reactive } from 'vue'
import type {
  AckMessage,
  ChatMessage,
  MessageEnvelope,
  ReceiptMessage,
  Room,
  SocketStatus,
} from '../types'
import { decodeKey, decryptMessage, deriveRoomKey, encodeKey, encryptMessage, roomAad } from '../lib/crypto'
import { decodeInvite, encodeInvite } from '../lib/invite'
import { ChatSocket } from '../lib/socket'
import {
  createSession,
  loadState,
  MAX_MESSAGES_PER_ROOM,
  saveState,
  type Session,
} from '../lib/storage'
import { toast } from '../lib/toast'
import { uuidv4 } from '../lib/bytes'

interface ChatState {
  session: Session
  rooms: Room[]
  messages: Record<string, ChatMessage[]>
  activeRoomId: string | null
  socketStatus: SocketStatus
}

const initial = loadState()

export const chat = reactive<ChatState>({
  session: initial.session,
  rooms: initial.rooms,
  messages: initial.messages,
  activeRoomId: initial.activeRoomId,
  socketStatus: 'connecting',
})

let socket: ChatSocket | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pagehideAttached = false

export function flushSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  saveState({
    version: 2,
    session: chat.session,
    rooms: chat.rooms,
    messages: chat.messages,
    activeRoomId: chat.activeRoomId,
  })
}

function saveSoon(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushSave()
  }, 150)
}

function findOutgoing(clientId: string): ChatMessage | undefined {
  for (const room of chat.rooms) {
    const message = chat.messages[room.id]?.find(
      (item) => item.direction === 'out' && item.clientId === clientId,
    )
    if (message) return message
  }
  return undefined
}

function failReason(reason?: string): string {
  if (reason === 'peer_not_found') return '对方不在线或会话码无效'
  if (reason === 'queue_full') return '对方离线消息过多，请稍后再试'
  return '消息发送失败'
}

function applyAck(ack: AckMessage): void {
  const message = findOutgoing(ack.clientId)
  if (!message) return
  message.status = ack.status
  if (ack.status === 'failed') toast.error(failReason(ack.reason))
  saveSoon()
}

function applyReceipt(receipt: ReceiptMessage): void {
  const message = findOutgoing(receipt.clientId)
  if (!message) return
  message.status = 'delivered'
  saveSoon()
}

function pushMessage(room: Room, message: ChatMessage): void {
  if (!chat.messages[room.id]) chat.messages[room.id] = []
  const list = chat.messages[room.id]
  list.push(message)
  if (list.length > MAX_MESSAGES_PER_ROOM) {
    list.splice(0, list.length - MAX_MESSAGES_PER_ROOM)
  }
  room.updatedAt = Math.max(room.updatedAt, message.at)
  if (message.direction === 'in' && chat.activeRoomId !== room.id) {
    room.unread += 1
  }
  saveSoon()
}

function receiveMessage(envelope: MessageEnvelope): void {
  const room = chat.rooms.find((item) => item.id === envelope.roomId)
  if (!room) return

  if (!room.peerId) {
    room.peerId = envelope.from
    room.updatedAt = Date.now()
    toast.success('对方已加入会话')
  } else if (room.peerId !== envelope.from) {
    toast.error('收到来自其他会话成员的消息，已忽略')
    return
  }

  let text: string
  try {
    text = decryptMessage(
      decodeKey(room.key),
      envelope.iv,
      envelope.ciphertext,
      roomAad(room.id, envelope.from),
    )
  } catch {
    pushMessage(room, {
      id: uuidv4(),
      roomId: room.id,
      direction: 'system',
      text: '收到一条无法解密的消息，请确认双方口令一致',
      at: envelope.at || Date.now(),
    })
    return
  }

  pushMessage(room, {
    id: uuidv4(),
    roomId: room.id,
    direction: 'in',
    text,
    at: envelope.at || Date.now(),
    from: envelope.from,
  })
}

function resendPending(): void {
  for (const room of chat.rooms) {
    for (const message of chat.messages[room.id] ?? []) {
      if (message.direction !== 'out' || message.status !== 'pending') continue
      if (!message.to || !message.iv || !message.ciphertext || !message.clientId) {
        message.status = 'failed'
        continue
      }
      socket?.send({
        type: 'send',
        to: message.to,
        roomId: room.id,
        iv: message.iv,
        ciphertext: message.ciphertext,
        clientId: message.clientId,
      })
    }
  }
  saveSoon()
}

export function startChat(): void {
  if (socket) return
  socket = new ChatSocket(chat.session, {
    onStatus(status) {
      const previous = chat.socketStatus
      chat.socketStatus = status
      if (status === 'offline' && previous === 'online') {
        toast.error('连接已断开，正在重连')
      } else if (status === 'online' && previous === 'offline') {
        toast.success('连接已恢复')
      }
    },
    onReady: resendPending,
    onMessage: receiveMessage,
    onAck: applyAck,
    onReceipt: applyReceipt,
    onError: (error) => toast.error(error.message),
  })
  socket.connect()

  if (!pagehideAttached && typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushSave)
    pagehideAttached = true
  }
}

export function stopChat(): void {
  socket?.dispose()
  socket = null
  if (pagehideAttached && typeof window !== 'undefined') {
    window.removeEventListener('pagehide', flushSave)
    pagehideAttached = false
  }
  flushSave()
}

export function createRoom(name: string, passphrase: string): Room {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('请输入房间名称')
  if (trimmed.length > 48) throw new Error('房间名称最多 48 个字符')

  const roomId = uuidv4()
  const key = deriveRoomKey(passphrase, roomId)
  const now = Date.now()
  const room: Room = {
    id: roomId,
    name: trimmed,
    peerId: null,
    key: encodeKey(key),
    createdAt: now,
    updatedAt: now,
    unread: 0,
  }
  chat.rooms.unshift(room)
  chat.messages[room.id] = []
  chat.activeRoomId = room.id
  flushSave()
  toast.success('房间已创建')
  return room
}

export function importRoom(code: string, passphrase: string): Room {
  const invite = decodeInvite(code)
  if (invite.s === chat.session.id) throw new Error('不能导入自己的邀请码')
  if (chat.rooms.some((room) => room.id === invite.r)) throw new Error('该房间已经在列表中')

  const key = deriveRoomKey(passphrase, invite.r)
  const now = Date.now()
  const room: Room = {
    id: invite.r,
    name: invite.n,
    peerId: invite.s,
    key: encodeKey(key),
    createdAt: now,
    updatedAt: now,
    unread: 0,
  }
  chat.rooms.unshift(room)
  chat.messages[room.id] = []
  chat.activeRoomId = room.id
  flushSave()
  toast.success('已加入房间')
  return room
}

export function inviteCodeFor(room: Room): string {
  return encodeInvite({ v: 1, r: room.id, n: room.name, s: chat.session.id })
}

export function sendText(text: string): boolean {
  const room = chat.rooms.find((item) => item.id === chat.activeRoomId)
  if (!room) return false
  if (!room.peerId) {
    toast.info('等待对方加入后才能发送')
    return false
  }
  if (!text.trim()) return false
  if (text.length > 5000) {
    toast.error('单条消息最多 5000 个字符')
    return false
  }

  let sealed
  try {
    sealed = encryptMessage(decodeKey(room.key), text, roomAad(room.id, chat.session.id))
  } catch {
    toast.error('消息加密失败')
    return false
  }

  const clientId = uuidv4()
  const message: ChatMessage = {
    id: uuidv4(),
    clientId,
    roomId: room.id,
    direction: 'out',
    text,
    at: Date.now(),
    status: 'pending',
    iv: sealed.iv,
    ciphertext: sealed.ciphertext,
    to: room.peerId,
  }
  pushMessage(room, message)

  socket?.send({
    type: 'send',
    to: room.peerId,
    roomId: room.id,
    iv: sealed.iv,
    ciphertext: sealed.ciphertext,
    clientId,
  })
  return true
}

export function selectRoom(id: string): void {
  const room = chat.rooms.find((item) => item.id === id)
  if (!room) return
  chat.activeRoomId = id
  room.unread = 0
  saveSoon()
}

export function deleteRoom(id: string): void {
  const index = chat.rooms.findIndex((room) => room.id === id)
  if (index < 0) return
  chat.rooms.splice(index, 1)
  delete chat.messages[id]
  if (chat.activeRoomId === id) {
    chat.activeRoomId = (chat.rooms[index] ?? chat.rooms[index - 1])?.id ?? null
  }
  flushSave()
  toast.success('房间已删除')
}

export function clearRooms(): void {
  chat.rooms.splice(0)
  for (const roomId of Object.keys(chat.messages)) {
    delete chat.messages[roomId]
  }
  chat.activeRoomId = null
  flushSave()
  toast.success('本地数据已清除')
}

export function resetIdentity(): void {
  stopChat()
  chat.session = createSession()
  chat.rooms.splice(0)
  for (const roomId of Object.keys(chat.messages)) {
    delete chat.messages[roomId]
  }
  chat.activeRoomId = null
  flushSave()
  startChat()
  toast.success('已重置会话身份')
}
