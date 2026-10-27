import { reactive } from 'vue'

export type ToastKind = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

export const toasts = reactive<ToastItem[]>([])

let sequence = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()

export function dismissToast(id: number): void {
  const index = toasts.findIndex((item) => item.id === id)
  if (index >= 0) toasts.splice(index, 1)
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

export function showToast(text: string, kind: ToastKind = 'info', duration = 3200): void {
  const id = (sequence += 1)
  toasts.push({ id, kind, text })
  if (toasts.length > 4) {
    dismissToast(toasts[0].id)
  }
  const timer = setTimeout(() => {
    timers.delete(id)
    dismissToast(id)
  }, duration)
  timers.set(id, timer)
}

export const toast = {
  info: (text: string) => showToast(text, 'info'),
  success: (text: string) => showToast(text, 'success'),
  error: (text: string) => showToast(text, 'error'),
}
