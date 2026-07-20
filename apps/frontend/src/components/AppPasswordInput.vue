<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  modelValue: string
  label: string
  placeholder?: string
  errorText?: string
  disabled?: boolean
  autocomplete?: string
  showPasswordLabel: string
  hidePasswordLabel: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const visible = ref(false)
</script>

<template>
  <div>
    <label class="mb-1 block text-sm font-medium text-slate-700">{{ label }}</label>
    <div class="relative">
      <input
        :value="modelValue"
        :type="visible ? 'text' : 'password'"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        class="block w-full rounded-btn border-slate-300 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-600 focus:shadow-ring disabled:cursor-not-allowed disabled:opacity-50"
        :class="errorText ? 'border-danger-600 focus:border-danger-600 focus:shadow-ring-danger' : ''"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        :aria-label="visible ? hidePasswordLabel : showPasswordLabel"
        class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
        @click="visible = !visible"
      >
        <!-- Eye icon (show) -->
        <svg
          v-if="!visible"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <!-- Eye-off icon (hide) -->
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        >
          <path
            d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
          />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      </button>
    </div>
    <p v-if="errorText" class="mt-1 text-xs text-danger-800">{{ errorText }}</p>
  </div>
</template>
