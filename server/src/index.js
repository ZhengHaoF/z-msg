import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createChatServer } from './server.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const port = Number.parseInt(process.env.PORT ?? '', 10) || 8081
const host = process.env.HOST || '0.0.0.0'
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean)

const app = createChatServer({
  webDist: path.resolve(currentDir, '../../web/dist'),
  allowedOrigins,
})

try {
  const address = await app.listen(port, host)
  console.log(`z-msg listening on http://${address.address}:${address.port}`)
} catch (error) {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用，请设置 PORT 环境变量换一个端口`)
  } else {
    console.error('服务启动失败:', error)
  }
  process.exit(1)
}

let closing = false
async function shutdown(signal) {
  if (closing) return
  closing = true
  console.log(`收到 ${signal}，正在关闭服务…`)
  try {
    await app.close()
  } catch (error) {
    console.error('关闭服务时出错:', error)
  }
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
