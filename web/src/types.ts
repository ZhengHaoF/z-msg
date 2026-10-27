export type SocketStatus = 'connecting' | 'online' | 'offline'

export type MessageStatus = 'pending' | 'delivered' | 'queued' | 'failed'

export interface Room {
  id: string
  name: string
  peerId: string | null
  key: string
  createdAt: number
  updatedAt: number
  unread: number
}

export interface ChatMessage {
  id: string
  roomId: string
  clientId?: string
  direction: 'in' | 'out' | 'system'
  text: string
  at: number
  status?: MessageStatus
  from?: string
  iv?: string
  ciphertext?: string
  to?: string
}

export interface Invite {
  v: 1
  r: string
  n: string
  s: string
}

export interface MessageEnvelope {
  type: 'message'
  from: string
  roomId: string
  iv: string
  ciphertext: string
  clientId: string
  at: number
}

export interface AckMessage {
  type: 'ack'
  clientId: string
  status: MessageStatus
  reason?: string
  at: number
}

export interface ReceiptMessage {
  type: 'receipt'
  clientId: string
  at: number
}

export interface ErrorMessage {
  type: 'error'
  code: string
  message: string
}

export interface ReadyMessage {
  type: 'ready'
  id: string
}

export type ServerMessage = MessageEnvelope | AckMessage | ReceiptMessage | ErrorMessage | ReadyMessage
