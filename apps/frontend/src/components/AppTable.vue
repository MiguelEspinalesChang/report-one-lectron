<script setup lang="ts" generic="T">
import { useI18n } from 'vue-i18n'
import AppEmptyState from './AppEmptyState.vue'

defineProps<{
  rows: T[]
  loading?: boolean
  emptyMessage: string
  rowKey: (row: T) => string | number
}>()

defineSlots<{
  header(): unknown
  row(props: { row: T }): unknown
}>()

const { t } = useI18n()
</script>

<template>
  <div>
    <div v-if="loading" class="py-10 text-center text-sm text-slate-500">
      {{ t('common.loading') }}
    </div>
    <AppEmptyState v-else-if="rows.length === 0" :message="emptyMessage" />
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100">
        <thead>
          <tr>
            <slot name="header" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="row in rows" :key="rowKey(row)" class="hover:bg-slate-50">
            <slot name="row" :row="row" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
