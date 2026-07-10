<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="island">
    <p class="text-sm text-slate-500">{{ t('common.comingSoon') }}</p>
  </div>
</template>
