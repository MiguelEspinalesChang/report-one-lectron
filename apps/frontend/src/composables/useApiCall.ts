import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from './useToast'

// Known domain error names from core. Electron's structured-clone serialization
// preserves the Error .name property, so we match on error.name. If for any reason
// only .message survives serialization, the generic fallback fires instead — safe
// and visible, just less specific.
const DOMAIN_ERROR_KEYS: Record<string, string> = {
  InvalidCredentialsError: 'errors.invalidCredentials',
  InactiveUserError: 'errors.inactiveUser',
  BrandInUseError: 'errors.brandInUse',
  MeterModelInUseError: 'errors.meterModelInUse',
  DeviceNotFoundError: 'errors.deviceNotFound',
  TransportMismatchError: 'errors.transportMismatch',
  InvalidConnectionError: 'errors.invalidConnection',
}

export function useApiCall() {
  const loading = ref(false)
  const { t } = useI18n()
  const { show } = useToast()

  async function call<T>(fn: () => Promise<T>): Promise<T | undefined> {
    loading.value = true
    try {
      const result = await fn()
      return result
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      const i18nKey = DOMAIN_ERROR_KEYS[name] ?? 'errors.generic'
      show('error', t(i18nKey))
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, call }
}
