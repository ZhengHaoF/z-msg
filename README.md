# Z-Msg 端到端加密聊天

浏览器端加密消息，Node.js 服务端只按会话码转发密文，不接触明文和密钥。

- 前端：Vue 3 + TypeScript + Vite，无 UI 组件库，自绘界面
- 后端：Node.js + `ws`，单端口同时提供静态页面和 WebSocket
- 加密：AES-256-GCM + PBKDF2-SHA256，密钥只在浏览器内派生
- 体验：邀请码加入、稳定会话身份、断线重连、离线队列、未读数、本地历史

## 快速开始

要求 Node.js >= 20。

```shell
npm ci
```

开发时开两个终端：

```shell
npm start    # 服务端，默认 http://localhost:8081
npm run dev  # 前端，http://localhost:5173
```

生产：

```shell
npm run build
npm start    # 打开 http://localhost:8081
```

如果 8081 被其他服务占用，换一个端口并在 `web/.env.local` 中同步开发代理：

```shell
# 终端 1
PORT=8090 npm start

# web/.env.local
VITE_SERVER_ORIGIN=http://127.0.0.1:8090

# 终端 2
npm run dev
```

## 使用方式

1. A 创建房间，填写房间名和双方约定口令，复制邀请码。
2. 通过任意渠道把邀请码发给 B；口令必须单独告知，不要和邀请码一起发送。
3. B 导入邀请码并输入相同口令。
4. B 发出第一条消息后，A 会自动绑定对方，之后双方可以互发消息。

会话身份保存在浏览器 localStorage 中，刷新或断线重连后会话码保持不变，已经分享出去的邀请码继续有效。

## 安全设计

- 每条消息使用 AES-256-GCM 加密，12 字节随机 IV，AAD 绑定 `roomId` 和发送者会话码，防止密文被挪到其他房间或伪造发送者。
- 房间密钥由 `PBKDF2-SHA256(口令, salt=roomId, 210000 次)` 派生，只在浏览器内使用；服务端不接收口令、密钥或明文。
- 邀请码只包含房间 ID、房间名和发起者会话码，不包含口令；口令需要另外确认。
- 服务端校验 JSON 与字段类型、限制 64 KB 单帧、每连接 10 秒 40 条消息、检查 Origin、30 秒心跳、10 分钟消息去重。
- 离线消息暂存在服务端内存（每会话最多 100 条，24 小时过期），只存密文。
- 会话码是 128 位随机 UUID，并配合本地随机 token 做身份绑定，重连时不需要更换会话码。

应用层加密保护的是消息内容，不隐藏元数据：服务端仍能看到会话码、房间 ID、时间戳和密文长度。生产环境应通过 HTTPS 提供服务。

## 已知限制

- 服务端状态只在内存中。重启后身份绑定和离线队列会清空；客户端重新连接会自动重新注册，但重启期间排队的消息会丢失。
- 服务端重启后，先连接的人可以注册任意尚未绑定的会话码。会话码只通过邀请码分享，但这仍不是账号级身份认证。
- 每个房间绑定第一个发来消息的会话身份，没有群聊；对方重置身份后需要重新创建房间。
- 房间密钥是静态的，没有前向保密；口令泄露会暴露该房间的全部历史密文。
- 密钥和明文聊天记录保存在浏览器 localStorage 中，设备被攻破不在防护范围内。可在设置中清空数据或重置身份。
- 多设备不同步，每个浏览器是独立身份。

## 环境变量

| 变量 | 位置 | 说明 |
| --- | --- | --- |
| `PORT` | 服务端 | HTTP + WebSocket 端口，默认 `8081` |
| `HOST` | 服务端 | 监听地址，默认 `0.0.0.0` |
| `ALLOWED_ORIGINS` | 服务端 | 额外允许的 Origin，逗号分隔 |
| `VITE_SERVER_ORIGIN` | 前端开发 | Vite 代理 `/ws` 的目标，默认 `http://127.0.0.1:8081` |

## 测试

```shell
npm run typecheck   # vue-tsc
npm test            # 服务端 node:test + 前端 vitest
npm run test:e2e    # 构建后用 Playwright 跑双人聊天
```

Playwright 在本地默认调用系统 Chrome；CI 中使用自带 Chromium。

## 部署

构建前端后直接运行服务端即可，静态文件和 WebSocket 共用同一端口：

```shell
npm ci
npm run build
npm start
```

反向代理（以 nginx 为例）：

```nginx
server {
  listen 443 ssl;
  server_name chat.example.com;

  location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

代理需要保留 `Host`，否则同源校验会拒绝 WebSocket。若上游改写了 Host，请把公网 Origin 加入 `ALLOWED_ORIGINS`。

健康检查：`GET /healthz`。

## 协议

客户端连接 `/ws` 后先发送 `hello`，服务端返回 `ready` 并下发离线消息。

```text
客户端 -> 服务端
  { type: "hello", id, token }
  { type: "send", to, roomId, iv, ciphertext, clientId }

服务端 -> 客户端
  { type: "ready", id }
  { type: "message", from, roomId, iv, ciphertext, clientId, at }
  { type: "ack", clientId, status, reason?, at }
  { type: "receipt", clientId, at }
  { type: "error", code, message }
```

`status` 为 `delivered` / `queued` / `failed`；对方离线时先回 `queued`，消息送达后再补一条 `receipt`。

## 项目结构

```text
server/
  src/         HTTP 静态服务、WebSocket hub、协议校验
  test/        node:test 集成测试
web/
  src/lib/     加密、邀请码、存储、WebSocket、剪贴板、提示
  src/stores/  聊天状态与动作
  src/components/  自绘 UI 组件
  src/views/   页面布局
e2e/           Playwright 双人聊天测试
```
