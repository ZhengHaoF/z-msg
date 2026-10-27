import http from 'node:http'
import { WebSocketServer } from 'ws'
import { ChatHub } from './hub.js'
import { LIMITS } from './protocol.js'
import { createStaticHandler } from './static.js'

const STATUS_TEXT = {
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  426: 'Upgrade Required',
}

function rejectUpgrade(socket, status) {
  try {
    socket.write(`HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? 'Error'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  } finally {
    socket.destroy()
  }
}

function originAllowed(req, allowedOrigins) {
  const origin = req.headers.origin
  if (!origin) return true
  if (allowedOrigins.includes(origin)) return true

  let parsed
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  if (req.headers.host && parsed.host === req.headers.host) return true

  const isLocal =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1'
  return isLocal
}

export function createChatServer({
  webDist = null,
  allowedOrigins = [],
  limits = LIMITS,
  logger = console,
  heartbeatMs = 30_000,
} = {}) {
  const hub = new ChatHub({ limits, logger })
  const server = http.createServer(createStaticHandler(webDist))
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: limits.maxPayloadBytes,
    perMessageDeflate: false,
  })

  server.on('upgrade', (req, socket, head) => {
    let pathname
    try {
      pathname = new URL(req.url, 'http://localhost').pathname
    } catch {
      rejectUpgrade(socket, 400)
      return
    }
    if (pathname !== '/ws') {
      rejectUpgrade(socket, 404)
      return
    }
    if (!originAllowed(req, allowedOrigins)) {
      rejectUpgrade(socket, 403)
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => hub.attach(ws))
  })

  wss.on('error', (error) => logger.error?.('websocket server error:', error?.message))
  server.on('clientError', (error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
  })

  let heartbeat = null
  if (heartbeatMs > 0) {
    heartbeat = setInterval(() => {
      for (const ws of wss.clients) {
        if (ws.isAlive === false) {
          ws.terminate()
          continue
        }
        ws.isAlive = false
        try {
          ws.ping()
        } catch {
          ws.terminate()
        }
      }
    }, heartbeatMs)
    heartbeat.unref?.()
  }

  const listen = (port = 0, host = '0.0.0.0') =>
    new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off('listening', onListening)
        reject(error)
      }
      const onListening = () => {
        server.off('error', onError)
        resolve(server.address())
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, host)
    })

  const close = async () => {
    if (heartbeat) clearInterval(heartbeat)
    for (const ws of wss.clients) ws.terminate()
    await new Promise((resolve) => wss.close(() => resolve()))
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  }

  return {
    server,
    wss,
    hub,
    listen,
    close,
    address: () => server.address(),
  }
}
