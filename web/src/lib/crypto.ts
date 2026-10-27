import { gcm } from '@noble/ciphers/aes'
import { pbkdf2 } from '@noble/hashes/pbkdf2'
import { sha256 } from '@noble/hashes/sha256'
import { base64Decode, base64Encode, randomBytes, utf8Decode, utf8Encode } from './bytes'

export const PBKDF2_ITERATIONS = 210_000
export const MIN_PASSPHRASE_LENGTH = 6

export interface SealedMessage {
  iv: string
  ciphertext: string
}

export function deriveRoomKey(passphrase: string, roomId: string, iterations = PBKDF2_ITERATIONS): Uint8Array {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`口令至少需要 ${MIN_PASSPHRASE_LENGTH} 位`)
  }
  return pbkdf2(sha256, utf8Encode(passphrase), utf8Encode(roomId), {
    c: iterations,
    dkLen: 32,
  })
}

export function roomAad(roomId: string, senderId: string): string {
  return `${roomId}:${senderId}`
}

export function encryptMessage(key: Uint8Array, text: string, aad: string): SealedMessage {
  const iv = randomBytes(12)
  const ciphertext = gcm(key, iv, utf8Encode(aad)).encrypt(utf8Encode(text))
  return { iv: base64Encode(iv), ciphertext: base64Encode(ciphertext) }
}

export function decryptMessage(key: Uint8Array, iv: string, ciphertext: string, aad: string): string {
  const ivBytes = base64Decode(iv)
  if (ivBytes.length !== 12) throw new Error('无效的消息 IV')
  const plaintext = gcm(key, ivBytes, utf8Encode(aad)).decrypt(base64Decode(ciphertext))
  return utf8Decode(plaintext)
}

export function encodeKey(key: Uint8Array): string {
  return base64Encode(key)
}

export function decodeKey(value: string): Uint8Array {
  const key = base64Decode(value)
  if (key.length !== 32) throw new Error('无效的房间密钥')
  return key
}
