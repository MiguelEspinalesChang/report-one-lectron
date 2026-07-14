<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>

<template>
  <div class="island flex flex-col items-center justify-center gap-3 py-10 text-center">
    <slot name="icon">
      <svg
        class="size-8 text-slate-300"
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
          d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25-2.25M12 13.875V6.75m-6.75.75h13.5c.621 0 1.15-.462 1.185-1.079L20.25 3H3.75l.315 3.421A1.19 1.19 0 0 0 5.25 7.5Z"
        />
      </svg>
    </slot>
    <p class="text-sm text-slate-500">{{ message }}</p>
    <slot name="action" />
  </div>
</template>
