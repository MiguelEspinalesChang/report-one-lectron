import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const AUTO_DISMISS_MS = 4000

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 0

  function show(kind: ToastKind, message: string): void {
    const id = ++nextId
    toasts.value.push({ id, kind, message })
    window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }

  function dismiss(id: number): void {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return { toasts, show, dismiss }
})
