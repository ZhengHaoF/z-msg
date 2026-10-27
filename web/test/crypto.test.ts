import { describe, expect, it } from 'vitest'
import {
  decryptMessage,
  deriveRoomKey,
  encryptMessage,
  roomAad,
} from '../src/lib/crypto'

const roomId = '11111111-1111-4111-8111-111111111111'
const aliceId = '22222222-2222-4222-8222-222222222222'
const bobId = '33333333-3333-4333-8333-333333333333'

describe('room encryption', () => {
  it('derives a stable 256-bit key from passphrase and room id', () => {
    const first = deriveRoomKey('correct horse', roomId, 1000)
    const second = deriveRoomKey('correct horse', roomId, 1000)
    const otherRoom = deriveRoomKey('correct horse', bobId, 1000)

    expect(first).toHaveLength(32)
    expect(Array.from(first)).toEqual(Array.from(second))
    expect(Array.from(first)).not.toEqual(Array.from(otherRoom))
  })

  it('round-trips a message and binds sender metadata through AAD', () => {
    const key = deriveRoomKey('correct horse', roomId, 1000)
    const aad = roomAad(roomId, aliceId)
    const sealed = encryptMessage(key, '你好，世界', aad)

    expect(sealed.iv).toHaveLength(16)
    expect(sealed.ciphertext).not.toContain('你好')
    expect(decryptMessage(key, sealed.iv, sealed.ciphertext, aad)).toBe('你好，世界')
    expect(() =>
      decryptMessage(key, sealed.iv, sealed.ciphertext, roomAad(roomId, bobId)),
    ).toThrow()
  })

  it('uses a fresh IV and rejects the wrong passphrase', () => {
    const key = deriveRoomKey('correct horse', roomId, 1000)
    const aad = roomAad(roomId, aliceId)
    const first = encryptMessage(key, 'same text', aad)
    const second = encryptMessage(key, 'same text', aad)

    expect(first.iv).not.toBe(second.iv)
    expect(first.ciphertext).not.toBe(second.ciphertext)

    const wrongKey = deriveRoomKey('wrong horse', roomId, 1000)
    expect(() => decryptMessage(wrongKey, first.iv, first.ciphertext, aad)).toThrow()
  })

  it('rejects passphrases shorter than six characters', () => {
    expect(() => deriveRoomKey('12345', roomId)).toThrow()
  })
})
