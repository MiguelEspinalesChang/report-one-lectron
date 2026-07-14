<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppModal from './AppModal.vue'

defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel: string
  variant?: 'danger' | 'primary'
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

function cancel(): void {
  emit('update:open', false)
  emit('cancel')
}
</script>

<template>
  <AppModal :open="open" @update:open="emit('update:open', $event)" @close="cancel">
    <template #title>{{ title }}</template>
    <template #body>
      <p class="text-sm text-slate-600">{{ message }}</p>
    </template>
    <template #footer>
      <button type="button" class="btn" @click="cancel">{{ t('common.cancel') }}</button>
      <button
        type="button"
        class="btn"
        :class="variant === 'danger' ? 'btn-danger' : 'btn-primary'"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </button>
    </template>
  </AppModal>
</template>
