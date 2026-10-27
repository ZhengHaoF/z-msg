import { describe, expect, it } from 'vitest'
import { decodeInvite, encodeInvite } from '../src/lib/invite'
import type { Invite } from '../src/types'

const invite: Invite = {
  v: 1,
  r: '11111111-1111-4111-8111-111111111111',
  n: '项目讨论',
  s: '22222222-2222-4222-8222-222222222222',
}

describe('invite codes', () => {
  it('round-trips unicode room names and tolerates whitespace', () => {
    const code = encodeInvite(invite)
    const wrapped = `${code.slice(0, 10)}\n  ${code.slice(10)}`

    expect(decodeInvite(code)).toEqual(invite)
    expect(decodeInvite(wrapped)).toEqual(invite)
  })

  it('rejects malformed codes', () => {
    expect(() => decodeInvite('')).toThrow('请输入邀请码')
    expect(() => decodeInvite('not-base64!')).toThrow('邀请码格式不正确')
  })

  it('rejects wrong versions and invalid identifiers', () => {
    const wrongVersion = encodeInvite({ ...invite, v: 2 } as unknown as Invite)
    expect(() => decodeInvite(wrongVersion)).toThrow('邀请码版本不支持')

    const badRoom = encodeInvite({ ...invite, r: 'room-1' } as unknown as Invite)
    expect(() => decodeInvite(badRoom)).toThrow('邀请码内容不完整')

    const emptyName = encodeInvite({ ...invite, n: '   ' } as unknown as Invite)
    expect(() => decodeInvite(emptyName)).toThrow('邀请码中的房间名无效')
  })
})
