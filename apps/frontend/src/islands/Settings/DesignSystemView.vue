<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import AppAlert from '../../components/AppAlert.vue'
import AppBadge from '../../components/AppBadge.vue'
import AppCheckbox from '../../components/AppCheckbox.vue'
import AppInput from '../../components/AppInput.vue'
import AppSelect from '../../components/AppSelect.vue'
import AppToggle from '../../components/AppToggle.vue'
import AvatarInitials from '../../components/AvatarInitials.vue'
import KpiCard from '../../components/KpiCard.vue'

// This view is pure presentation: it documents the real base components with
// example data. No window.platform, no stores — see the T5 task brief.
const { t } = useI18n()

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
const BADGE_TONES: BadgeTone[] = ['neutral', 'primary', 'success', 'warning', 'danger']

interface PaletteSwatch {
  step: string
  hex: string
}

interface PaletteCard {
  key: string
  nameKey: string
  swatches: PaletteSwatch[]
}

// Hex values match the @theme tokens in assets/main.css (section 2 of the
// redesign plan). Slate uses Tailwind's default scale — no project token.
const PALETTE_CARDS: PaletteCard[] = [
  {
    key: 'primary',
    nameKey: 'designSystem.sections.palette.primary',
    swatches: [
      { step: '50', hex: '#e8f0fd' },
      { step: '200', hex: '#b9d0f6' },
      { step: '400', hex: '#5b8de8' },
      { step: '600', hex: '#2f6fe0' },
      { step: '800', hex: '#1d54b8' },
    ],
  },
  {
    key: 'success',
    nameKey: 'designSystem.sections.palette.success',
    swatches: [
      { step: '50', hex: '#e3f5ef' },
      { step: '200', hex: '#c4e8db' },
      { step: '400', hex: '#3cb693' },
      { step: '600', hex: '#129573' },
      { step: '800', hex: '#0d7259' },
    ],
  },
  {
    key: 'slate',
    nameKey: 'designSystem.sections.palette.slate',
    swatches: [
      { step: '50', hex: '#f8fafc' },
      { step: '200', hex: '#e2e8f0' },
      { step: '400', hex: '#94a3b8' },
      { step: '600', hex: '#475569' },
      { step: '800', hex: '#1e293b' },
    ],
  },
]

// Form example state — local refs only, nothing persisted.
const inputValue = ref('')
const inputErrorValue = ref('')
const selectValue = ref<'operator' | 'admin' | 'viewer'>('operator')
const toggleValue = ref(true)
const checkboxValue = ref(true)

const selectOptions = computed<Array<{ value: 'operator' | 'admin' | 'viewer'; label: string }>>(() => [
  { value: 'operator', label: t('designSystem.sections.forms.selectOptions.operator') },
  { value: 'admin', label: t('designSystem.sections.forms.selectOptions.admin') },
  { value: 'viewer', label: t('designSystem.sections.forms.selectOptions.viewer') },
])
</script>

<template>
  <div class="mx-auto max-w-ds space-y-8">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-semibold tracking-wide text-success-600 uppercase">
          {{ t('designSystem.eyebrow') }}
        </p>
        <h1 class="mt-1 text-[30px] font-extrabold text-slate-900">
          {{ t('designSystem.title') }}
        </h1>
        <p class="mt-1 text-sm text-slate-500">{{ t('designSystem.subtitle') }}</p>
      </div>
      <RouterLink :to="{ name: 'dashboard' }" class="btn btn-soft">
        {{ t('designSystem.backToDashboard') }}
      </RouterLink>
    </div>

    <!-- Palette -->
    <section class="island space-y-4">
      <h2 class="text-lg font-bold text-slate-900">{{ t('designSystem.sections.palette.title') }}</h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <div v-for="card in PALETTE_CARDS" :key="card.key" class="rounded-btn border border-line p-4">
          <p class="mb-3 text-sm font-semibold text-slate-700">{{ t(card.nameKey) }}</p>
          <ul class="space-y-2">
            <li v-for="swatch in card.swatches" :key="swatch.step" class="flex items-center gap-3">
              <span
                class="size-8 shrink-0 rounded-btn border border-line"
                :style="{ backgroundColor: swatch.hex }"
                aria-hidden="true"
              />
              <span class="text-xs text-slate-500">
                <span class="font-semibold text-slate-700">{{ swatch.step }}</span> · {{ swatch.hex }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Typography -->
    <section class="island space-y-3">
      <h2 class="text-lg font-bold text-slate-900">{{ t('designSystem.sections.typography.title') }}</h2>
      <p class="text-[30px] font-extrabold text-slate-900">{{ t('designSystem.sections.typography.display') }}</p>
      <p class="text-2xl font-bold text-slate-900">{{ t('designSystem.sections.typography.h1') }}</p>
      <p class="text-lg font-bold text-slate-900">{{ t('designSystem.sections.typography.h2') }}</p>
      <p class="text-sm font-normal text-slate-800">{{ t('designSystem.sections.typography.body') }}</p>
      <p class="text-xs font-medium text-slate-500">{{ t('designSystem.sections.typography.caption') }}</p>
    </section>

    <!-- Buttons -->
    <section class="island space-y-4">
      <h2 class="text-lg font-bold text-slate-900">{{ t('designSystem.sections.buttons.title') }}</h2>
      <div class="flex flex-wrap gap-3">
        <button type="button" class="btn btn-primary">{{ t('designSystem.sections.buttons.primary') }}</button>
        <button type="button" class="btn btn-success">{{ t('designSystem.sections.buttons.success') }}</button>
        <button type="button" class="btn btn-soft">{{ t('designSystem.sections.buttons.soft') }}</button>
        <button type="button" class="btn btn-ghost">{{ t('designSystem.sections.buttons.ghost') }}</button>
        <button type="button" class="btn btn-danger">{{ t('designSystem.sections.buttons.danger') }}</button>
      </div>
      <div class="flex flex-wrap gap-3">
        <button type="button" class="btn btn-primary" disabled>
          {{ t('designSystem.sections.buttons.primary') }}
        </button>
        <button type="button" class="btn btn-success" disabled>
          {{ t('designSystem.sections.buttons.success') }}
        </button>
        <button type="button" class="btn btn-soft" disabled>
          {{ t('designSystem.sections.buttons.soft') }}
        </button>
        <button type="button" class="btn btn-ghost" disabled>
          {{ t('designSystem.sections.buttons.ghost') }}
        </button>
        <button type="button" class="btn btn-danger" disabled>
          {{ t('designSystem.sections.buttons.danger') }}
        </button>
      </div>
    </section>

    <!-- Forms -->
    <section class="island space-y-4">
      <h2 class="text-lg font-bold text-slate-900">{{ t('designSystem.sections.forms.title') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <AppInput
          v-model="inputValue"
          :label="t('designSystem.sections.forms.inputLabel')"
          :placeholder="t('designSystem.sections.forms.inputPlaceholder')"
        />
        <AppInput
          v-model="inputErrorValue"
          :label="t('designSystem.sections.forms.inputErrorLabel')"
          :error-text="t('designSystem.sections.forms.inputErrorText')"
        />
        <AppSelect
          v-model="selectValue"
          :label="t('designSystem.sections.forms.selectLabel')"
          :options="selectOptions"
        />
        <div class="flex flex-col justify-center gap-3">
          <AppToggle v-model="toggleValue" :label="t('designSystem.sections.forms.toggleLabel')" />
          <AppCheckbox v-model="checkboxValue" :label="t('designSystem.sections.forms.checkboxLabel')" />
        </div>
      </div>
    </section>

    <!-- Badges -->
    <section class="island space-y-4">
      <h2 class="text-lg font-bold text-slate-900">{{ t('designSystem.sections.badges.title') }}</h2>
      <div class="flex flex-wrap gap-2">
        <AppBadge
          v-for="tone in BADGE_TONES"
          :key="`soft-${tone}`"
          :tone="tone"
          :label="t(`designSystem.sections.badges.${tone}`)"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <AppBadge
          v-for="tone in BADGE_TONES"
          :key="`outline-${tone}`"
          :tone="tone"
          variant="outline"
          :label="t(`designSystem.sections.badges.${tone}`)"
        />
      </div>
    </section>

    <!-- Avatars -->
    <section class="island space-y-4">
      <h2 class="text-lg font-bold text-slate-900">{{ t('designSystem.sections.avatars.title') }}</h2>
      <div class="flex flex-wrap items-center gap-4">
        <AvatarInitials name="Ana Rossi" variant="soft" tone="primary" size="sm" />
        <AvatarInitials name="Ana Rossi" variant="soft" tone="primary" size="md" />
        <AvatarInitials name="Ana Rossi" variant="soft" tone="primary" size="lg" />
        <AvatarInitials name="Bruno Kessler" variant="solid" tone="success" size="md" />
        <AvatarInitials name="Carla Nunez" variant="solid" tone="primary" size="md" :online="true" />
      </div>
    </section>

    <!-- Alerts -->
    <section class="island space-y-4">
      <h2 class="text-lg font-bold text-slate-900">{{ t('designSystem.sections.alerts.title') }}</h2>
      <div class="space-y-3">
        <AppAlert
          variant="success"
          :title="t('designSystem.sections.alerts.successTitle')"
          :description="t('designSystem.sections.alerts.successDescription')"
        />
        <AppAlert
          variant="info"
          :title="t('designSystem.sections.alerts.infoTitle')"
          :description="t('designSystem.sections.alerts.infoDescription')"
        />
        <AppAlert
          variant="danger"
          :title="t('designSystem.sections.alerts.dangerTitle')"
          :description="t('designSystem.sections.alerts.dangerDescription')"
        />
      </div>
    </section>

    <!-- Cards -->
    <section class="space-y-4">
      <h2 class="text-lg font-bold text-slate-900">{{ t('designSystem.sections.cards.title') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="island">
          <p class="font-semibold text-slate-900">{{ t('designSystem.sections.cards.basicTitle') }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ t('designSystem.sections.cards.basicBody') }}</p>
        </div>
        <KpiCard
          :label="t('designSystem.sections.cards.kpiLabel')"
          :value="t('designSystem.sections.cards.kpiValue')"
          :delta="{ value: '+12%', direction: 'up' }"
          :comparison="t('designSystem.sections.cards.kpiComparison')"
        />
        <KpiCard
          :label="t('designSystem.sections.cards.kpiLabel')"
          :value="t('designSystem.sections.cards.kpiValueDown')"
          :delta="{ value: '-4%', direction: 'down' }"
          :comparison="t('designSystem.sections.cards.kpiComparison')"
        />
        <div class="rounded-card bg-gradient-to-br from-primary-600 to-success-600 p-5.5 text-white">
          <p class="font-semibold">{{ t('designSystem.sections.cards.highlightTitle') }}</p>
          <p class="mt-1 text-sm text-white/80">{{ t('designSystem.sections.cards.highlightBody') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>
