import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DomainErrorName } from '@platform/shared-types'
import { DomainErrorNames } from '@platform/shared-types'
import { useToastStore } from '../stores/toast'

// Known domain error names from shared-types. Electron's structured-clone serialization
// preserves the Error .name property, so we match on error.name. If for any reason
// only .message survives serialization, the generic fallback fires instead — safe
// and visible, just less specific.
const DOMAIN_ERROR_KEYS: Record<DomainErrorName, string> = {
  [DomainErrorNames.InvalidCredentialsError]: 'errors.invalidCredentials',
  [DomainErrorNames.InactiveUserError]: 'errors.inactiveUser',
  [DomainErrorNames.WeakPasswordError]: 'errors.weakPassword',
  [DomainErrorNames.RoleNotFoundError]: 'errors.roleNotFound',
  [DomainErrorNames.UserNotFoundError]: 'errors.userNotFound',
  [DomainErrorNames.BrandInUseError]: 'errors.brandInUse',
  [DomainErrorNames.BrandNotFoundError]: 'errors.brandNotFound',
  [DomainErrorNames.MeterModelInUseError]: 'errors.meterModelInUse',
  [DomainErrorNames.MeterModelNotFoundError]: 'errors.meterModelNotFound',
  [DomainErrorNames.InvalidRegisterMapError]: 'errors.invalidRegisterMap',
  [DomainErrorNames.DeviceNotFoundError]: 'errors.deviceNotFound',
  [DomainErrorNames.TransportMismatchError]: 'errors.transportMismatch',
  [DomainErrorNames.InvalidConnectionError]: 'errors.invalidConnection',
}

export function useApiCall() {
  const loading = ref(false)
  const { t } = useI18n()
  const { show } = useToastStore()

  async function call<T>(fn: () => Promise<T>): Promise<T | undefined> {
    loading.value = true
    try {
      const result = await fn()
      return result
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      const i18nKey = (DOMAIN_ERROR_KEYS as Record<string, string>)[name] ?? 'errors.generic'
      show('error', t(i18nKey))
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, call }
}
