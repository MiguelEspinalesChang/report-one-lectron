// Thin shim — delegates to useToastStore (Pinia).
// useApiCall.ts calls show() via this composable.
export type { ToastKind, Toast } from '../stores/toast'
export { useToastStore as useToast } from '../stores/toast'
