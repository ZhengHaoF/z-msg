import crypto from 'node:crypto'
import { ERROR_MESSAGES, LIMITS, parseClientMessage } from './protocol.js'

const OPEN = 1

export class ChatHub {
  constructor({ limits = LIMITS, logger = console } = {}) {
    this.limits = limits
    this.logger = logger
    this.identities = new Map()
    this.recent = new Map()
  }

  attach(ws) {
    ws.isAlive = true
    ws.authenticated = false
    ws.sessionId = null
    ws.rate = { start: Date.now(), count: 0 }

    ws.on('pong', () => {
      ws.isAlive = true
    })
    ws.on('message', (data) => this.onMessage(ws, data))
    ws.on('close', () => this.onClose(ws))
    ws.on('error', (error) => this.logger.warn?.('websocket error:', error?.message))
  }

  send(ws, payload) {
    if (ws.readyState !== OPEN) return false
    try {
      ws.send(JSON.stringify(payload))
      return true
    } catch (error) {
      this.logger.warn?.('websocket send failed:', error?.message)
      return false
    }
  }

  fail(ws, code, fatal = false) {
    this.send(ws, { type: 'error', code, message: ERROR_MESSAGES[code] ?? '未知错误' })
    if (fatal) ws.close(1008, code)
  }

  onMessage(ws, data) {
    const raw = typeof data === 'string' ? data : data.toString('utf8')
    const parsed = parseClientMessage(raw)
    if (!parsed.ok) {
      this.fail(ws, parsed.code, parsed.fatal)
      return
    }
    if (parsed.value.type === 'hello') {
      this.handleHello(ws, parsed.value)
    } else {
      this.handleSend(ws, parsed.value)
    }
  }

  handleHello(ws, { id, token }) {
    if (ws.authenticated) {
      this.fail(ws, 'already_hello')
      return
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest()
    let identity = this.identities.get(id)

    if (!identity) {
      if (this.identities.size >= this.limits.maxIdentityCount) {
        this.fail(ws, 'server_full', true)
        return
      }
      identity = { id, tokenHash, socket: null, queue: [] }
      this.identities.set(id, identity)
    } else if (!crypto.timingSafeEqual(identity.tokenHash, tokenHash)) {
      this.fail(ws, 'identity_rejected', true)
      return
    }

    if (identity.socket && identity.socket !== ws) {
      this.send(identity.socket, { type: 'error', code: 'replaced', message: ERROR_MESSAGES.replaced })
      identity.socket.close(4001, 'replaced')
    }

    identity.socket = ws
    ws.authenticated = true
    ws.sessionId = id

    this.send(ws, { type: 'ready', id })
    this.flushQueue(identity)
    this.logger.info?.(`peer online: ${id.slice(0, 8)}`)
  }

  handleSend(ws, message) {
    if (!ws.authenticated) {
      this.fail(ws, 'not_ready', true)
      return
    }
    if (!this.allowMessage(ws)) {
      this.fail(ws, 'rate_limited')
      return
    }

    const senderId = ws.sessionId
    const dedupeKey = `${senderId}:${message.clientId}`
    const now = Date.now()
    const previous = this.recent.get(dedupeKey)
    if (previous && previous.expiresAt > now) {
      this.send(ws, { type: 'ack', clientId: message.clientId, status: previous.status, reason: previous.reason, at: now })
      return
    }

    const envelope = {
      type: 'message',
      from: senderId,
      roomId: message.roomId,
      iv: message.iv,
      ciphertext: message.ciphertext,
      clientId: message.clientId,
      at: now,
    }

    const target = this.identities.get(message.to)
    let status = 'failed'
    let reason

    if (target?.socket) {
      this.send(target.socket, envelope)
      status = 'delivered'
    } else if (target) {
      if (target.queue.length >= this.limits.maxQueueLength) {
        reason = 'queue_full'
      } else {
        target.queue.push({ envelope, queuedAt: now })
        status = 'queued'
      }
    } else {
      reason = 'peer_not_found'
    }

    this.rememberDedupe(dedupeKey, status, reason, now)
    this.send(ws, { type: 'ack', clientId: message.clientId, status, reason, at: now })
  }

  allowMessage(ws) {
    const now = Date.now()
    if (now - ws.rate.start >= this.limits.rateWindowMs) {
      ws.rate.start = now
      ws.rate.count = 0
    }
    ws.rate.count += 1
    return ws.rate.count <= this.limits.rateMaxMessages
  }

  rememberDedupe(key, status, reason, now) {
    if (this.recent.size >= this.limits.dedupeMaxEntries) {
      for (const [entryKey, entry] of this.recent) {
        if (entry.expiresAt <= now) this.recent.delete(entryKey)
      }
      if (this.recent.size >= this.limits.dedupeMaxEntries) {
        const oldest = this.recent.keys().next().value
        if (oldest !== undefined) this.recent.delete(oldest)
      }
    }
    this.recent.set(key, { status, reason, expiresAt: now + this.limits.dedupeTtlMs })
  }

  flushQueue(identity) {
    const now = Date.now()
    const queue = identity.queue
    identity.queue = []
    for (const item of queue) {
      if (now - item.queuedAt > this.limits.queueTtlMs) continue
      if (!this.send(identity.socket, item.envelope)) continue
      const dedupeKey = `${item.envelope.from}:${item.envelope.clientId}`
      const entry = this.recent.get(dedupeKey)
      if (entry) entry.status = 'delivered'
      const sender = this.identities.get(item.envelope.from)
      if (sender?.socket) {
        this.send(sender.socket, { type: 'receipt', clientId: item.envelope.clientId, at: now })
      }
    }
  }

  onClose(ws) {
    if (!ws.sessionId) return
    const identity = this.identities.get(ws.sessionId)
    if (identity && identity.socket === ws) {
      identity.socket = null
      this.logger.info?.(`peer offline: ${ws.sessionId.slice(0, 8)}`)
    }
  }
}
