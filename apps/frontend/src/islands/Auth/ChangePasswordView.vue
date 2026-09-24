<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { PASSWORD_MIN_LENGTH } from '@platform/shared-types'
import AppPasswordInput from '../../components/AppPasswordInput.vue'
import { useApiCall } from '../../composables/useApiCall'
import { useSessionStore } from '../../stores/session'
import { useToastStore } from '../../stores/toast'

const { t } = useI18n()
const router = useRouter()
const sessionStore = useSessionStore()
const toastStore = useToastStore()
const { loading, call } = useApiCall()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const confirmError = computed<string | undefined>(() => {
  if (confirmPassword.value.length > 0 && newPassword.value !== confirmPassword.value) {
    return t('auth.passwordMismatch')
  }
  return undefined
})

const newPasswordError = computed<string | undefined>(() => {
  if (newPassword.value.length > 0 && newPassword.value.length < PASSWORD_MIN_LENGTH) {
    return t('auth.passwordMin', { min: PASSWORD_MIN_LENGTH })
  }
  return undefined
})

const canSubmit = computed(
  () =>
    currentPassword.value.length > 0 &&
    newPassword.value.length >= PASSWORD_MIN_LENGTH &&
    newPassword.value === confirmPassword.value,
)

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  // The closure returns true so success is observable directly — call()
  // returns undefined both for a void success and for a caught error.
  const ok = await call(async () => {
    await sessionStore.changePassword(currentPassword.value, newPassword.value)
    return true
  })
  if (ok === true) {
    toastStore.show('success', t('auth.changed'))
    await router.push({ name: 'dashboard' })
  }
}
</script>

<template>
  <div class="island w-full">
    <h1 class="mb-6 text-xl font-semibold text-slate-900">{{ t('auth.changePassword') }}</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <AppPasswordInput
        v-model="currentPassword"
        :label="t('auth.currentPassword')"
        autocomplete="current-password"
        :disabled="loading"
        :show-password-label="t('auth.showPassword')"
        :hide-password-label="t('auth.hidePassword')"
      />
      <AppPasswordInput
        v-model="newPassword"
        :label="t('auth.newPassword')"
        autocomplete="new-password"
        :disabled="loading"
        :error-text="newPasswordError"
        :show-password-label="t('auth.showPassword')"
        :hide-password-label="t('auth.hidePassword')"
      />
      <AppPasswordInput
        v-model="confirmPassword"
        :label="t('auth.confirmPassword')"
        autocomplete="new-password"
        :disabled="loading"
        :error-text="confirmError"
        :show-password-label="t('auth.showPassword')"
        :hide-password-label="t('auth.hidePassword')"
      />
      <button type="submit" class="btn btn-primary w-full" :disabled="loading || !canSubmit">
        {{ loading ? t('auth.changing') : t('auth.changePassword') }}
      </button>
    </form>
  </div>
</template>
