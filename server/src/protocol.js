export const LIMITS = Object.freeze({
  maxPayloadBytes: 64 * 1024,
  maxCiphertextBytes: 48 * 1024,
  maxIdentityCount: 5000,
  maxQueueLength: 100,
  queueTtlMs: 24 * 60 * 60 * 1000,
  rateWindowMs: 10_000,
  rateMaxMessages: 40,
  dedupeTtlMs: 10 * 60 * 1000,
  dedupeMaxEntries: 20_000,
})

export const ERROR_MESSAGES = Object.freeze({
  invalid_json: '消息不是合法的 JSON',
  invalid_message: '消息字段不合法',
  unknown_type: '不支持的消息类型',
  already_hello: '重复的握手请求',
  identity_rejected: '会话码校验失败',
  server_full: '服务器连接数已满',
  not_ready: '请先完成握手',
  rate_limited: '发送过于频繁，请稍后再试',
  replaced: '该会话已在其他窗口打开',
  queue_full: '对方离线消息过多，请稍后再试',
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isToken(value) {
  return typeof value === 'string' && TOKEN_RE.test(value)
}

export function decodeBase64(value, expectedLength = null) {
  if (typeof value !== 'string' || !BASE64_RE.test(value) || value.length % 4 !== 0) return null
  let buffer
  try {
    buffer = Buffer.from(value, 'base64')
  } catch {
    return null
  }
  if (buffer.toString('base64') !== value) return null
  if (expectedLength !== null && buffer.length !== expectedLength) return null
  return buffer
}

export function parseClientMessage(raw) {
  if (typeof raw !== 'string' || raw.length > LIMITS.maxPayloadBytes) {
    return { ok: false, code: 'invalid_message', fatal: true }
  }

  let msg
  try {
    msg = JSON.parse(raw)
  } catch {
    return { ok: false, code: 'invalid_json', fatal: true }
  }

  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    return { ok: false, code: 'invalid_message', fatal: true }
  }

  if (msg.type === 'hello') {
    if (!isUuid(msg.id) || !isToken(msg.token)) {
      return { ok: false, code: 'invalid_message', fatal: true }
    }
    return { ok: true, value: { type: 'hello', id: msg.id, token: msg.token } }
  }

  if (msg.type === 'send') {
    if (!isUuid(msg.to) || !isUuid(msg.roomId)) {
      return { ok: false, code: 'invalid_message', fatal: true }
    }
    if (!CLIENT_ID_RE.test(msg.clientId ?? '')) {
      return { ok: false, code: 'invalid_message', fatal: true }
    }
    const iv = decodeBase64(msg.iv, 12)
    const ciphertext = decodeBase64(msg.ciphertext)
    if (!iv || !ciphertext || ciphertext.length === 0 || ciphertext.length > LIMITS.maxCiphertextBytes) {
      return { ok: false, code: 'invalid_message', fatal: true }
    }
    return {
      ok: true,
      value: {
        type: 'send',
        to: msg.to,
        roomId: msg.roomId,
        iv: msg.iv,
        ciphertext: msg.ciphertext,
        clientId: msg.clientId,
      },
    }
  }

  return { ok: false, code: 'unknown_type', fatal: false }
}
