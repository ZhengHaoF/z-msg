import { defineConfig } from '@playwright/test'

const port = 4273

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    channel: process.env.CI ? undefined : 'chrome',
  },
  webServer: {
    command: 'node server/src/index.js',
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(port),
      HOST: '127.0.0.1',
    },
  },
})
