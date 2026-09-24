<script setup lang="ts">
// Plain v-model:active control rather than Preline HSTabs. HSTabs is wired via
// data attributes scanned at autoInit time and expects the DOM to already
// contain both trigger and target markup — it doesn't play well with a single
// active tab driven purely from isla state (v-if'd panels). This stays simple,
// reactive, and needs no re-init after navigation.

export interface TabItem {
  name: string
  label: string
}

defineProps<{
  items: TabItem[]
  active: string
}>()

const emit = defineEmits<{
  (e: 'update:active', name: string): void
}>()
</script>

<template>
  <div>
    <div class="border-b border-line">
      <nav class="-mb-px flex gap-x-6" role="tablist">
        <button
          v-for="item in items"
          :key="item.name"
          type="button"
          role="tab"
          class="border-b-2 px-1 py-3 text-sm font-medium transition-colors"
          :class="
            active === item.name
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
          "
          :aria-selected="active === item.name"
          @click="emit('update:active', item.name)"
        >
          {{ item.label }}
        </button>
      </nav>
    </div>
    <div class="pt-4">
      <slot />
    </div>
  </div>
</template>
