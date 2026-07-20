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
  errorText?: string
}

interface Emits {
  (e: 'update:modelValue', value: T): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const selected = props.options.find((option) => String(option.value) === target.value)
  if (selected) {
    emit('update:modelValue', selected.value)
    return
  }
  emit('update:modelValue', target.value as T)
}
</script>

<template>
  <div>
    <label v-if="label" class="mb-1 block text-sm font-medium text-slate-700">{{ label }}</label>
    <select
      :value="modelValue"
      :disabled="disabled"
      class="block w-full rounded-btn border-slate-300 text-sm text-slate-900 focus:border-primary-600 focus:shadow-ring disabled:cursor-not-allowed disabled:opacity-50"
      :class="errorText ? 'border-danger-600 focus:border-danger-600 focus:shadow-ring-danger' : ''"
      @change="handleChange"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <p v-if="errorText" class="mt-1 text-xs text-danger-800">{{ errorText }}</p>
  </div>
</template>
