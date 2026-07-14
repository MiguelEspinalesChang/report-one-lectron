<script setup lang="ts">
import { onBeforeUnmount, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// HSOverlay expects a static DOM node wired up at autoInit time (data attributes +
// click triggers). These modals are opened programmatically from isla state
// (v-model:open), which HSOverlay does not handle reliably — so this wraps its
// own Teleport + backdrop instead, styled with the project's design tokens.
// Cleanup (keydown listener, body scroll lock) is guaranteed both when `open`
// flips to false and on unmount, so no dangling backdrops/listeners survive
// route changes or parent unmounts.

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const titleId = useId()

function close(): void {
  emit('update:open', false)
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

function unlock(): void {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('overflow-hidden')
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('keydown', onKeydown)
      document.body.classList.add('overflow-hidden')
    } else {
      unlock()
    }
  },
  { immediate: true },
)

onBeforeUnmount(unlock)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-slate-900/50" @click="close" />
      <div
        class="island relative z-10 w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <h2 :id="titleId" class="text-lg font-semibold text-slate-900">
            <slot name="title" />
          </h2>
          <button
            type="button"
            class="btn-ghost btn -m-1.5 rounded-full p-1.5"
            :aria-label="t('common.close')"
            @click="close"
          >
            <svg
              class="size-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="mb-6">
          <slot name="body" />
        </div>
        <div class="flex justify-end gap-2">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
