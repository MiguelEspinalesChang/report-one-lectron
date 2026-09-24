<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    variant?: 'soft' | 'solid'
    tone?: 'primary' | 'success'
    size?: 'sm' | 'md' | 'lg'
    online?: boolean
  }>(),
  {
    variant: 'soft',
    tone: 'primary',
    size: 'md',
  },
)

const initials = computed(() => {
  const words = props.name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return words.map((word) => word.charAt(0).toUpperCase()).join('')
})

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
}
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <span
      class="inline-flex items-center justify-center rounded-full font-semibold"
      :class="[
        sizeClasses[size],
        variant === 'solid'
          ? tone === 'success'
            ? 'bg-success-600 text-white'
            : 'bg-primary-600 text-white'
          : tone === 'success'
            ? 'bg-success-50 text-success-800'
            : 'bg-primary-50 text-primary-800',
      ]"
    >
      {{ initials }}
    </span>
    <span
      v-if="online"
      class="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-success-500"
      aria-hidden="true"
    />
  </span>
</template>
