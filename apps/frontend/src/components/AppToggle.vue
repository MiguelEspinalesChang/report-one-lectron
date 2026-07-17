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
    <span v-if="label" class="text-sm text-slate-700">{{ label }}</span>
    <span class="relative inline-flex h-6 w-11 items-center">
      <input
        type="checkbox"
        class="peer sr-only"
        :checked="modelValue"
        :disabled="disabled"
        @change="onChange"
      />
      <span
        class="h-6 w-11 rounded-full border border-slate-300 bg-slate-200 transition-colors peer-checked:border-success-600 peer-checked:bg-success-600"
      />
      <span
        class="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
      />
    </span>
  </label>
</template>
