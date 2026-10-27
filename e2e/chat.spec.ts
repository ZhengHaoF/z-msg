import { expect, test, type Page } from '@playwright/test'

const passphrase = 'secret123'

async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.status-pill')).toHaveText(/已连接/, { timeout: 15_000 })
}

function dialog(page: Page) {
  return page.locator('.modal-card')
}

test('two browsers exchange encrypted messages and keep the session after reload', async ({ browser }) => {
  const aliceContext = await browser.newContext()
  const bobContext = await browser.newContext()
  const alice = await aliceContext.newPage()
  const bob = await bobContext.newPage()

  const pageErrors: string[] = []
  for (const page of [alice, bob]) {
    page.on('pageerror', (error) => pageErrors.push(error.message))
  }

  await openApp(alice)
  await openApp(bob)
  const aliceSession = (await alice.locator('.session-code').innerText()).trim()

  await alice.locator('.sidebar').getByRole('button', { name: '创建房间' }).click()
  await dialog(alice).getByLabel('房间名称').fill('测试房间')
  await dialog(alice).getByLabel('双方约定口令', { exact: true }).fill(passphrase)
  await dialog(alice).getByLabel('确认口令').fill(passphrase)
  await dialog(alice).getByRole('button', { name: '创建房间' }).click()

  const invite = await alice.getByTestId('invite-code').inputValue()
  expect(invite.length).toBeGreaterThan(20)
  await alice.locator('.modal-footer').getByRole('button', { name: '关闭' }).click()

  await bob.locator('.sidebar').getByRole('button', { name: '导入邀请' }).click()
  await dialog(bob).getByLabel('邀请码').fill(invite)
  await dialog(bob).getByLabel('双方约定口令').fill(passphrase)
  await dialog(bob).getByRole('button', { name: '加入房间' }).click()
  await expect(dialog(bob)).toHaveCount(0)

  await bob.getByLabel('消息输入框').fill('你好，这是第一条消息')
  await bob.getByRole('button', { name: '发送' }).click()
  await expect(
    alice.getByTestId('message').filter({ hasText: '你好，这是第一条消息' }),
  ).toBeVisible()
  await expect(
    bob
      .getByTestId('message')
      .filter({ hasText: '你好，这是第一条消息' })
      .locator('.message-status.delivered'),
  ).toBeVisible()

  await expect(alice.getByLabel('消息输入框')).toBeEnabled()
  await alice.getByLabel('消息输入框').fill('收到，链路正常')
  await alice.getByLabel('消息输入框').press('Enter')
  await expect(bob.getByTestId('message').filter({ hasText: '收到，链路正常' })).toBeVisible()

  await alice.reload()
  await expect(alice.locator('.status-pill')).toHaveText(/已连接/, { timeout: 15_000 })
  await expect(alice.locator('.session-code')).toHaveText(aliceSession)
  await expect(
    alice.getByTestId('message').filter({ hasText: '收到，链路正常' }),
  ).toBeVisible()
  await expect(alice.getByLabel('消息输入框')).toBeEnabled()
  await alice.getByLabel('消息输入框').fill('重载后的消息')
  await alice.getByRole('button', { name: '发送' }).click()
  await expect(bob.getByTestId('message').filter({ hasText: '重载后的消息' })).toBeVisible()

  expect(pageErrors).toEqual([])

  await aliceContext.close()
  await bobContext.close()
})
