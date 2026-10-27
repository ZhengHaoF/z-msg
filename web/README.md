# @z-msg/web

Vue 3 + TypeScript + Vite 前端，不依赖 UI 组件库。

```shell
npm run dev        # http://localhost:5173，/ws 代理到服务端
npm run build      # 输出到 dist/
npm run typecheck
npm test
```

开发代理默认指向 `http://127.0.0.1:8081`，可在 `.env.local` 中设置 `VITE_SERVER_ORIGIN` 覆盖。构建产物由同仓库的 `server/` 直接托管。
