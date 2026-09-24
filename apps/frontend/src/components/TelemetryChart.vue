<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import type { TelemetryPoint } from '@platform/shared-types'

// Presentational only — no window.platform, no store access. Reused for both the
// historical view (Phase 7) and the live-window view (Phase 8): callers pass the
// points to plot, this component only knows how to draw a min/avg/max band.
ChartJS.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip, Legend)

const props = defineProps<{
  points: TelemetryPoint[]
  avgLabel: string
  bandLabel: string
  unit?: string
}>()

// Buckets are epoch ms. Formatting them as short locale time strings avoids pulling
// in chartjs-adapter-date-fns just for a readable x-axis — the category scale below
// only needs strings, not real time-scale math.
function formatBucket(bucket: number): string {
  const date = new Date(bucket)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const chartData = computed<ChartData<'line'>>(() => {
  const labels = props.points.map((point) => formatBucket(point.bucket))

  return {
    labels,
    datasets: [
      {
        label: 'min',
        data: props.points.map((point) => point.min),
        borderWidth: 0,
        pointRadius: 0,
        fill: false,
        tension: 0.25,
      },
      {
        label: props.bandLabel,
        data: props.points.map((point) => point.max),
        borderWidth: 0,
        pointRadius: 0,
        backgroundColor: 'rgba(99, 102, 241, 0.18)',
        fill: '-1',
        tension: 0.25,
      },
      {
        label: props.avgLabel,
        data: props.points.map((point) => point.avg),
        borderColor: 'rgb(79, 70, 229)',
        backgroundColor: 'rgb(79, 70, 229)',
        pointRadius: 0,
        borderWidth: 2,
        fill: false,
        tension: 0.25,
      },
    ],
  }
})

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      labels: {
        filter: (item) => item.text !== 'min',
      },
    },
    tooltip: {
      filter: (item) => item.dataset.label !== 'min',
    },
  },
  scales: {
    x: { grid: { display: false } },
    y: {
      title: { display: Boolean(props.unit), text: props.unit ?? '' },
    },
  },
}))
</script>

<template>
  <div class="h-72 w-full">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
