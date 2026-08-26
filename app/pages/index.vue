<script setup lang="ts">
import type { ColorMode, MapCell, MapFilterMode, OrderMode } from '../../shared/types/kanji'
import { isOmittedByMapFilter } from '../../shared/utils/colors'
import {
  isMapCellDimmed,
  type MapHighlightFilters
} from '../../shared/utils/map-highlight'
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

const { data, pending, error } = await useFetch<{
  cells: MapCell[]
  columns: number
  sourcesConfigured?: { wanikani: boolean, bunpro: boolean }
}>('/api/map')

const { syncMessage } = useApiSync()
const colorMode = ref<ColorMode>('none')
const orderMode = ref<OrderMode>('joyo')
const columnCount = ref<GridColumnCount>(DEFAULT_GRID_COLUMNS)
const highlightGrade = ref<string>('all')
const highlightSrsBand = ref<string>('all')
const mapFilter = ref<MapFilterMode>('none')
const kanjiSearch = ref('')
const gridRef = ref<{
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
  fitWidth: () => void
} | null>(null)
const detailOpen = ref(false)
const detailCharacter = ref<string | null>(null)
const helpOpen = ref(false)

function openKanjiDetail(character: string) {
  detailCharacter.value = character
  detailOpen.value = true
}

const wanikaniConfigured = computed(
  () => Boolean(data.value?.sourcesConfigured?.wanikani)
)

const ALL_COLOR_MODE_ITEMS: Array<{ label: string, value: ColorMode }> = [
  { label: '--', value: 'none' },
  { label: 'School year', value: 'year' },
  { label: 'SRS stage', value: 'srs' },
  { label: 'Accuracy heatmap', value: 'accuracy' },
  { label: 'WaniKani level', value: 'wk' },
  { label: 'Stroke count heatmap', value: 'strokes' },
  { label: 'Reading count heatmap', value: 'readings' }
]

const WK_GATED_COLOR_MODES: ReadonlySet<ColorMode> = new Set(['srs', 'accuracy', 'wk'])

const ALL_ORDER_MODE_ITEMS: Array<{ label: string, value: OrderMode }> = [
  { label: 'Jōyō appearance', value: 'joyo' },
  { label: 'WaniKani order', value: 'wk' },
  { label: 'SRS stage', value: 'srs' },
  { label: 'Usage (frequency)', value: 'usage' },
  { label: 'Accuracy', value: 'accuracy' },
  { label: 'Number of readings', value: 'readings' },
  { label: 'Stroke count', value: 'strokes' }
]

const colorModeItems = computed(() => {
  if (wanikaniConfigured.value) return ALL_COLOR_MODE_ITEMS
  return ALL_COLOR_MODE_ITEMS.filter(item => !WK_GATED_COLOR_MODES.has(item.value))
})

const orderModeItems = computed(() => {
  if (wanikaniConfigured.value) return ALL_ORDER_MODE_ITEMS
  return ALL_ORDER_MODE_ITEMS.filter(item => item.value !== 'srs' && item.value !== 'accuracy')
})

watch(
  wanikaniConfigured,
  (configured) => {
    if (configured) return
    if (WK_GATED_COLOR_MODES.has(colorMode.value)) {
      colorMode.value = 'strokes'
    }
    if (orderMode.value === 'srs' || orderMode.value === 'accuracy') {
      orderMode.value = 'joyo'
    }
  },
  { immediate: true }
)

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
  { label: 'Untracked & Unstudied', value: 'untracked-unstudied' },
  { label: 'Unhighlighted', value: 'unhighlighted' }
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

const highlightFilters = computed((): MapHighlightFilters => ({
  highlightGrade: gradeFilter.value,
  highlightSrsMin: highlightSrsMin.value,
  highlightSrsMax: highlightSrsMax.value,
  searchQuery: kanjiSearch.value
}))

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
  const filters = highlightFilters.value
  const filtered = data.value.cells.filter((cell) => {
    const dimmed = isMapCellDimmed(cell, filters)
    return !isOmittedByMapFilter(mapFilter.value, cellFilterInput(cell), { dimmed })
  })
  return sortMapCells(filtered, orderMode.value)
})

/** Corpus-wide maxes so stroke/reading heatmaps stay stable under filters. */
const heatmapScale = computed(() => {
  const cells = data.value?.cells ?? []
  let maxStrokes = 0
  let maxReadingCount = 0
  for (const cell of cells) {
    if (cell.strokes != null && cell.strokes > maxStrokes) maxStrokes = cell.strokes
    if (cell.readingCount > maxReadingCount) maxReadingCount = cell.readingCount
  }
  return { maxStrokes, maxReadingCount }
})

watch(orderMode, () => {
  // Re-fit pan/scale for the new order without resetting the column zoom level.
  nextTick(() => gridRef.value?.fitWidth())
})

watch(mapFilter, () => {
  nextTick(() => gridRef.value?.fitWidth())
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
            aria-label="Zoom in"
            @click="gridRef?.zoomIn()"
          />
          <UButton
            icon="i-lucide-zoom-out"
            color="neutral"
            variant="soft"
            aria-label="Zoom out"
            @click="gridRef?.zoomOut()"
          />
          <UTooltip text="Fit map to view">
            <UButton
              icon="i-lucide-locate"
              color="neutral"
              variant="soft"
              aria-label="Fit map to view"
              @click="gridRef?.resetView()"
            />
          </UTooltip>
          <UTooltip text="Help">
            <UButton
              icon="i-lucide-circle-help"
              color="neutral"
              variant="soft"
              aria-label="Help"
              @click="helpOpen = true"
            />
          </UTooltip>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Search">
          <UInput
            v-model="kanjiSearch"
            name="kanjiSearchQuery"
            placeholder="Radical, kanji, or reading…"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            class="w-[13.5rem] font-medium"
          />
        </UFormField>

        <UFormField label="Columns">
          <USelect
            v-model="columnCountSelect"
            :items="columnItems"
            value-key="value"
            class="w-[4.5rem]"
          />
        </UFormField>
      </div>
    </div>

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
      :highlight-filters="highlightFilters"
      :heatmap-scale="heatmapScale"
      :show-accuracy="wanikaniConfigured"
      :keyboard-enabled="!detailOpen && !helpOpen"
      @select="openKanjiDetail"
    />

    <KanjiDetailModal
      v-model:open="detailOpen"
      :character="detailCharacter"
    />

    <MapHelpModal
      v-model:open="helpOpen"
      :wanikani-configured="wanikaniConfigured"
    />
  </div>
</template>
