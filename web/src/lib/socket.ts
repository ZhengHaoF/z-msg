import type {
  AckMessage,
  ErrorMessage,
  MessageEnvelope,
  ReceiptMessage,
  ServerMessage,
  SocketStatus,
} from '../types'
import type { Session } from './storage'

interface SocketHandlers {
  onStatus: (status: SocketStatus) => void
  onReady: () => void
  onMessage: (message: MessageEnvelope) => void
  onAck: (message: AckMessage) => void
  onReceipt: (message: ReceiptMessage) => void
  onError: (message: ErrorMessage) => void
}

const FATAL_CODES = new Set(['identity_rejected', 'server_full', 'replaced'])
const MAX_RETRY_DELAY_MS = 10_000

export class ChatSocket {
  private ws: WebSocket | null = null
  private ready = false
  private disposed = false
  private fatal = false
  private retry = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly session: Session,
    private readonly handlers: SocketHandlers,
  ) {}

  connect(): void {
    if (this.disposed) return
    this.open()
  }

  send(payload: unknown): boolean {
    if (!this.ready) return false
    return this.rawSend(payload)
  }

  dispose(): void {
    this.disposed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const ws = this.ws
    this.ws = null
    this.ready = false
    try {
      ws?.close(1000, 'bye')
    } catch {
      // Ignore close failures during teardown.
    }
  }

  private open(): void {
    this.handlers.onStatus('connecting')
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    let ws: WebSocket
    try {
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.rawSend({ type: 'hello', id: this.session.id, token: this.session.token })
    }
    ws.onmessage = (event) => {
      let message: ServerMessage
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      this.route(message)
    }
    ws.onclose = () => {
      this.ready = false
      this.ws = null
      this.handlers.onStatus('offline')
      if (!this.disposed && !this.fatal) this.scheduleReconnect()
    }
    ws.onerror = () => {
      // The close event follows and triggers reconnection.
    }
  }

  private route(message: ServerMessage): void {
    switch (message?.type) {
      case 'ready':
        this.ready = true
        this.retry = 0
        this.handlers.onStatus('online')
        this.handlers.onReady()
        return
      case 'message':
        if (
          typeof message.from === 'string' &&
          typeof message.roomId === 'string' &&
          typeof message.iv === 'string' &&
          typeof message.ciphertext === 'string' &&
          typeof message.clientId === 'string'
        ) {
          this.handlers.onMessage(message)
        }
        return
      case 'ack':
        if (typeof message.clientId === 'string' && typeof message.status === 'string') {
          this.handlers.onAck(message)
        }
        return
      case 'receipt':
        if (typeof message.clientId === 'string') {
          this.handlers.onReceipt(message)
        }
        return
      case 'error':
        if (FATAL_CODES.has(message.code)) this.fatal = true
        this.handlers.onError(message)
        return
      default:
        return
    }
  }

  private rawSend(payload: unknown): boolean {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try {
      ws.send(JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.fatal || this.timer) return
    const delay = Math.min(MAX_RETRY_DELAY_MS, 500 * 2 ** this.retry) + Math.floor(Math.random() * 250)
    this.retry += 1
    this.timer = setTimeout(() => {
      this.timer = null
      this.open()
    }, delay)
  }
}
