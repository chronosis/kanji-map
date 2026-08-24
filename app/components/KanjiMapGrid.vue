<script setup lang="ts">
import type { ColorMode, MapCell } from '../../shared/types/kanji'
import {
  cellVisualClass,
  formatAccuracy,
  hasApiSrs
} from '../../shared/utils/colors'
import { schoolYearLabel } from '../../shared/utils/kanji-order'
import { clampPan } from '../../shared/utils/pan-clamp'
import {
  DEFAULT_GRID_COLUMNS,
  isGridColumnCount,
  stepGridColumns,
  type GridColumnCount
} from '../../shared/utils/grid-columns'

/** Cell aspect ratio width:height = 2:3 */
const CELL_W_PX = 40
const CELL_H_PX = 60
const GAP_PX = 1
const PAD_PX = 8
const DRAG_CLICK_THRESHOLD_PX = 6

const props = defineProps<{
  cells: MapCell[]
  colorMode: ColorMode
  /** Elementary year 1–6, 'jh' for 中学+ jōyō, or null for all */
  highlightGrade: number | 'jh' | null
  highlightSrsMin: number | null
  highlightSrsMax: number | null
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
/** Skip center-preserve on the first columns watch after mount. */
const allowCenterPreserve = ref(false)

function rowCount(cols: number = columns.value): number {
  if (cols <= 0) return 0
  return Math.ceil(props.cells.length / cols)
}

function gridContentWidth(cols: number): number {
  return cols * CELL_W_PX + Math.max(0, cols - 1) * GAP_PX + PAD_PX * 2
}

function gridContentHeight(cols: number = columns.value): number {
  const rows = rowCount(cols)
  if (rows <= 0) return PAD_PX * 2
  return rows * CELL_H_PX + Math.max(0, rows - 1) * GAP_PX + PAD_PX * 2
}

function cellStrideX(): number {
  return CELL_W_PX + GAP_PX
}

function cellStrideY(): number {
  return CELL_H_PX + GAP_PX
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

/** Fit grid width to the viewport; scale is layout-only (not a zoom control). */
function fitWidth(preserveCenterIndex: number | null = null) {
  const el = viewport.value
  if (!el) return
  const available = el.clientWidth
  if (available <= 0) return
  const contentW = gridContentWidth(columns.value)
  scale.value = Math.min(4, Math.max(0.15, available / contentW))

  if (preserveCenterIndex != null && props.cells.length > 0) {
    const idx = Math.min(props.cells.length - 1, Math.max(0, preserveCenterIndex))
    const col = idx % columns.value
    const row = Math.floor(idx / columns.value)
    const cx = PAD_PX + col * cellStrideX() + CELL_W_PX / 2
    const cy = PAD_PX + row * cellStrideY() + CELL_H_PX / 2
    translate.x = el.clientWidth / 2 - cx * scale.value
    translate.y = el.clientHeight / 2 - cy * scale.value
  } else {
    translate.x = 0
    translate.y = 0
  }
  applyClamp()
}

function viewportCenterCellIndex(cols: number): number {
  const el = viewport.value
  if (!el || cols <= 0 || props.cells.length === 0) return 0
  const cx = (-translate.x + el.clientWidth / 2) / scale.value - PAD_PX
  const cy = (-translate.y + el.clientHeight / 2) / scale.value - PAD_PX
  const col = Math.min(cols - 1, Math.max(0, Math.floor(cx / cellStrideX())))
  const row = Math.max(0, Math.floor(cy / cellStrideY()))
  return Math.min(props.cells.length - 1, row * cols + col)
}

function cellVisualInput(cell: MapCell) {
  return {
    srsAvg: cell.srsAvg,
    accuracyAvg: cell.accuracyAvg,
    sources: cell.sources,
    inJoyoo: cell.inJoyoo,
    schoolGrade: cell.schoolGrade,
    inWanikani: cell.inWanikani
  }
}

function cellClass(cell: MapCell): string {
  return cellVisualClass(props.colorMode, cellVisualInput(cell))
}

function accuracyLabel(cell: MapCell): string {
  return formatAccuracy(cell.accuracyAvg, {
    sources: cell.sources,
    srsAvg: cell.srsAvg
  })
}

function isHighlighted(cell: MapCell): boolean {
  if (props.highlightGrade === 'jh') {
    if (!(cell.inJoyoo && cell.schoolGrade == null)) return false
  } else if (props.highlightGrade != null && cell.schoolGrade !== props.highlightGrade) {
    return false
  }
  if (props.highlightSrsMin === -1 && props.highlightSrsMax === -1) {
    return !hasApiSrs(cell.sources, cell.srsAvg)
  }
  if (props.highlightSrsMin != null || props.highlightSrsMax != null) {
    if (!hasApiSrs(cell.sources, cell.srsAvg)) return false
    if (props.highlightSrsMin != null && (cell.srsAvg ?? 0) < props.highlightSrsMin) return false
    if (props.highlightSrsMax != null && (cell.srsAvg ?? 0) > props.highlightSrsMax) return false
  }
  return true
}

function dimmed(cell: MapCell): boolean {
  const anyFilter = props.highlightGrade != null
    || props.highlightSrsMin != null
    || props.highlightSrsMax != null
  return anyFilter && !isHighlighted(cell)
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
  nextTick(() => fitWidth(null))
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
  fitWidth(null)
  allowCenterPreserve.value = true
  window.addEventListener('keydown', onWindowKeyDown)
  if (viewport.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      const center = viewportCenterCellIndex(columns.value)
      fitWidth(center)
    })
    resizeObserver.observe(viewport.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeyDown)
  resizeObserver?.disconnect()
})

watch(columns, (newCols, oldCols) => {
  if (!allowCenterPreserve.value) {
    nextTick(() => fitWidth(null))
    return
  }
  const prev = isGridColumnCount(oldCols) ? oldCols : columns.value
  const center = viewportCenterCellIndex(prev)
  nextTick(() => fitWidth(center))
})

watch(() => props.cells.length, () => {
  nextTick(() => fitWidth(viewportCenterCellIndex(columns.value)))
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
          gridTemplateColumns: `repeat(${columns}, ${CELL_W_PX}px)`,
          gap: `${GAP_PX}px`
        }"
      >
        <button
          v-for="cell in cells"
          :key="cell.character"
          type="button"
          class="relative flex items-center justify-center rounded-sm text-base font-medium leading-none transition-opacity"
          :class="[
            cellClass(cell),
            dimmed(cell) ? 'opacity-20' : 'opacity-100 hover:ring-2 hover:ring-primary'
          ]"
          :style="{
            width: `${CELL_W_PX}px`,
            height: `${CELL_H_PX}px`
          }"
          :title="`${cell.character} · ${schoolYearLabel(cell.schoolGrade, cell.inJoyoo)} · JLPT ${cell.jlptLevel ?? '—'} · SRS ${cell.srsAvg?.toFixed(1) ?? '—'} · ${accuracyLabel(cell)}`"
          @click="onCellClick(cell.character)"
        >
          <span class="select-none font-bold text-gray-900 dark:text-gray-950">{{ cell.character }}</span>
          <span class="pointer-events-none absolute bottom-0.5 right-0.5 text-[0.6rem] leading-none text-gray-800/80">
            {{ accuracyLabel(cell) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
