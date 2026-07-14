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
      class="block w-full rounded-lg border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
      :class="errorText ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="errorText" class="mt-1 text-xs text-red-600">{{ errorText }}</p>
  </div>
</template>
