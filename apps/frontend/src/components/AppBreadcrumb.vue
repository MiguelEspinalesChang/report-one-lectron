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

interface ParentMeta {
  path: string
  breadcrumb: string
}

const items = computed<BreadcrumbItem[]>(() => {
  const matched = route.matched.filter((r) => r.meta.breadcrumb != null)
  const result: BreadcrumbItem[] = []

  // If the current route has a parent, inject it first
  const currentMeta = matched[matched.length - 1]?.meta
  const parent = currentMeta?.parent as ParentMeta | undefined
  if (parent) {
    result.push({
      label: t(parent.breadcrumb),
      to: parent.path,
    })
  }

  // Then add the matched routes
  matched.forEach((r, idx) => {
    result.push({
      label: t(r.meta.breadcrumb as string),
      to: idx < matched.length - 1 ? (r.path || '/') : null,
    })
  })

  return result
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
      <RouterLink v-if="item.to" :to="item.to" class="text-slate-500 hover:text-primary-600">
        {{ item.label }}
      </RouterLink>
      <span v-else class="font-medium text-slate-800">{{ item.label }}</span>
    </template>
  </nav>
</template>
