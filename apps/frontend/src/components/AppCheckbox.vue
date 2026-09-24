<script setup lang="ts">
defineProps<{
  modelValue: boolean
  disabled?: boolean
  label?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function onChange(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<template>
  <label class="inline-flex items-center gap-2" :class="disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'">
    <span class="relative inline-flex size-5 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        class="peer sr-only"
        :checked="modelValue"
        :disabled="disabled"
        @change="onChange"
      />
      <span
        class="absolute inset-0 rounded-md border border-slate-300 bg-white transition-colors peer-checked:border-primary-600 peer-checked:bg-primary-600 peer-focus-visible:shadow-ring"
      />
      <svg
        v-if="modelValue"
        class="relative size-3 text-white"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
    <span v-if="label" class="text-sm text-slate-700">{{ label }}</span>
  </label>
</template>
