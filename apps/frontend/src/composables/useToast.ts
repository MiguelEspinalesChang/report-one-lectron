import { reactive } from 'vue'

export type ToastKind = 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

let nextId = 0
const AUTO_DISMISS_MS = 4000

// Module-scoped reactive queue — shared by all consumers without a store.
const toasts = reactive<Toast[]>([])

export function useToast() {
  function show(kind: ToastKind, message: string): void {
    const id = ++nextId
    toasts.push({ id, kind, message })
    window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }

  function dismiss(id: number): void {
    const idx = toasts.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.splice(idx, 1)
  }

  return { toasts, show, dismiss }
}
