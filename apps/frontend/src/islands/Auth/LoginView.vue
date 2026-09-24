<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppInput from '../../components/AppInput.vue'
import AppPasswordInput from '../../components/AppPasswordInput.vue'
import { useApiCall } from '../../composables/useApiCall'
import { useSessionStore } from '../../stores/session'

const { t } = useI18n()
const router = useRouter()
const sessionStore = useSessionStore()
const { loading, call } = useApiCall()

const username = ref('')
const password = ref('')

async function submit(): Promise<void> {
  // The closure returns true so success is observable directly — call()
  // returns undefined both for a void success and for a caught error.
  const ok = await call(async () => {
    await sessionStore.login(username.value, password.value)
    return true
  })
  if (ok !== true || sessionStore.session === null) return
  if (sessionStore.session.mustChangePassword) {
    await router.push({ name: 'change-password' })
  } else {
    await router.push({ name: 'dashboard' })
  }
}
</script>

<template>
  <div class="island w-full">
    <h1 class="mb-6 text-xl font-semibold text-slate-900">{{ t('auth.title') }}</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <AppInput
        v-model="username"
        :label="t('auth.username')"
        :placeholder="t('auth.username')"
        autocomplete="username"
        :disabled="loading"
      />
      <AppPasswordInput
        v-model="password"
        :label="t('auth.password')"
        :placeholder="t('auth.password')"
        autocomplete="current-password"
        :disabled="loading"
        :show-password-label="t('auth.showPassword')"
        :hide-password-label="t('auth.hidePassword')"
      />
      <button type="submit" class="btn btn-primary w-full" :disabled="loading">
        {{ loading ? t('auth.signingIn') : t('auth.signIn') }}
      </button>
    </form>
  </div>
</template>
