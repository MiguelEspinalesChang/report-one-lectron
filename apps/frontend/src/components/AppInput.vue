<script setup lang="ts">
defineProps<{
  modelValue: string
  label: string
  placeholder?: string
  errorText?: string
  type?: string
  disabled?: boolean
  autocomplete?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div>
    <label class="mb-1 block text-sm font-medium text-slate-700">{{ label }}</label>
    <input
      :value="modelValue"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :disabled="disabled"
      :autocomplete="autocomplete"
      class="block w-full rounded-btn border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-600 focus:shadow-ring disabled:cursor-not-allowed disabled:opacity-50"
      :class="errorText ? 'border-danger-600 focus:border-danger-600 focus:shadow-ring-danger' : ''"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="errorText" class="mt-1 text-xs text-danger-800">{{ errorText }}</p>
  </div>
</template>
