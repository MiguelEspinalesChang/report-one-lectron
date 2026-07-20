<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  delta?: { value: string; direction: 'up' | 'down' }
  comparison?: string
}>()
</script>

<template>
  <div class="island">
    <p class="text-[13px] text-slate-500">{{ label }}</p>
    <p class="mt-1 text-[26px] font-bold text-slate-900">{{ value }}</p>
    <div v-if="delta || comparison" class="mt-2 flex items-center gap-2">
      <span
        v-if="delta"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
        :class="delta.direction === 'up' ? 'bg-success-50 text-success-800' : 'bg-danger-50 text-danger-800'"
      >
        <svg
          class="size-3"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path v-if="delta.direction === 'up'" d="M6 15 12 9l6 6" />
          <path v-else d="M6 9l6 6 6-6" />
        </svg>
        {{ delta.value }}
      </span>
      <span v-if="comparison" class="text-xs text-slate-500">{{ comparison }}</span>
    </div>
  </div>
</template>
