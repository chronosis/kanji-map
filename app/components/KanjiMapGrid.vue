<script setup lang="ts">
import type { ColorMode, MapCell } from '../../shared/types/kanji'
import type { MapHighlightFilters } from '../../shared/utils/map-highlight'
import {
  cellVisualClass,
  formatAccuracy
} from '../../shared/utils/colors'
import { isMapCellDimmed } from '../../shared/utils/map-highlight'
import { schoolYearLabel } from '../../shared/utils/kanji-order'
import { clampPan } from '../../shared/utils/pan-clamp'
import {
  DEFAULT_GRID_COLUMNS,
  buildMapGridTrackItems,
  gridTrackColumnCount,
  stepGridColumns,
  type GridColumnCount
} from '../../shared/utils/grid-columns'

/** Cell aspect ratio width:height = 4:5 */
const CELL_W_PX = 44
const CELL_H_PX = 55
const GAP_PX = 1
const PAD_PX = 8
const DRAG_CLICK_THRESHOLD_PX = 6
/** Shared style for accuracy corner label. */
const CELL_META_CLASS = 'pointer-events-none absolute text-[0.6rem] leading-none text-gray-800/80'
/** Slightly smaller than accuracy — stroke count / reading count. */
const CELL_META_SMALL_CLASS = 'pointer-events-none absolute text-[0.5rem] leading-none text-gray-800/80'

const props = defineProps<{
  cells: MapCell[]
  colorMode: ColorMode
  highlightFilters: MapHighlightFilters
  /** Corpus maxes for stroke / reading heatmaps (stable across filters). */
  heatmapScale?: { maxStrokes: number, maxReadingCount: number }
  /** When false, omit accuracy corner labels (no WaniKani key configured). */
  showAccuracy?: boolean
  /** When false, ignore global pan/zoom hotkeys (e.g. detail modal open). */
  keyboardEnabled?: boolean
}>()

const emit = defineEmits<{
  select: [character: string]
}>()

const columns = defineModel<GridColumnCount>('columns', {
  default: DEFAULT_GRID_COLUMNS
})

const scale = ref(1)
const translate = reactive({ x: 0, y: 0 })
const dragging = ref(false)
const lastPointer = reactive({ x: 0, y: 0 })
const pointerOrigin = reactive({ x: 0, y: 0 })
const didPan = ref(false)
const capturedPointerId = ref<number | null>(null)
const viewport = ref<HTMLElement | null>(null)

const trackItems = computed(() => buildMapGridTrackItems(props.cells, columns.value))

function rowCount(cols: number = columns.value): number {
  if (cols <= 0) return 0
  return Math.ceil(props.cells.length / cols)
}

/** Content width includes the leading row-index gutter column. */
function gridContentWidth(cols: number): number {
  const trackCols = gridTrackColumnCount(cols)
  return trackCols * CELL_W_PX + Math.max(0, trackCols - 1) * GAP_PX + PAD_PX * 2
}

function gridContentHeight(cols: number = columns.value): number {
  const rows = rowCount(cols)
  if (rows <= 0) return PAD_PX * 2
  return rows * CELL_H_PX + Math.max(0, rows - 1) * GAP_PX + PAD_PX * 2
}

function applyClamp() {
  const el = viewport.value
  if (!el) return
  const next = clampPan(
    translate.x,
    translate.y,
    el.clientWidth,
    el.clientHeight,
    gridContentWidth(columns.value),
    gridContentHeight(),
    scale.value
  )
  translate.x = next.x
  translate.y = next.y
}

/** Fit grid width to the viewport and pin pan to the top-left of the content. */
function fitWidth() {
  const el = viewport.value
  if (!el) return
  el.scrollTop = 0
  el.scrollLeft = 0
  const available = el.clientWidth
  if (available <= 0) return
  const contentW = gridContentWidth(columns.value)
  scale.value = Math.min(4, Math.max(0.15, available / contentW))
  translate.x = 0
  translate.y = 0
  applyClamp()
}

function cellVisualInput(cell: MapCell) {
  return {
    srsAvg: cell.srsAvg,
    accuracyAvg: cell.accuracyAvg,
    sources: cell.sources,
    inJoyoo: cell.inJoyoo,
    schoolGrade: cell.schoolGrade,
    inWanikani: cell.inWanikani,
    strokes: cell.strokes,
    readingCount: cell.readingCount,
    wkLevel: cell.wkLevel,
    jlptLevel: cell.jlptLevel
  }
}

function cellClass(cell: MapCell): string {
  return cellVisualClass(props.colorMode, cellVisualInput(cell), props.heatmapScale)
}

function accuracyLabel(cell: MapCell): string {
  if (props.showAccuracy === false) return ''
  return formatAccuracy(cell.accuracyAvg, {
    sources: cell.sources,
    srsAvg: cell.srsAvg
  })
}

function cellTitle(cell: MapCell): string {
  const parts = [
    cell.character,
    schoolYearLabel(cell.schoolGrade, cell.inJoyoo),
    `JLPT ${cell.jlptLevel ?? '—'}`,
    `SRS ${cell.srsAvg?.toFixed(1) ?? '—'}`
  ]
  const accuracy = accuracyLabel(cell)
  if (accuracy) parts.push(accuracy)
  return parts.join(' · ')
}

function strokesLabel(cell: MapCell): string {
  return cell.strokes != null ? String(cell.strokes) : '—'
}

function dimmed(cell: MapCell): boolean {
  return isMapCellDimmed(cell, props.highlightFilters)
}

function stepColumns(direction: -1 | 1) {
  const next = stepGridColumns(columns.value, direction)
  if (next === columns.value) return
  columns.value = next
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  if (event.ctrlKey) {
    stepColumns(event.deltaY > 0 ? 1 : -1)
    return
  }
  translate.y -= event.deltaY
  applyClamp()
}

function releasePointerCapture() {
  const el = viewport.value
  if (el && capturedPointerId.value != null) {
    try {
      el.releasePointerCapture(capturedPointerId.value)
    } catch {
      // pointer may already be released
    }
    capturedPointerId.value = null
  }
}

function onPointerDown(event: PointerEvent) {
  dragging.value = true
  didPan.value = false
  lastPointer.x = event.clientX
  lastPointer.y = event.clientY
  pointerOrigin.x = event.clientX
  pointerOrigin.y = event.clientY
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const dx = event.clientX - lastPointer.x
  const dy = event.clientY - lastPointer.y
  translate.x += dx
  translate.y += dy
  lastPointer.x = event.clientX
  lastPointer.y = event.clientY
  const totalDx = event.clientX - pointerOrigin.x
  const totalDy = event.clientY - pointerOrigin.y
  if (Math.hypot(totalDx, totalDy) > DRAG_CLICK_THRESHOLD_PX) {
    if (!didPan.value) {
      didPan.value = true
      const el = viewport.value
      if (el && capturedPointerId.value == null) {
        try {
          el.setPointerCapture(event.pointerId)
          capturedPointerId.value = event.pointerId
        } catch {
          // ignore capture failures
        }
      }
    }
  }
  applyClamp()
}

function onPointerUp() {
  releasePointerCapture()
  dragging.value = false
}

function onCellClick(character: string) {
  if (didPan.value) return
  emit('select', character)
}

function zoomIn() {
  stepColumns(-1)
}

function zoomOut() {
  stepColumns(1)
}

function resetView() {
  if (columns.value !== DEFAULT_GRID_COLUMNS) {
    columns.value = DEFAULT_GRID_COLUMNS
  }
  nextTick(() => fitWidth())
}

/** Screen-space pan for one grid row (matches cell height at current fit scale). */
function panByRows(rows: number) {
  translate.y += rows * CELL_H_PX * scale.value
  applyClamp()
}

function onWindowKeyDown(event: KeyboardEvent) {
  if (props.keyboardEnabled === false) return
  if (event.altKey || event.ctrlKey || event.metaKey) return

  switch (event.code) {
    case 'ArrowUp':
      event.preventDefault()
      panByRows(1)
      break
    case 'ArrowDown':
      event.preventDefault()
      panByRows(-1)
      break
    case 'NumpadAdd':
      event.preventDefault()
      zoomIn()
      break
    case 'NumpadSubtract':
      event.preventDefault()
      zoomOut()
      break
    default:
      break
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  fitWidth()
  window.addEventListener('keydown', onWindowKeyDown)
  if (viewport.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      fitWidth()
    })
    resizeObserver.observe(viewport.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeyDown)
  resizeObserver?.disconnect()
})

watch(columns, () => {
  nextTick(() => fitWidth())
})

watch(() => props.cells.length, () => {
  nextTick(() => fitWidth())
})

defineExpose({ zoomIn, zoomOut, resetView, fitWidth })
</script>

<template>
  <div
    ref="viewport"
    class="kanji-viewport relative h-full min-h-0 w-full overflow-hidden rounded-lg border border-default bg-elevated touch-none"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      class="origin-top-left will-change-transform"
      :style="{
        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
        padding: `${PAD_PX}px`
      }"
    >
      <div
        class="grid"
        :style="{
          gridTemplateColumns: `repeat(${gridTrackColumnCount(columns)}, ${CELL_W_PX}px)`,
          gap: `${GAP_PX}px`
        }"
      >
        <template
          v-for="item in trackItems"
          :key="item.key"
        >
          <div
            v-if="item.kind === 'label'"
            class="pointer-events-none flex items-center justify-center bg-transparent"
            :style="{
              width: `${CELL_W_PX}px`,
              height: `${CELL_H_PX}px`
            }"
            :aria-label="`Row starting at cell ${item.offset}`"
          >
            <span class="select-none text-center text-xs font-bold leading-none text-highlighted">
              {{ item.offset }}
            </span>
          </div>
          <button
            v-else
            type="button"
            class="relative flex items-center justify-center rounded-sm text-base font-medium leading-none transition-opacity"
            :class="[
              cellClass(item.cell),
              dimmed(item.cell) ? 'opacity-20' : 'opacity-100 hover:ring-2 hover:ring-primary'
            ]"
            :style="{
              width: `${CELL_W_PX}px`,
              height: `${CELL_H_PX}px`
            }"
            :title="cellTitle(item.cell)"
            @click="onCellClick(item.cell.character)"
          >
            <span class="km-kanji select-none text-gray-900 dark:text-gray-950">{{ item.cell.character }}</span>
            <span
              class="pointer-events-none absolute top-0.5 left-0.5 text-[0.6rem] font-bold leading-none text-gray-900"
            >
              {{ item.cell.joyoIndex + 1 }}
            </span>
            <span
              class="top-0.5 right-0.5"
              :class="CELL_META_SMALL_CLASS"
            >
              {{ strokesLabel(item.cell) }}
            </span>
            <span
              class="bottom-0.5 left-0.5"
              :class="CELL_META_SMALL_CLASS"
            >
              {{ item.cell.readingCount }}
            </span>
            <span
              v-if="showAccuracy !== false"
              class="bottom-0.5 right-0.5"
              :class="CELL_META_CLASS"
            >
              {{ accuracyLabel(item.cell) }}
            </span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
