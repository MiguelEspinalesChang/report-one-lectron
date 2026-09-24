<script setup lang="ts">
defineProps<{
  label: string
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
  variant?: 'soft' | 'outline'
}>()
</script>

<template>
  <span
    v-if="(variant ?? 'soft') === 'soft'"
    class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
    :class="{
      'border-slate-200 bg-slate-100 text-slate-700': (tone ?? 'neutral') === 'neutral',
      'border-primary-200 bg-primary-50 text-primary-800': tone === 'primary',
      'border-success-200 bg-success-50 text-success-800': tone === 'success',
      'border-warning-200 bg-warning-50 text-warning-800': tone === 'warning',
      'border-danger-200 bg-danger-50 text-danger-800': tone === 'danger',
    }"
  >
    {{ label }}
  </span>
  <span
    v-else
    class="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 text-xs font-semibold"
    :class="{
      'border-slate-300 text-slate-700': (tone ?? 'neutral') === 'neutral',
      'border-primary-300 text-primary-800': tone === 'primary',
      'border-success-300 text-success-800': tone === 'success',
      'border-warning-600 text-warning-800': tone === 'warning',
      'border-danger-200 text-danger-800': tone === 'danger',
    }"
  >
    <span
      class="size-1.5 rounded-full"
      :class="{
        'bg-slate-500': (tone ?? 'neutral') === 'neutral',
        'bg-primary-500': tone === 'primary',
        'bg-success-500': tone === 'success',
        'bg-warning-600': tone === 'warning',
        'bg-danger-600': tone === 'danger',
      }"
      aria-hidden="true"
    />
    {{ label }}
  </span>
</template>
