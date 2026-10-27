import type { Invite } from '../types'
import { base64UrlDecode, base64UrlEncode, isUuid, utf8Decode, utf8Encode } from './bytes'

const MAX_NAME_LENGTH = 48

export function encodeInvite(invite: Invite): string {
  return base64UrlEncode(utf8Encode(JSON.stringify(invite)))
}

export function decodeInvite(code: string): Invite {
  const compact = code.trim().replace(/\s+/g, '')
  if (!compact) throw new Error('请输入邀请码')

  let payload: unknown
  try {
    payload = JSON.parse(utf8Decode(base64UrlDecode(compact)))
  } catch {
    throw new Error('邀请码格式不正确')
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('邀请码格式不正确')
  }
  const data = payload as Record<string, unknown>
  if (data.v !== 1) throw new Error('邀请码版本不支持')
  if (!isUuid(data.r) || !isUuid(data.s)) throw new Error('邀请码内容不完整')
  if (typeof data.n !== 'string') throw new Error('邀请码中的房间名无效')
  const name = data.n.trim()
  if (!name || name.length > MAX_NAME_LENGTH) throw new Error('邀请码中的房间名无效')

  return { v: 1, r: data.r, n: name, s: data.s }
}
