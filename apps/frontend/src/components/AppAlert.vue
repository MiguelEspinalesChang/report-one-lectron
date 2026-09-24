<script setup lang="ts">
defineProps<{
  variant: 'success' | 'info' | 'danger'
  title: string
  description?: string
}>()
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-card border p-4"
    :class="{
      'border-success-200 bg-success-50': variant === 'success',
      'border-primary-200 bg-primary-50': variant === 'info',
      'border-danger-200 bg-danger-50': variant === 'danger',
    }"
  >
    <span
      class="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
      :class="{
        'bg-success-600': variant === 'success',
        'bg-primary-600': variant === 'info',
        'bg-danger-600': variant === 'danger',
      }"
    >
      <svg
        v-if="variant === 'success'"
        class="size-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
      <svg
        v-else-if="variant === 'info'"
        class="size-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M11.25 11.25h.008v4.5h-.008v-4.5ZM12 7.5h.008v.008H12V7.5Z"
        />
        <circle cx="12" cy="12" r="9" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <svg
        v-else
        class="size-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
    </span>
    <div class="min-w-0">
      <p
        class="font-bold"
        :class="{
          'text-success-800': variant === 'success',
          'text-primary-800': variant === 'info',
          'text-danger-800': variant === 'danger',
        }"
      >
        {{ title }}
      </p>
      <p v-if="description" class="mt-0.5 text-sm text-slate-700">{{ description }}</p>
    </div>
  </div>
</template>
