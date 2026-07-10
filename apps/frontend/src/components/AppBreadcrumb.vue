<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()

interface BreadcrumbItem {
  label: string
  to: string | null
}

const items = computed<BreadcrumbItem[]>(() => {
  return route.matched
    .filter((r) => r.meta.breadcrumb != null)
    .map((r, idx, arr) => ({
      label: t(r.meta.breadcrumb as string),
      to: idx < arr.length - 1 ? (r.path || '/') : null,
    }))
})
</script>

<template>
  <nav
    v-if="items.length > 0"
    :aria-label="t('nav.breadcrumbs')"
    class="mb-4 flex items-center gap-x-1 text-sm"
  >
    <template v-for="(item, idx) in items" :key="item.label">
      <span v-if="idx > 0" class="text-slate-400" aria-hidden="true">/</span>
      <RouterLink v-if="item.to" :to="item.to" class="text-slate-500 hover:text-accent-600">
        {{ item.label }}
      </RouterLink>
      <span v-else class="font-medium text-slate-800">{{ item.label }}</span>
    </template>
  </nav>
</template>
