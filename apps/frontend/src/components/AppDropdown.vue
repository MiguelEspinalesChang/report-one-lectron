<script setup lang="ts">
export interface DropdownItem {
  label: string
  onClick: () => void
  danger?: boolean
}

defineProps<{
  triggerId: string
  menuId: string
  items: DropdownItem[]
  /** Overrides the trigger's styling. Defaults to the shared `.btn` look;
   * pass a custom class for a lighter trigger (e.g. the topbar user chip). */
  triggerClass?: string
}>()
</script>

<template>
  <div class="hs-dropdown relative inline-flex">
    <button
      :id="triggerId"
      type="button"
      class="hs-dropdown-toggle"
      :class="triggerClass ?? 'btn'"
      aria-haspopup="menu"
      aria-expanded="false"
      :aria-controls="menuId"
    >
      <slot />
    </button>

    <div
      :id="menuId"
      class="hs-dropdown-menu z-10 hidden min-w-[10rem] divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-md"
      role="menu"
      :aria-labelledby="triggerId"
    >
      <div class="p-1">
        <button
          v-for="item in items"
          :key="item.label"
          type="button"
          class="flex w-full items-center rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="
            item.danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-slate-700 hover:bg-primary-50 hover:text-primary-700'
          "
          role="menuitem"
          @click="item.onClick()"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </div>
</template>
