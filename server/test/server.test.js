import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import WebSocket from 'ws'
import { createChatServer } from '../src/server.js'
import { LIMITS } from '../src/protocol.js'

const silent = { info() {}, warn() {}, error() {} }
const uuid = () => crypto.randomUUID()
const newToken = () => crypto.randomBytes(32).toString('base64url')
const base64 = (value) => Buffer.from(value).toString('base64')
const newIv = () => base64(crypto.randomBytes(12))
const ciphertext = () => base64('encrypted-payload')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function start(t, overrides = {}) {
  const app = createChatServer({ webDist: null, logger: silent, heartbeatMs: 0, ...overrides })
  const address = await app.listen(0, '127.0.0.1')
  t.after(() => app.close())
  return {
    app,
    url: `ws://127.0.0.1:${address.port}/ws`,
    base: `http://127.0.0.1:${address.port}`,
  }
}

function open(url, options) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, options)
    const onError = (error) => {
      ws.terminate()
      reject(error)
    }
    ws.once('open', () => {
      ws.off('error', onError)
      ws.on('error', () => {})
      resolve(ws)
    })
    ws.once('error', onError)
  })
}

function nextMessage(ws, predicate, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage)
      reject(new Error('timeout waiting for message'))
    }, timeout)
    function onMessage(data) {
      let message
      try {
        message = JSON.parse(data.toString())
      } catch {
        return
      }
      if (!predicate(message)) return
      clearTimeout(timer)
      ws.off('message', onMessage)
      resolve(message)
    }
    ws.on('message', onMessage)
  })
}

function waitClose(ws, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for close')), timeout)
    ws.once('close', (code, reason) => {
      clearTimeout(timer)
      resolve({ code, reason: reason.toString() })
    })
  })
}

async function identify(ws, id = uuid(), token = newToken()) {
  const ready = nextMessage(ws, (message) => message.type === 'ready')
  ws.send(JSON.stringify({ type: 'hello', id, token }))
  const message = await ready
  assert.equal(message.id, id)
  return { id, token }
}

function sendPacket(ws, to, clientId, roomId = uuid()) {
  ws.send(
    JSON.stringify({
      type: 'send',
      to,
      roomId,
      iv: newIv(),
      ciphertext: ciphertext(),
      clientId,
    }),
  )
}

async function closeQuietly(ws) {
  if (!ws || ws.readyState === WebSocket.CLOSED) return
  const closed = waitClose(ws).catch(() => {})
  ws.terminate()
  await closed
}

test('health endpoint responds without a frontend build', async (t) => {
  const { base } = await start(t)
  const response = await fetch(`${base}/healthz`)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.status, 'ok')
})

test('malformed JSON closes only the offending connection', async (t) => {
  const { url } = await start(t)
  const bad = await open(url)
  const closed = waitClose(bad)
  bad.send('not-json')
  const result = await closed
  assert.equal(result.code, 1008)

  const good = await open(url)
  await identify(good)
  assert.equal(good.readyState, WebSocket.OPEN)
  await closeQuietly(good)
})

test('routes an encrypted envelope to the target and acknowledges it', async (t) => {
  const { url } = await start(t)
  const alice = await open(url)
  const bob = await open(url)
  const aliceId = await identify(alice)
  const bobId = await identify(bob)

  const roomId = uuid()
  const clientId = 'client-msg-01'
  const incoming = nextMessage(alice, (message) => message.type === 'message')
  const ack = nextMessage(bob, (message) => message.type === 'ack' && message.clientId === clientId)

  sendPacket(bob, aliceId.id, clientId, roomId)

  const envelope = await incoming
  assert.equal(envelope.from, bobId.id)
  assert.equal(envelope.roomId, roomId)
  assert.equal(envelope.ciphertext, ciphertext())
  const ackMessage = await ack
  assert.equal(ackMessage.status, 'delivered')

  await closeQuietly(alice)
  await closeQuietly(bob)
})

test('queues messages for a registered offline peer and delivers them on reconnect', async (t) => {
  const { url } = await start(t)
  const alice = await open(url)
  const aliceIdentity = await identify(alice)
  await closeQuietly(alice)
  await sleep(30)

  const bob = await open(url)
  await identify(bob)

  const clientId = 'client-offline-01'
  const ack = nextMessage(bob, (message) => message.type === 'ack' && message.clientId === clientId)
  sendPacket(bob, aliceIdentity.id, clientId)
  assert.equal((await ack).status, 'queued')

  const aliceAgain = await open(url)
  const queued = nextMessage(aliceAgain, (message) => message.type === 'message')
  const receipt = nextMessage(bob, (message) => message.type === 'receipt' && message.clientId === clientId)
  await identify(aliceAgain, aliceIdentity.id, aliceIdentity.token)

  const envelope = await queued
  assert.equal(envelope.ciphertext, ciphertext())
  await receipt

  await closeQuietly(aliceAgain)
  await closeQuietly(bob)
})

test('rejects a peer that presents the wrong token for an identity', async (t) => {
  const { url } = await start(t)
  const alice = await open(url)
  const aliceIdentity = await identify(alice)

  const impostor = await open(url)
  const error = nextMessage(impostor, (message) => message.type === 'error')
  const closed = waitClose(impostor)
  impostor.send(JSON.stringify({ type: 'hello', id: aliceIdentity.id, token: newToken() }))

  assert.equal((await error).code, 'identity_rejected')
  assert.equal((await closed).code, 1008)
  assert.equal(alice.readyState, WebSocket.OPEN)

  await closeQuietly(alice)
})

test('rejects invalid send payloads and keeps serving other connections', async (t) => {
  const { url } = await start(t)
  const alice = await open(url)
  await identify(alice)

  const error = nextMessage(alice, (message) => message.type === 'error')
  const closed = waitClose(alice)
  alice.send(JSON.stringify({ type: 'send', to: 'not-a-uuid', roomId: uuid(), iv: newIv(), ciphertext: ciphertext(), clientId: 'client-bad-01' }))
  assert.equal((await error).code, 'invalid_message')
  assert.equal((await closed).code, 1008)

  const bob = await open(url)
  await identify(bob)
  assert.equal(bob.readyState, WebSocket.OPEN)
  await closeQuietly(bob)
})

test('ignores unknown message types without dropping the connection', async (t) => {
  const { url } = await start(t)
  const alice = await open(url)
  const aliceIdentity = await identify(alice)

  const error = nextMessage(alice, (message) => message.type === 'error')
  alice.send(JSON.stringify({ type: 'typing' }))
  assert.equal((await error).code, 'unknown_type')

  const incoming = nextMessage(alice, (message) => message.type === 'message')
  sendPacket(alice, aliceIdentity.id, 'client-self-01')
  await incoming

  await closeQuietly(alice)
})

test('rate limits floods and reports an error', async (t) => {
  const { url } = await start(t, {
    limits: { ...LIMITS, rateMaxMessages: 2, rateWindowMs: 60_000 },
  })
  const alice = await open(url)
  const aliceIdentity = await identify(alice)

  sendPacket(alice, aliceIdentity.id, 'client-rate-01')
  sendPacket(alice, aliceIdentity.id, 'client-rate-02')

  const error = nextMessage(alice, (message) => message.type === 'error')
  sendPacket(alice, aliceIdentity.id, 'client-rate-03')
  assert.equal((await error).code, 'rate_limited')

  await closeQuietly(alice)
})

test('allows local development origins and rejects foreign origins', async (t) => {
  const { url } = await start(t)

  const local = await open(url, { origin: 'http://localhost:5174' })
  await identify(local)
  await closeQuietly(local)

  const foreign = new WebSocket(url, { origin: 'http://evil.example' })
  foreign.on('error', () => {})
  const status = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for rejection')), 2000)
    foreign.once('unexpected-response', (_request, response) => {
      clearTimeout(timer)
      resolve(response.statusCode)
    })
  })
  assert.equal(status, 403)
  foreign.terminate()
})

test('deduplicates retried client message ids', async (t) => {
  const { url } = await start(t)
  const alice = await open(url)
  const bob = await open(url)
  const aliceIdentity = await identify(alice)
  await identify(bob)

  let received = 0
  alice.on('message', (data) => {
    const message = JSON.parse(data.toString())
    if (message.type === 'message') received += 1
  })

  const clientId = 'client-dedupe-01'
  const firstAck = nextMessage(bob, (message) => message.type === 'ack' && message.clientId === clientId)
  sendPacket(bob, aliceIdentity.id, clientId)
  await firstAck

  const secondAck = nextMessage(bob, (message) => message.type === 'ack' && message.clientId === clientId)
  sendPacket(bob, aliceIdentity.id, clientId)
  await secondAck

  await sleep(80)
  assert.equal(received, 1)

  await closeQuietly(alice)
  await closeQuietly(bob)
})
