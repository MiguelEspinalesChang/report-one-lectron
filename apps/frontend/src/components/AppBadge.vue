<script setup lang="ts">
defineProps<{
  label: string
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
}>()
</script>

<template>
  <span
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
</template>
