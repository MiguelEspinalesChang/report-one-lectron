<script setup lang="ts" generic="T extends string | number">
interface Option {
  value: T
  label: string
}

interface Props {
  modelValue: T
  options: Option[]
  label?: string
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: T): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value as T)
}
</script>

<template>
  <div>
    <label v-if="label" class="mb-1 block text-sm font-medium text-slate-700">{{ label }}</label>
    <select
      :value="modelValue"
      :disabled="disabled"
      class="block w-full rounded-lg border-slate-300 text-sm text-slate-900 focus:border-primary-500 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
      @change="handleChange"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>
