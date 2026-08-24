<script setup lang="ts">
import type { ColorMode, MapCell, MapFilterMode, OrderMode } from '../../shared/types/kanji'
import { isOmittedByMapFilter } from '../../shared/utils/colors'
import {
  DEFAULT_GRID_COLUMNS,
  GRID_COLUMN_OPTIONS,
  isGridColumnCount,
  type GridColumnCount
} from '../../shared/utils/grid-columns'
import { sortMapCells } from '../../shared/utils/kanji-order'

useSeoMeta({
  title: 'Kanji Map',
  description: 'Pannable mastery map of jōyō + JLPT kanji from WaniKani and BunPro'
})

const { data, pending, error } = await useFetch<{ cells: MapCell[], columns: number }>('/api/map')

const { syncMessage } = useApiSync()
const colorMode = ref<ColorMode>('srs')
const orderMode = ref<OrderMode>('joyo')
const columnCount = ref<GridColumnCount>(DEFAULT_GRID_COLUMNS)
const highlightGrade = ref<string>('all')
const highlightSrsBand = ref<string>('all')
const mapFilter = ref<MapFilterMode>('none')
const gridRef = ref<{ zoomIn: () => void, zoomOut: () => void, resetView: () => void } | null>(null)
const detailOpen = ref(false)
const detailCharacter = ref<string | null>(null)

function openKanjiDetail(character: string) {
  detailCharacter.value = character
  detailOpen.value = true
}

const colorModeItems = [
  { label: 'SRS stage', value: 'srs' },
  { label: 'Accuracy heatmap', value: 'accuracy' }
]

const orderModeItems = [
  { label: 'Jōyō appearance', value: 'joyo' },
  { label: 'WaniKani order', value: 'wk' },
  { label: 'SRS stage', value: 'srs' },
  { label: 'Usage (frequency)', value: 'usage' },
  { label: 'Accuracy', value: 'accuracy' }
]

const columnItems = GRID_COLUMN_OPTIONS.map(n => ({
  label: String(n),
  value: String(n)
}))

/** Bound as string for USelect; always one of GRID_COLUMN_OPTIONS. */
const columnCountSelect = computed({
  get: () => String(columnCount.value),
  set: (raw: string) => {
    const n = Number(raw)
    if (isGridColumnCount(n)) columnCount.value = n
  }
})

/** MEXT only assigns 小学校 years 1–6; remaining jōyō are 中学+ (no official 7–12 list). */
const gradeItems = [
  { label: 'All years', value: 'all' },
  { label: '小1', value: '1' },
  { label: '小2', value: '2' },
  { label: '小3', value: '3' },
  { label: '小4', value: '4' },
  { label: '小5', value: '5' },
  { label: '小6', value: '6' },
  { label: '中学+ (jōyō)', value: 'jh' }
]

const srsBandItems = [
  { label: 'All SRS', value: 'all' },
  { label: 'Unstudied', value: 'unstudied' },
  { label: 'Apprentice (1–4)', value: '1-4' },
  { label: 'Guru+ (5–9)', value: '5-9' },
  { label: 'Burned (9)', value: '9-9' }
]

const mapFilterItems = [
  { label: 'None', value: 'none' },
  { label: 'Untracked', value: 'untracked' },
  { label: 'Untracked & Unstudied', value: 'untracked-unstudied' }
]

const gradeFilter = computed((): number | 'jh' | null => {
  if (highlightGrade.value === 'all') return null
  if (highlightGrade.value === 'jh') return 'jh'
  return Number(highlightGrade.value)
})

const highlightSrsMin = computed(() => {
  if (highlightSrsBand.value === 'all') return null
  if (highlightSrsBand.value === 'unstudied') return -1
  return Number(highlightSrsBand.value.split('-')[0])
})

const highlightSrsMax = computed(() => {
  if (highlightSrsBand.value === 'all') return null
  if (highlightSrsBand.value === 'unstudied') return -1
  return Number(highlightSrsBand.value.split('-')[1])
})

function cellFilterInput(cell: MapCell) {
  return {
    srsAvg: cell.srsAvg,
    accuracyAvg: cell.accuracyAvg,
    sources: cell.sources,
    inJoyoo: cell.inJoyoo,
    schoolGrade: cell.schoolGrade,
    inWanikani: cell.inWanikani
  }
}

const orderedCells = computed(() => {
  if (!data.value?.cells) return []
  const filtered = data.value.cells.filter(
    cell => !isOmittedByMapFilter(mapFilter.value, cellFilterInput(cell))
  )
  return sortMapCells(filtered, orderMode.value)
})

watch(orderMode, () => {
  nextTick(() => gridRef.value?.resetView())
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
    <div class="shrink-0 flex flex-wrap items-end justify-between gap-3">
      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Order">
          <USelect
            v-model="orderMode"
            :items="orderModeItems"
            value-key="value"
            class="w-52"
          />
        </UFormField>

        <UFormField label="Color mode">
          <USelect
            v-model="colorMode"
            :items="colorModeItems"
            value-key="value"
            class="w-48"
          />
        </UFormField>

        <UFormField label="Highlight year">
          <USelect
            v-model="highlightGrade"
            :items="gradeItems"
            value-key="value"
            class="w-44"
          />
        </UFormField>

        <UFormField label="Highlight SRS">
          <USelect
            v-model="highlightSrsBand"
            :items="srsBandItems"
            value-key="value"
            class="w-48"
          />
        </UFormField>

        <UFormField label="Filters">
          <USelect
            v-model="mapFilter"
            :items="mapFilterItems"
            value-key="value"
            class="w-56"
          />
        </UFormField>

        <div class="flex gap-1">
          <UButton
            icon="i-lucide-zoom-in"
            color="neutral"
            variant="soft"
            @click="gridRef?.zoomIn()"
          />
          <UButton
            icon="i-lucide-zoom-out"
            color="neutral"
            variant="soft"
            @click="gridRef?.zoomOut()"
          />
          <UButton
            icon="i-lucide-locate"
            color="neutral"
            variant="soft"
            @click="gridRef?.resetView()"
          />
        </div>
      </div>

      <UFormField label="Columns">
        <USelect
          v-model="columnCountSelect"
          :items="columnItems"
          value-key="value"
          class="w-24"
        />
      </UFormField>
    </div>

    <p class="shrink-0 text-xs text-muted">
      School years follow MEXT’s 学年別漢字配当表 (小学校 小1–小6 only). Remaining 常用漢字 are
      taught in 中学 without an official year-by-year list — shown as 中学+. There is no national
      7–12 kanji year table. Light blue outline = untracked (jōyō/school, not in WaniKani).
      Lighter grey without outline = unstudied (in WaniKani, no positive SRS yet).
    </p>

    <p
      v-if="syncMessage"
      class="shrink-0 text-sm text-muted"
    >
      {{ syncMessage }}
    </p>
    <p
      v-if="error"
      class="shrink-0 text-sm text-error"
    >
      {{ error.message }}
    </p>
    <p
      v-if="pending"
      class="shrink-0 text-sm text-muted"
    >
      Loading map…
    </p>

    <KanjiMapGrid
      v-if="data"
      ref="gridRef"
      v-model:columns="columnCount"
      class="min-h-0 flex-1"
      :cells="orderedCells"
      :color-mode="colorMode"
      :highlight-grade="gradeFilter"
      :highlight-srs-min="highlightSrsMin"
      :highlight-srs-max="highlightSrsMax"
      :keyboard-enabled="!detailOpen"
      @select="openKanjiDetail"
    />

    <KanjiDetailModal
      v-model:open="detailOpen"
      :character="detailCharacter"
    />
  </div>
</template>
