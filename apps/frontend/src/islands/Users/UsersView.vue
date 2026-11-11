<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserDto } from '@platform/shared-types'
import AppBadge from '../../components/AppBadge.vue'
import AppInput from '../../components/AppInput.vue'
import AppModal from '../../components/AppModal.vue'
import AppPasswordInput from '../../components/AppPasswordInput.vue'
import AppSelect from '../../components/AppSelect.vue'
import AppTable from '../../components/AppTable.vue'
import AppToggle from '../../components/AppToggle.vue'
import { useApiCall } from '../../composables/useApiCall'
import { useSessionStore } from '../../stores/session'
import { useToastStore } from '../../stores/toast'
import { useUsersStore } from '../../stores/users'
import {
  DEFAULT_GENERATED_LENGTH,
  MAX_GENERATED_LENGTH,
  MIN_GENERATED_LENGTH,
  generatePassword,
} from '../../utils/password-generator'

const PASSWORD_MIN_LENGTH = 8
const USERNAME_MAX_LENGTH = 64
const DISPLAY_NAME_MAX_LENGTH = 128

const generatedLengthOptions = Array.from(
  { length: MAX_GENERATED_LENGTH - MIN_GENERATED_LENGTH + 1 },
  (_, index) => {
    const value = MIN_GENERATED_LENGTH + index
    return { value, label: String(value) }
  },
)

/**
 * Forces `AppPasswordInput`'s `revealed` prop to re-trigger even when it was
 * already `true` (e.g. the admin manually hid the field, then generated a
 * new password): flip to `false` and back on the next tick so the watcher
 * always fires and the freshly generated value ends up visible.
 */
async function revealGeneratedPassword(target: { value: boolean }): Promise<void> {
  target.value = false
  await nextTick()
  target.value = true
}

const { t, locale } = useI18n()
const usersStore = useUsersStore()
const sessionStore = useSessionStore()
const toastStore = useToastStore()
const { loading, call } = useApiCall()

async function copyPassword(value: string): Promise<void> {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    toastStore.show('success', t('users.passwordCopied'))
  } catch {
    // Clipboard API may be unavailable (permissions, insecure context) —
    // fail silently, the generated value is still visible on screen.
  }
}

// Roles come from core (app.db, seeded system roles) — never hardcode ids
// here, they're wired end-to-end via platform.users.listRoles().
const roleOptions = computed(() =>
  usersStore.roles.map((role) => ({
    value: role.id,
    label: t(`users.roles.${role.name}`),
  })),
)

function defaultRoleId(): number {
  return usersStore.roles[0]?.id ?? 0
}

const usersRows = computed(() => {
  return usersStore.users.map((user) => ({
    ...user,
    createdAtLabel: formatEpoch(user.createdAt),
  }))
})

onMounted(async () => {
  await call(async () => {
    await Promise.all([usersStore.loadUsers(), usersStore.loadRoles()])
  })
  createRoleId.value = defaultRoleId()
})

const createOpen = ref(false)
const createUsername = ref('')
const createPassword = ref('')
const createPasswordConfirm = ref('')
const createPasswordRevealed = ref(false)
const createGeneratedLength = ref<number>(DEFAULT_GENERATED_LENGTH)
const createDisplayName = ref('')
const createRoleId = ref<number>(0)
const createMustChangePassword = ref(true)

const createErrors = computed(() => {
  const errors: string[] = []
  const username = createUsername.value.trim()
  const displayName = createDisplayName.value.trim()

  if (username.length === 0) errors.push(t('users.validation.usernameRequired'))
  if (username.length > USERNAME_MAX_LENGTH) {
    errors.push(t('users.validation.usernameTooLong', { max: USERNAME_MAX_LENGTH }))
  }

  if (createPassword.value.length < PASSWORD_MIN_LENGTH) {
    errors.push(t('users.validation.passwordMin', { min: PASSWORD_MIN_LENGTH }))
  }
  if (createPasswordConfirm.value !== createPassword.value) {
    errors.push(t('auth.passwordMismatch'))
  }

  if (displayName.length === 0) errors.push(t('users.validation.displayNameRequired'))
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.push(t('users.validation.displayNameTooLong', { max: DISPLAY_NAME_MAX_LENGTH }))
  }

  if (!usersStore.roles.some((role) => role.id === createRoleId.value)) {
    errors.push(t('users.validation.roleRequired'))
  }

  return errors
})

const createValid = computed(() => createErrors.value.length === 0)

function openCreate(): void {
  createUsername.value = ''
  createPassword.value = ''
  createPasswordConfirm.value = ''
  createPasswordRevealed.value = false
  createGeneratedLength.value = DEFAULT_GENERATED_LENGTH
  createDisplayName.value = ''
  createRoleId.value = defaultRoleId()
  createMustChangePassword.value = true
  createOpen.value = true
}

async function generateCreatePassword(): Promise<void> {
  const generated = generatePassword(createGeneratedLength.value)
  createPassword.value = generated
  createPasswordConfirm.value = generated
  await revealGeneratedPassword(createPasswordRevealed)
}

function userRowKey(user: UserDto): number {
  return user.id
}

function isSelf(user: UserDto): boolean {
  return sessionStore.session?.id === user.id
}

function isAdminUser(user: UserDto): boolean {
  return usersStore.roles.some((role) => role.id === user.roleId && role.name === 'admin')
}

function mustChangeBadgeTone(mustChange: boolean): 'warning' | 'neutral' {
  return mustChange ? 'warning' : 'neutral'
}

async function submitCreate(): Promise<void> {
  if (!createValid.value) return

  const created = await call(() =>
    usersStore.createUser({
      username: createUsername.value.trim(),
      password: createPassword.value,
      displayName: createDisplayName.value.trim(),
      roleId: createRoleId.value,
      mustChangePassword: createMustChangePassword.value,
    }),
  )

  if (created) {
    createOpen.value = false
    toastStore.show('success', t('users.created'))
  }
}

async function updateRole(user: UserDto, roleId: number): Promise<void> {
  if (user.roleId === roleId) return

  const ok = await call(async () => {
    await usersStore.assignRole(user.id, roleId)
    return true
  })

  if (ok) {
    toastStore.show('success', t('users.roleUpdated'))
  }
}

async function setActive(user: UserDto, isActive: boolean): Promise<void> {
  if (user.isActive === isActive || isSelf(user)) return

  const ok = await call(async () => {
    await usersStore.setActive(user.id, isActive)
    return true
  })

  if (ok) {
    toastStore.show('success', t('users.statusUpdated'))
  }
}

const resetPasswordOpen = ref(false)
const resetPasswordTarget = ref<UserDto | null>(null)
const resetPasswordValue = ref('')
const resetPasswordConfirm = ref('')
const resetPasswordRevealed = ref(false)
const resetGeneratedLength = ref<number>(DEFAULT_GENERATED_LENGTH)

const resetPasswordErrors = computed(() => {
  const errors: string[] = []
  if (resetPasswordValue.value.length < PASSWORD_MIN_LENGTH) {
    errors.push(t('auth.passwordMin', { min: PASSWORD_MIN_LENGTH }))
  }
  if (resetPasswordConfirm.value !== resetPasswordValue.value) {
    errors.push(t('auth.passwordMismatch'))
  }
  return errors
})

const resetPasswordValid = computed(() => resetPasswordErrors.value.length === 0)

function openResetPassword(user: UserDto): void {
  resetPasswordTarget.value = user
  resetPasswordValue.value = ''
  resetPasswordConfirm.value = ''
  resetPasswordRevealed.value = false
  resetGeneratedLength.value = DEFAULT_GENERATED_LENGTH
  resetPasswordOpen.value = true
}

async function generateResetPassword(): Promise<void> {
  const generated = generatePassword(resetGeneratedLength.value)
  resetPasswordValue.value = generated
  resetPasswordConfirm.value = generated
  await revealGeneratedPassword(resetPasswordRevealed)
}

async function submitResetPassword(): Promise<void> {
  const target = resetPasswordTarget.value
  if (target === null || !resetPasswordValid.value) return

  const ok = await call(async () => {
    await usersStore.resetPassword(target.id, resetPasswordValue.value)
    return true
  })

  if (ok) {
    resetPasswordOpen.value = false
    toastStore.show('success', t('users.resetPasswordSuccess'))
  }
}

function formatEpoch(value: number): string {
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold text-slate-900">{{ t('users.title') }}</h1>

    <div class="island">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-semibold text-slate-900">{{ t('users.title') }}</h2>
        <button type="button" class="btn btn-primary" :disabled="loading" @click="openCreate">
          {{ t('users.new') }}
        </button>
      </div>

      <AppTable
        :rows="usersRows"
        :loading="loading"
        :row-key="userRowKey"
        :empty-message="t('users.empty')"
      >
        <template #header>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('users.columns.username') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('users.columns.displayName') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('users.columns.role') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('users.columns.active') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('users.columns.mustChangePassword') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('users.columns.createdAt') }}
          </th>
          <th class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {{ t('users.columns.actions') }}
          </th>
        </template>
        <template #row="{ row }">
          <td class="px-4 py-3 text-sm text-slate-700">{{ row.username }}</td>
          <td class="px-4 py-3 text-sm text-slate-700">{{ row.displayName }}</td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <AppSelect
              :model-value="row.roleId"
              :options="roleOptions"
              :disabled="loading"
              @update:model-value="updateRole(row, $event)"
            />
          </td>
          <td class="px-4 py-3 text-sm">
            <span :title="isSelf(row) ? t('users.cannotDeactivateSelf') : undefined">
              <AppToggle
                :model-value="row.isActive"
                :label="row.isActive ? t('users.active') : t('users.inactive')"
                :disabled="loading || isSelf(row)"
                @update:model-value="setActive(row, $event)"
              />
            </span>
          </td>
          <td class="px-4 py-3 text-sm">
            <AppBadge
              :label="row.mustChangePassword ? t('users.mustChange') : t('users.passwordOk')"
              :tone="mustChangeBadgeTone(row.mustChangePassword)"
            />
          </td>
          <td class="px-4 py-3 text-sm text-slate-500">{{ row.createdAtLabel }}</td>
          <td class="px-4 py-3 text-sm">
            <button
              v-if="!isAdminUser(row)"
              type="button"
              class="btn"
              :disabled="loading"
              @click="openResetPassword(row)"
            >
              {{ t('users.resetPassword') }}
            </button>
          </td>
        </template>
      </AppTable>
    </div>

    <AppModal v-model:open="createOpen">
      <template #title>{{ t('users.createTitle') }}</template>
      <template #body>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AppInput
            v-model="createUsername"
            :label="t('users.form.username')"
            :placeholder="t('users.form.usernamePlaceholder')"
            :disabled="loading"
          />
          <AppInput
            v-model="createDisplayName"
            :label="t('users.form.displayName')"
            :placeholder="t('users.form.displayNamePlaceholder')"
            :disabled="loading"
          />
          <AppPasswordInput
            v-model="createPassword"
            :label="t('users.form.password')"
            :placeholder="t('users.form.passwordPlaceholder')"
            :disabled="loading"
            :show-password-label="t('auth.showPassword')"
            :hide-password-label="t('auth.hidePassword')"
            :revealed="createPasswordRevealed"
          />
          <AppPasswordInput
            v-model="createPasswordConfirm"
            :label="t('users.form.confirmPassword')"
            :disabled="loading"
            :show-password-label="t('auth.showPassword')"
            :hide-password-label="t('auth.hidePassword')"
            :revealed="createPasswordRevealed"
          />
          <AppSelect
            v-model="createRoleId"
            :label="t('users.form.role')"
            :options="roleOptions"
            :disabled="loading"
          />
          <div class="flex flex-wrap items-end gap-3">
            <div class="w-24">
              <AppSelect
                v-model="createGeneratedLength"
                :label="t('users.form.generatedLength')"
                :options="generatedLengthOptions"
                :disabled="loading"
              />
            </div>
            <button type="button" class="btn" :disabled="loading" @click="generateCreatePassword">
              {{ t('users.form.generatePassword') }}
            </button>
            <button
              type="button"
              class="btn"
              :disabled="loading || !createPassword"
              @click="copyPassword(createPassword)"
            >
              {{ t('users.form.copyPassword') }}
            </button>
          </div>
          <div class="md:col-span-2">
            <AppToggle
              v-model="createMustChangePassword"
              :label="t('users.form.mustChangePassword')"
              :disabled="loading"
            />
          </div>
        </div>

        <ul v-if="createErrors.length > 0" class="mt-4 list-disc space-y-1 pl-5 text-sm text-red-600">
          <li v-for="error in createErrors" :key="error">{{ error }}</li>
        </ul>
      </template>
      <template #footer>
        <button type="button" class="btn" @click="createOpen = false">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || !createValid"
          @click="submitCreate"
        >
          {{ t('common.save') }}
        </button>
      </template>
    </AppModal>

    <AppModal v-model:open="resetPasswordOpen">
      <template #title>{{ t('users.resetPasswordTitle') }}</template>
      <template #body>
        <div class="space-y-4">
          <AppPasswordInput
            v-model="resetPasswordValue"
            :label="t('auth.newPassword')"
            :disabled="loading"
            :show-password-label="t('auth.showPassword')"
            :hide-password-label="t('auth.hidePassword')"
            :revealed="resetPasswordRevealed"
          />
          <AppPasswordInput
            v-model="resetPasswordConfirm"
            :label="t('auth.confirmPassword')"
            :disabled="loading"
            :show-password-label="t('auth.showPassword')"
            :hide-password-label="t('auth.hidePassword')"
            :revealed="resetPasswordRevealed"
          />
          <div class="flex flex-wrap items-end gap-3">
            <div class="w-24">
              <AppSelect
                v-model="resetGeneratedLength"
                :label="t('users.form.generatedLength')"
                :options="generatedLengthOptions"
                :disabled="loading"
              />
            </div>
            <button type="button" class="btn" :disabled="loading" @click="generateResetPassword">
              {{ t('users.form.generatePassword') }}
            </button>
            <button
              type="button"
              class="btn"
              :disabled="loading || !resetPasswordValue"
              @click="copyPassword(resetPasswordValue)"
            >
              {{ t('users.form.copyPassword') }}
            </button>
          </div>
        </div>

        <ul v-if="resetPasswordErrors.length > 0" class="mt-4 list-disc space-y-1 pl-5 text-sm text-red-600">
          <li v-for="error in resetPasswordErrors" :key="error">{{ error }}</li>
        </ul>
      </template>
      <template #footer>
        <button type="button" class="btn" @click="resetPasswordOpen = false">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || !resetPasswordValid"
          @click="submitResetPassword"
        >
          {{ t('common.save') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
