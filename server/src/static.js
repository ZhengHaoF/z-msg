import fs from 'node:fs'
import path from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'",
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...headers })
  res.end(body)
}

function statFile(filePath) {
  try {
    const stat = fs.statSync(filePath)
    return stat.isFile() ? stat : null
  } catch {
    return null
  }
}

export function createStaticHandler(rootDir) {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' })
      return
    }

    let pathname
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    } catch {
      send(res, 400, 'Bad Request')
      return
    }

    if (pathname === '/healthz') {
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(JSON.stringify({ status: 'ok', uptime: Math.round(process.uptime()) }))
      return
    }

    if (!rootDir || !fs.existsSync(rootDir)) {
      send(res, 503, '前端尚未构建：请先运行 npm run build')
      return
    }

    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    let filePath = path.resolve(rootDir, relative)
    const withinRoot = path.relative(rootDir, filePath)
    if (withinRoot.startsWith('..') || path.isAbsolute(withinRoot)) {
      send(res, 403, 'Forbidden')
      return
    }

    let stat = statFile(filePath)
    if (!stat && !path.extname(relative)) {
      filePath = path.join(rootDir, 'index.html')
      stat = statFile(filePath)
    }
    if (!stat) {
      send(res, 404, 'Not Found')
      return
    }

    const extension = path.extname(filePath).toLowerCase()
    const immutable = filePath.includes(`${path.sep}assets${path.sep}`)
    const headers = {
      ...SECURITY_HEADERS,
      'Content-Type': MIME[extension] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    }

    res.writeHead(200, headers)
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    fs.createReadStream(filePath).pipe(res)
  }
}
