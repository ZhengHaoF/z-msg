# z-msg 加密聊天

前后端同仓库：

- `web/`：前端，Vue 3 + Vite + Ant Design Vue
- `server/`：服务端，Express + nodejs-websocket

消息在浏览器端使用 AES 加密，服务端只负责按会话码转发，不持有聊天密钥。

## 环境

Node.js >= 16

## 开发

```shell
npm run setup
```

两个终端分别运行：

```shell
npm start   # 服务端：HTTP 8081，WebSocket 3001
npm run dev # 前端：http://localhost:5173
```

## 生产

```shell
npm run build # 构建前端到 web/dist
npm start     # 服务端托管 web/dist 并转发消息
```

服务端端口可通过环境变量 `PORT`（HTTP，默认 8081）和 `WS_PORT`（WebSocket，默认 3001）调整。
