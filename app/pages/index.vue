<script setup lang="ts">
import type { ColorMode, MapCell, MapFilterMode, OrderMode } from '../../shared/types/kanji'
import { isOmittedByMapFilter } from '../../shared/utils/colors'
import {
  buildHighlightMenuItems,
  filterHighlightSelectionForSources,
  highlightFiltersFromSelection,
  isMapCellDimmed,
  type HighlightOptionValue,
  type MapHighlightFilters
} from '../../shared/utils/map-highlight'
import {
  DEFAULT_GRID_COLUMNS,
  GRID_COLUMN_OPTIONS,
  isGridColumnCount,
  type GridColumnCount
} from '../../shared/utils/grid-columns'
import { sortMapCells } from '../../shared/utils/kanji-order'
import {
  WK_GATED_COLOR_MODES,
  WK_GATED_ORDER_MODES,
  coerceMapUiSettingsForSources,
  colorModeItemsForSources,
  orderModeItemsForSources
} from '../../shared/utils/map-settings'

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
const { defaultOrder, defaultColorMode, settings } = useMapSettings()

const wanikaniConfigured = computed(
  () => Boolean(data.value?.sourcesConfigured?.wanikani)
)

const initialSettings = coerceMapUiSettingsForSources(
  settings.value,
  wanikaniConfigured.value
)
const colorMode = ref<ColorMode>(initialSettings.defaultColorMode)
const orderMode = ref<OrderMode>(initialSettings.defaultOrder)
const columnCount = ref<GridColumnCount>(DEFAULT_GRID_COLUMNS)
const highlightSelection = ref<Array<{ label: string, value: HighlightOptionValue }>>([])
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

const colorModeItems = computed(() => colorModeItemsForSources(wanikaniConfigured.value))
const orderModeItems = computed(() => orderModeItemsForSources(wanikaniConfigured.value))

const highlightItems = computed(() => buildHighlightMenuItems({
  includeSrs: wanikaniConfigured.value,
  includeWkLevels: wanikaniConfigured.value
}))

watch(
  wanikaniConfigured,
  (configured) => {
    const coerced = coerceMapUiSettingsForSources({
      kanjiFont: settings.value.kanjiFont,
      defaultOrder: orderMode.value,
      defaultColorMode: colorMode.value
    }, configured)
    colorMode.value = coerced.defaultColorMode
    orderMode.value = coerced.defaultOrder
    if (!configured) {
      const allowed = new Set(filterHighlightSelectionForSources(
        highlightSelection.value.map(item => item.value),
        false
      ))
      highlightSelection.value = highlightSelection.value.filter(item => allowed.has(item.value))
    }
  },
  { immediate: true }
)

watch(defaultOrder, (next) => {
  if (WK_GATED_ORDER_MODES.has(next) && !wanikaniConfigured.value) return
  orderMode.value = next
})

watch(defaultColorMode, (next) => {
  if (WK_GATED_COLOR_MODES.has(next) && !wanikaniConfigured.value) return
  colorMode.value = next
})

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

const mapFilterItems = [
  { label: 'None', value: 'none' },
  { label: 'Untracked', value: 'untracked' },
  { label: 'Untracked & Unstudied', value: 'untracked-unstudied' },
  { label: 'Unhighlighted', value: 'unhighlighted' }
]

const highlightFilters = computed((): MapHighlightFilters => (
  highlightFiltersFromSelection(
    highlightSelection.value.map(item => item.value),
    kanjiSearch.value
  )
))

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

        <UFormField label="Highlight">
          <USelectMenu
            v-model="highlightSelection"
            multiple
            by="value"
            :items="highlightItems"
            :search-input="{ placeholder: 'Filter highlights…' }"
            placeholder="None"
            class="w-72"
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
