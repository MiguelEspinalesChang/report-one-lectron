import type { SessionUserDto } from '@platform/shared-types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSessionStore = defineStore('session', () => {
  const session = ref<SessionUserDto | null>(null)
  const restored = ref(false)
  let restorePromise: Promise<void> | null = null

  /**
   * Idempotent — getSession() fires at most once per app lifecycle.
   * Concurrent callers (overlapping router guards on first load) all await
   * the same in-flight promise instead of issuing duplicate IPC calls.
   */
  async function restore(): Promise<void> {
    if (restored.value) return
    // On rejection the cached promise must be dropped — otherwise every future
    // restore() re-throws the same stale error and navigation is dead forever.
    restorePromise ??= window.platform.auth
      .getSession()
      .then((s) => {
        session.value = s
        restored.value = true
      })
      .catch((err: unknown) => {
        restorePromise = null
        throw err
      })
    return restorePromise
  }

  async function login(username: string, password: string): Promise<void> {
    session.value = await window.platform.auth.login({ username, password })
  }

  async function logout(): Promise<void> {
    await window.platform.auth.logout()
    session.value = null
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!session.value) throw new Error('No active session')
    await window.platform.auth.changePassword({
      userId: session.value.id,
      currentPassword,
      newPassword,
    })
    // Clear mustChangePassword flag locally — backend confirmed the change
    session.value = { ...session.value, mustChangePassword: false }
  }

  function hasPermission(code: string): boolean {
    return session.value?.permissionCodes.includes(code) ?? false
  }

  return { session, restored, restore, login, logout, changePassword, hasPermission }
})
