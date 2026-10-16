<script setup lang="ts">
import type { ColorMode, MapCell, SecondaryColorPaint } from '../../shared/types/kanji'
import type { MapHighlightFilters } from '../../shared/utils/map-highlight'
import {
  cellBorderColor,
  cellPaintColor,
  cellSecondaryStyle,
  cellVisualClass,
  formatAccuracy,
  SECONDARY_GRADIENT_ANGLE_DEG,
  srsDisplayColor,
  srsDisplayLabel
} from '../../shared/utils/colors'
import { isMapCellDimmed } from '../../shared/utils/map-highlight'
import { schoolYearLabel } from '../../shared/utils/kanji-order'
import { clampPan } from '../../shared/utils/pan-clamp'
import {
  CELL_COLOR_LERP_MS,
  ensureCellColorBuffers,
  gradientBackgroundImage,
  lerpRgbChannel,
  packChangedColorSlots,
  packChangedGradientSlots,
  readCssRgbChannels,
  readHexRgbChannels,
  rgbCss,
  type CellColorBuffers
} from '../../shared/utils/color-lerp'
import {
  CELL_MOVE_MS,
  CELL_FADE_MS,
  CELL_MOVE_ENTER,
  CELL_MOVE_EXIT,
  CELL_MOVE_SLIDE,
  CELL_MOVE_SNAP,
  CELL_MOVE_STAY,
  boardViewFromViewport,
  ensureCellMotionBuffers,
  fillGridPositions,
  planCellMoves,
  readTranslate,
  rowBeforeTop,
  rowPastBottom,
  type CellMotionBuffers
} from '../../shared/utils/cell-motion'
import { planCellPresence } from '../../shared/utils/cell-presence'
import {
  DEFAULT_GRID_COLUMNS,
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
/** Corner meta (strokes, readings, accuracy) — smaller than the jōyō index. */
const CELL_META_CLASS = 'pointer-events-none absolute text-[0.5rem] leading-none text-gray-800/80'

const props = defineProps<{
  cells: MapCell[]
  /**
   * Full map for this snapshot, including kanji the toolbar filter omitted.
   * A card that is fading out reads its new stage from here.
   */
  catalog?: MapCell[]
  colorMode: ColorMode
  /** Scale used for the secondary border or gradient (same options as Color mode). */
  secondaryColorMode: ColorMode
  /** Border draws a 2px edge; Gradient blends primary → secondary across the fill. */
  secondaryColorPaint?: SecondaryColorPaint
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
const { colorTransitionId } = useApiSync()
let colorTransitionFrame = 0
let colorBuffers: CellColorBuffers | null = null
let colorJobCount = 0
/** When true, the in-flight color blend animates gradient stops instead of a solid fill. */
let colorLerpGradient = false
let capturedTransitionId: number | null = null
/** Modes used to sample “from” colors before a toolbar / paint change. */
let paintFromPrimary: ColorMode = 'none'
let paintFromSecondary: ColorMode = 'none'
let paintFromPaint: SecondaryColorPaint = 'border'
let paintFromReady = false
let moveGeneration = 0
let moveTimer = 0
let fadeGeneration = 0
let fadeTimer = 0
let fadePromoteTimer = 0
/** True when this cells update should start a filter fade after the DOM settles. */
let fadeArmed = false
let motion: CellMotionBuffers | null = null
let slotCount = 0
/** Previous character order, reused so a reorder check does not allocate a joined string. */
const orderScratch: string[] = []
/** Visible card elements for the current measure pass. */
const visibleCells: SlottedCell[] = []
/** Card elements indexed by stable slot. */
const slottedCells: SlottedCell[] = []

interface SlottedCell extends HTMLElement {
  kmSlot?: number
}

/** DOM order stays put. Visual order is a transform, so a reorder does not move nodes. */
const stableCells = ref<MapCell[]>([])
const stableIndex = new Map<string, number>()
const nodeByCharacter = new Map<string, SlottedCell>()

/**
 * Filter / snapshot membership.
 * `exit-hold` keeps the current opacity and arms the fade; `exit` fades to 0.
 * `enter` mounts at opacity 0; `enter-live` fades to the resting opacity.
 * `show` fades a card back in after its exit was cancelled.
 */
type CellPresence = 'exit-hold' | 'exit' | 'enter' | 'enter-live' | 'show'
const presence = ref(new Map<string, CellPresence>())

const MOVE_TRANSITION = `transform ${CELL_MOVE_MS}ms ease-out, opacity ${CELL_FADE_MS}ms ease-out`

const STRIDE_X = CELL_W_PX + GAP_PX
const STRIDE_Y = CELL_H_PX + GAP_PX

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

const boardStyle = computed(() => {
  const trackCols = gridTrackColumnCount(columns.value)
  const rows = rowCount()
  const width = trackCols <= 0 ? 0 : trackCols * CELL_W_PX + Math.max(0, trackCols - 1) * GAP_PX
  const height = rows <= 0 ? 0 : rows * CELL_H_PX + Math.max(0, rows - 1) * GAP_PX
  return {
    width: `${width}px`,
    height: `${height}px`
  }
})

const rowLabelOffsets = computed(() => {
  const cols = columns.value
  const rows = rowCount(cols)
  const offsets: number[] = []
  for (let row = 0; row < rows; row++) offsets.push(row * cols)
  return offsets
})

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
    meaningCorrect: cell.meaningCorrect,
    meaningIncorrect: cell.meaningIncorrect,
    readingCorrect: cell.readingCorrect,
    readingIncorrect: cell.readingIncorrect,
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

function tooltipMeta(cell: MapCell): string {
  return `${schoolYearLabel(cell.schoolGrade, cell.inJoyoo)} / JLPT ${cell.jlptLevel ?? '—'} / WK ${wkLevelLabel(cell)}`
}

function tooltipAccuracy(cell: MapCell): string | null {
  if (props.showAccuracy === false) return null
  const label = accuracyLabel(cell)
  if (!label || label === '--') return null
  return label
}

function cellTitle(cell: MapCell): string {
  const meaning = cell.meaning?.trim()
  const parts = [
    tooltipMeta(cell),
    srsDisplayLabel(cell),
    meaning ? `${cell.character} ${meaning}` : cell.character
  ]
  const accuracy = tooltipAccuracy(cell)
  if (accuracy) parts.push(accuracy)
  return parts.join(', ')
}

const TOOLTIP_DELAY_MS = 400
const tooltipCell = ref<MapCell | null>(null)
const tooltipReference = ref<HTMLElement | null>(null)
const tooltipOpen = ref(false)
let tooltipTimer: ReturnType<typeof setTimeout> | null = null

const tooltipView = computed(() => {
  const cell = tooltipCell.value
  if (!cell) return null
  return {
    barColor: srsDisplayColor(cell),
    meta: tooltipMeta(cell),
    srs: srsDisplayLabel(cell),
    character: cell.character,
    meaning: cell.meaning?.trim() || null,
    accuracy: tooltipAccuracy(cell)
  }
})

function clearTooltipTimer() {
  if (tooltipTimer == null) return
  clearTimeout(tooltipTimer)
  tooltipTimer = null
}

function hideCellTooltip() {
  clearTooltipTimer()
  tooltipOpen.value = false
  tooltipCell.value = null
  tooltipReference.value = null
}

function onCellPointerEnter(cell: MapCell, event: PointerEvent) {
  const state = presence.value.get(cell.character)
  if (state === 'exit' || state === 'exit-hold') return
  if (event.pointerType === 'touch' || dragging.value) return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  clearTooltipTimer()
  tooltipCell.value = cell
  tooltipReference.value = target
  tooltipOpen.value = false
  tooltipTimer = setTimeout(() => {
    tooltipTimer = null
    if (tooltipReference.value === target) tooltipOpen.value = true
  }, TOOLTIP_DELAY_MS)
}

function onCellPointerLeave(event: PointerEvent) {
  const target = event.currentTarget
  if (target instanceof HTMLElement && tooltipReference.value !== target) return
  hideCellTooltip()
}

function strokesLabel(cell: MapCell): string {
  return cell.strokes != null ? String(cell.strokes) : '—'
}

function wkLevelLabel(cell: MapCell): string {
  return cell.wkLevel != null && cell.wkLevel > 0 ? String(cell.wkLevel) : '—'
}

const cellBoxStyle = {
  left: '0px',
  top: '0px',
  width: `${CELL_W_PX}px`,
  height: `${CELL_H_PX}px`
}

function cellStyle(cell: MapCell): Record<string, string> {
  return {
    ...cellBoxStyle,
    ...cellSecondaryStyle(
      props.secondaryColorPaint ?? 'border',
      props.colorMode,
      props.secondaryColorMode,
      cellVisualInput(cell),
      props.heatmapScale
    )
  }
}

function usesGradientPaint(paint: SecondaryColorPaint, secondaryMode: ColorMode): boolean {
  return paint === 'gradient' && secondaryMode !== 'none'
}

function secondaryGradientActive(): boolean {
  return usesGradientPaint(props.secondaryColorPaint ?? 'border', props.secondaryColorMode)
}

function commitPaintFrom() {
  paintFromPrimary = props.colorMode
  paintFromSecondary = props.secondaryColorMode
  paintFromPaint = props.secondaryColorPaint ?? 'border'
  paintFromReady = true
}

function stopColorLerpFrame() {
  if (colorTransitionFrame) cancelAnimationFrame(colorTransitionFrame)
  colorTransitionFrame = 0
  colorJobCount = 0
  colorLerpGradient = false
}

function clearLerpPaint(node: HTMLElement) {
  node.style.backgroundColor = ''
  node.style.backgroundImage = ''
}

function cancelColorLerp() {
  const buffers = colorBuffers
  const jobs = colorJobCount
  const gradient = colorLerpGradient
  stopColorLerpFrame()
  if (!buffers) return
  for (let i = 0; i < jobs; i++) {
    const node = slottedCells[buffers.jobSlot[i]!]
    if (!node) continue
    if (gradient) clearLerpPaint(node)
    else node.style.backgroundColor = ''
  }
}

function cellForNode(node: SlottedCell): MapCell | null {
  const character = node.dataset.character
  if (!character) return null
  const index = stableIndex.get(character)
  if (index == null) return null
  return stableCells.value[index] ?? null
}

/** Write primary/secondary stops for a paint mode into one end of the color buffers. */
function writeGradientStops(
  primaryMode: ColorMode,
  secondaryMode: ColorMode,
  paint: SecondaryColorPaint,
  cell: MapCell,
  slot: number,
  primaryR: Float32Array,
  primaryG: Float32Array,
  primaryB: Float32Array,
  secondaryR: Float32Array,
  secondaryG: Float32Array,
  secondaryB: Float32Array
): boolean {
  const input = cellVisualInput(cell)
  const primary = cellPaintColor(primaryMode, input, props.heatmapScale)
  if (!readHexRgbChannels(primary, slot, primaryR, primaryG, primaryB)) return false
  const secondary = usesGradientPaint(paint, secondaryMode)
    ? (cellBorderColor(secondaryMode, input, props.heatmapScale) ?? primary)
    : primary
  return readHexRgbChannels(secondary, slot, secondaryR, secondaryG, secondaryB)
}

function collectVisibleCells(): number {
  const root = viewport.value
  if (!root) return 0
  const live = root.getElementsByClassName('km-cell') as HTMLCollectionOf<SlottedCell>
  const count = live.length
  if (visibleCells.length < count) visibleCells.length = count
  for (let i = 0; i < count; i++) visibleCells[i] = live[i]!
  return count
}

function assignSlots(visibleCount: number) {
  let missing = 0
  for (let i = 0; i < visibleCount; i++) {
    if (visibleCells[i]!.kmSlot == null) missing += 1
  }
  if (missing > 0) {
    motion = ensureCellMotionBuffers(motion, slotCount + missing)
    if (slottedCells.length < motion.capacity) slottedCells.length = motion.capacity
    for (let i = 0; i < visibleCount; i++) {
      const node = visibleCells[i]!
      if (node.kmSlot != null) continue
      node.kmSlot = slotCount
      slotCount += 1
    }
  }
  ensureColorSlots()
}

function orderUnchanged(cells: readonly MapCell[]): boolean {
  if (orderScratch.length !== cells.length) return false
  for (let i = 0; i < cells.length; i++) {
    if (orderScratch[i] !== cells[i]!.character) return false
  }
  return true
}

function commitOrder(cells: readonly MapCell[]) {
  if (orderScratch.length < cells.length) orderScratch.length = cells.length
  for (let i = 0; i < cells.length; i++) orderScratch[i] = cells[i]!.character
  orderScratch.length = cells.length
}

function ensureColorSlots() {
  const capacity = Math.max(motion?.capacity ?? 0, slotCount)
  if (capacity === 0) return
  colorBuffers = ensureCellColorBuffers(colorBuffers, capacity)
}

function snapshotCellColors() {
  const count = collectVisibleCells()
  assignSlots(count)
  const buffers = colorBuffers
  if (!buffers || count === 0) return
  buffers.active.fill(0, 0, Math.min(slotCount, buffers.capacity))
  for (let i = 0; i < count; i++) {
    const node = visibleCells[i]!
    const slot = node.kmSlot
    if (slot == null) continue
    const readable = readCssRgbChannels(
      getComputedStyle(node).backgroundColor,
      slot,
      buffers.fromR,
      buffers.fromG,
      buffers.fromB
    )
    buffers.active[slot] = readable ? 1 : 0
    slottedCells[slot] = node
  }
}

function snapshotGradientColors(
  primaryMode: ColorMode,
  secondaryMode: ColorMode,
  paint: SecondaryColorPaint
) {
  const count = collectVisibleCells()
  assignSlots(count)
  const buffers = colorBuffers
  if (!buffers || count === 0) return
  buffers.active.fill(0, 0, Math.min(slotCount, buffers.capacity))
  for (let i = 0; i < count; i++) {
    const node = visibleCells[i]!
    const slot = node.kmSlot
    if (slot == null) continue
    const cell = cellForNode(node)
    if (!cell) continue
    const readable = writeGradientStops(
      primaryMode,
      secondaryMode,
      paint,
      cell,
      slot,
      buffers.fromR,
      buffers.fromG,
      buffers.fromB,
      buffers.fromSR,
      buffers.fromSG,
      buffers.fromSB
    )
    buffers.active[slot] = readable ? 1 : 0
    slottedCells[slot] = node
  }
}

function measureColorJobs(): number {
  const buffers = colorBuffers
  if (!buffers) return 0
  const count = collectVisibleCells()
  for (let i = 0; i < count; i++) clearLerpPaint(visibleCells[i]!)
  void viewport.value?.offsetWidth
  for (let i = 0; i < count; i++) {
    const node = visibleCells[i]!
    const slot = node.kmSlot
    if (slot == null || buffers.active[slot] === 0) continue
    readCssRgbChannels(
      getComputedStyle(node).backgroundColor,
      slot,
      buffers.toR,
      buffers.toG,
      buffers.toB
    )
    slottedCells[slot] = node
  }
  return packChangedColorSlots(buffers, slotCount)
}

function measureGradientJobs(
  primaryMode: ColorMode,
  secondaryMode: ColorMode,
  paint: SecondaryColorPaint
): number {
  const buffers = colorBuffers
  if (!buffers) return 0
  const count = collectVisibleCells()
  for (let i = 0; i < count; i++) {
    const node = visibleCells[i]!
    clearLerpPaint(node)
    const slot = node.kmSlot
    if (slot == null || buffers.active[slot] === 0) continue
    const cell = cellForNode(node)
    if (!cell) continue
    writeGradientStops(
      primaryMode,
      secondaryMode,
      paint,
      cell,
      slot,
      buffers.toR,
      buffers.toG,
      buffers.toB,
      buffers.toSR,
      buffers.toSG,
      buffers.toSB
    )
    slottedCells[slot] = node
  }
  return packChangedGradientSlots(buffers, slotCount)
}

function beginColorLerp(jobCount: number) {
  const buffers = colorBuffers
  if (!buffers || jobCount === 0) return
  if (colorTransitionFrame) cancelAnimationFrame(colorTransitionFrame)
  colorJobCount = jobCount
  colorLerpGradient = false
  for (let i = 0; i < jobCount; i++) {
    const slot = buffers.jobSlot[i]!
    const node = slottedCells[slot]
    if (!node) continue
    node.style.backgroundImage = ''
    node.style.backgroundColor = rgbCss(
      Math.round(buffers.fromR[slot]!),
      Math.round(buffers.fromG[slot]!),
      Math.round(buffers.fromB[slot]!)
    )
  }

  const startedAt = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - startedAt) / CELL_COLOR_LERP_MS)
    for (let i = 0; i < jobCount; i++) {
      const slot = buffers.jobSlot[i]!
      const node = slottedCells[slot]
      if (!node) continue
      if (t >= 1) {
        node.style.backgroundColor = ''
        continue
      }
      node.style.backgroundColor = rgbCss(
        lerpRgbChannel(buffers.fromR[slot]!, buffers.toR[slot]!, t),
        lerpRgbChannel(buffers.fromG[slot]!, buffers.toG[slot]!, t),
        lerpRgbChannel(buffers.fromB[slot]!, buffers.toB[slot]!, t)
      )
    }
    if (t < 1) {
      colorTransitionFrame = requestAnimationFrame(step)
      return
    }
    colorTransitionFrame = 0
    colorJobCount = 0
  }
  colorTransitionFrame = requestAnimationFrame(step)
}

function beginGradientLerp(jobCount: number, endUsesGradient: boolean) {
  const buffers = colorBuffers
  if (!buffers || jobCount === 0) return
  if (colorTransitionFrame) cancelAnimationFrame(colorTransitionFrame)
  colorJobCount = jobCount
  colorLerpGradient = true
  for (let i = 0; i < jobCount; i++) {
    const slot = buffers.jobSlot[i]!
    const node = slottedCells[slot]
    if (!node) continue
    node.style.backgroundColor = ''
    node.style.backgroundImage = gradientBackgroundImage(
      SECONDARY_GRADIENT_ANGLE_DEG,
      Math.round(buffers.fromR[slot]!),
      Math.round(buffers.fromG[slot]!),
      Math.round(buffers.fromB[slot]!),
      Math.round(buffers.fromSR[slot]!),
      Math.round(buffers.fromSG[slot]!),
      Math.round(buffers.fromSB[slot]!)
    )
  }

  const startedAt = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - startedAt) / CELL_COLOR_LERP_MS)
    for (let i = 0; i < jobCount; i++) {
      const slot = buffers.jobSlot[i]!
      const node = slottedCells[slot]
      if (!node) continue
      if (t >= 1) {
        if (endUsesGradient) {
          node.style.backgroundImage = gradientBackgroundImage(
            SECONDARY_GRADIENT_ANGLE_DEG,
            Math.round(buffers.toR[slot]!),
            Math.round(buffers.toG[slot]!),
            Math.round(buffers.toB[slot]!),
            Math.round(buffers.toSR[slot]!),
            Math.round(buffers.toSG[slot]!),
            Math.round(buffers.toSB[slot]!)
          )
        } else {
          clearLerpPaint(node)
        }
        continue
      }
      node.style.backgroundImage = gradientBackgroundImage(
        SECONDARY_GRADIENT_ANGLE_DEG,
        lerpRgbChannel(buffers.fromR[slot]!, buffers.toR[slot]!, t),
        lerpRgbChannel(buffers.fromG[slot]!, buffers.toG[slot]!, t),
        lerpRgbChannel(buffers.fromB[slot]!, buffers.toB[slot]!, t),
        lerpRgbChannel(buffers.fromSR[slot]!, buffers.toSR[slot]!, t),
        lerpRgbChannel(buffers.fromSG[slot]!, buffers.toSG[slot]!, t),
        lerpRgbChannel(buffers.fromSB[slot]!, buffers.toSB[slot]!, t)
      )
    }
    if (t < 1) {
      colorTransitionFrame = requestAnimationFrame(step)
      return
    }
    colorTransitionFrame = 0
    colorJobCount = 0
    colorLerpGradient = false
  }
  colorTransitionFrame = requestAnimationFrame(step)
}

function snapshotPaintColors(gradient: boolean) {
  if (gradient) {
    snapshotGradientColors(
      paintFromReady ? paintFromPrimary : props.colorMode,
      paintFromReady ? paintFromSecondary : props.secondaryColorMode,
      paintFromReady ? paintFromPaint : (props.secondaryColorPaint ?? 'border')
    )
    return
  }
  snapshotCellColors()
}

function finishPaintLerp(gradient: boolean) {
  if (gradient) {
    const paint = props.secondaryColorPaint ?? 'border'
    const jobs = measureGradientJobs(props.colorMode, props.secondaryColorMode, paint)
    commitPaintFrom()
    if (jobs === 0) return
    beginGradientLerp(jobs, usesGradientPaint(paint, props.secondaryColorMode))
    return
  }
  commitPaintFrom()
  const jobs = measureColorJobs()
  if (jobs === 0) return
  beginColorLerp(jobs)
}

watch(colorTransitionId, (id) => {
  if (id <= 0) {
    capturedTransitionId = null
    return
  }
  cancelColorLerp()
  capturedTransitionId = id
  snapshotPaintColors(secondaryGradientActive() || usesGradientPaint(paintFromPaint, paintFromSecondary))
}, { flush: 'sync' })

watch(() => props.cells, () => {
  if (capturedTransitionId == null || capturedTransitionId !== colorTransitionId.value) return
  const gradient = secondaryGradientActive()
    || usesGradientPaint(paintFromPaint, paintFromSecondary)
  capturedTransitionId = null
  finishPaintLerp(gradient)
}, { flush: 'post' })

watch(
  () => [props.colorMode, props.secondaryColorMode, props.secondaryColorPaint ?? 'border'] as const,
  (next) => {
    capturedTransitionId = null
    const nextPaint = next[2]
    const gradient = usesGradientPaint(paintFromReady ? paintFromPaint : nextPaint, paintFromReady ? paintFromSecondary : next[1])
      || usesGradientPaint(nextPaint, next[1])
    cancelColorLerp()
    snapshotPaintColors(gradient)
  },
  { flush: 'pre' }
)

watch(
  () => [props.colorMode, props.secondaryColorMode, props.secondaryColorPaint ?? 'border'] as const,
  (next) => {
    const nextPaint = next[2]
    const gradient = usesGradientPaint(paintFromReady ? paintFromPaint : nextPaint, paintFromReady ? paintFromSecondary : next[1])
      || usesGradientPaint(nextPaint, next[1])
    finishPaintLerp(gradient)
  },
  { flush: 'post' }
)

function ensureStable(cells: readonly MapCell[]) {
  const current = stableCells.value
  if (current.length === cells.length && current.length > 0) {
    let sameMembers = true
    for (let i = 0; i < cells.length; i++) {
      if (!stableIndex.has(cells[i]!.character)) {
        sameMembers = false
        break
      }
    }
    if (sameMembers) {
      let changed = false
      const next = current.slice()
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]!
        const index = stableIndex.get(cell.character)!
        if (next[index] !== cell) {
          next[index] = cell
          changed = true
        }
      }
      if (changed) stableCells.value = next
      return
    }
  }

  const sorted = cells.slice().sort((a, b) => a.character < b.character ? -1 : a.character > b.character ? 1 : 0)
  stableIndex.clear()
  for (let i = 0; i < sorted.length; i++) stableIndex.set(sorted[i]!.character, i)
  stableCells.value = sorted
}

function clearMoveTransitions() {
  const count = collectVisibleCells()
  for (let i = 0; i < count; i++) {
    const node = visibleCells[i]!
    if (node.style.transition === 'none' || node.style.transition.includes('transform')) {
      node.style.transition = ''
    }
  }
}

/** Stop in-flight slides and pin every card to its real grid cell. */
function commitGridPositions() {
  const buffers = motion
  if (!buffers) return
  const cells = props.cells
  for (let i = 0; i < cells.length; i++) {
    const node = nodeByCharacter.get(cells[i]!.character)
    if (!node) continue
    if (typeof node.getAnimations === 'function') {
      for (const animation of node.getAnimations()) {
        if ('transitionProperty' in animation && animation.transitionProperty === 'opacity') continue
        animation.cancel()
      }
    }
    node.style.transition = 'none'
    node.style.transform = translateOf(buffers.toX[i]!, buffers.toY[i]!)
  }
  void viewport.value?.offsetWidth
  clearMoveTransitions()
}

function translateOf(x: number, y: number): string {
  return `translate(${x}px, ${y}px)`
}

function placeCells(animate: boolean) {
  const cells = props.cells
  const count = cells.length
  if (count === 0) return
  motion = ensureCellMotionBuffers(motion, count)
  const buffers = motion
  if (!buffers) return
  fillGridPositions(count, columns.value, STRIDE_X, 0, STRIDE_X, STRIDE_Y, buffers.toX, buffers.toY)

  const visible = collectVisibleCells()
  for (let i = 0; i < visible; i++) {
    const node = visibleCells[i]!
    const character = node.dataset.character
    if (character) nodeByCharacter.set(character, node)
  }

  if (moveTimer) {
    clearTimeout(moveTimer)
    moveTimer = 0
  }
  const generation = ++moveGeneration
  const root = viewport.value
  const view = animate && root
    ? boardViewFromViewport(root.clientWidth, root.clientHeight, translate.x, translate.y, scale.value, PAD_PX)
    : null

  if (!animate || !view) {
    for (let i = 0; i < count; i++) {
      const node = nodeByCharacter.get(cells[i]!.character)
      if (!node) continue
      const next = translateOf(buffers.toX[i]!, buffers.toY[i]!)
      if (node.style.transform === next) continue
      node.style.transition = 'none'
      node.style.transform = next
    }
    requestAnimationFrame(() => {
      if (generation !== moveGeneration) return
      clearMoveTransitions()
    })
    return
  }

  for (let i = 0; i < count; i++) {
    const node = nodeByCharacter.get(cells[i]!.character)
    const visual = node ? getComputedStyle(node).transform : ''
    if (!node || !readTranslate(visual, i, buffers.fromX, buffers.fromY)) {
      buffers.fromX[i] = buffers.toX[i]!
      buffers.fromY[i] = buffers.toY[i]!
    }
  }

  const exitY = rowPastBottom(view.bottom, STRIDE_Y)
  const moving = planCellMoves(buffers, count, CELL_W_PX, CELL_H_PX, view, exitY)
  const instant: HTMLElement[] = []
  if (moving === 0) {
    for (let i = 0; i < count; i++) {
      const kind = buffers.kind[i]
      if (kind !== CELL_MOVE_SNAP && kind !== CELL_MOVE_STAY) continue
      const node = nodeByCharacter.get(cells[i]!.character)
      if (!node) continue
      const next = translateOf(buffers.toX[i]!, buffers.toY[i]!)
      if (kind === CELL_MOVE_STAY && node.style.transform === next) continue
      node.style.transition = 'none'
      node.style.transform = next
      if (kind === CELL_MOVE_STAY) instant.push(node)
    }
    releaseInstantTransitions(instant)
    return
  }

  let entering = false
  for (let i = 0; i < count; i++) {
    const node = nodeByCharacter.get(cells[i]!.character)
    if (!node) continue
    const kind = buffers.kind[i]
    if (kind === CELL_MOVE_ENTER) {
      const fromY = buffers.fromY[i]!
      const stageY = fromY + CELL_H_PX <= view.top
        ? rowBeforeTop(view.top, CELL_H_PX, STRIDE_Y)
        : exitY
      node.style.transition = 'none'
      node.style.transform = translateOf(buffers.toX[i]!, stageY)
      entering = true
      continue
    }
    if (kind === CELL_MOVE_SNAP) {
      node.style.transition = 'none'
      node.style.transform = translateOf(buffers.toX[i]!, buffers.toY[i]!)
      continue
    }
    if (kind === CELL_MOVE_STAY) {
      const next = translateOf(buffers.toX[i]!, buffers.toY[i]!)
      if (node.style.transform === next) continue
      node.style.transition = 'none'
      node.style.transform = next
      instant.push(node)
      continue
    }
    if (kind !== CELL_MOVE_SLIDE && kind !== CELL_MOVE_EXIT) continue
    node.style.transition = MOVE_TRANSITION
    node.style.transform = translateOf(buffers.moveX[i]!, buffers.moveY[i]!)
  }

  releaseInstantTransitions(instant)

  if (entering) void root?.offsetWidth

  if (entering) {
    requestAnimationFrame(() => {
      if (generation !== moveGeneration) return
      for (let i = 0; i < count; i++) {
        if (buffers.kind[i] !== CELL_MOVE_ENTER) continue
        const node = nodeByCharacter.get(cells[i]!.character)
        if (!node) continue
        node.style.transition = MOVE_TRANSITION
        node.style.transform = translateOf(buffers.moveX[i]!, buffers.moveY[i]!)
      }
    })
  }

  moveTimer = window.setTimeout(() => {
    if (generation !== moveGeneration) return
    commitGridPositions()
    moveTimer = 0
  }, CELL_MOVE_MS + 80)
}

function releaseInstantTransitions(nodes: readonly HTMLElement[]) {
  if (nodes.length === 0) return
  void viewport.value?.offsetWidth
  for (const node of nodes) {
    if (node.style.transition === 'none') node.style.transition = ''
  }
}

function exitingCharacters(): Set<string> {
  const exiting = new Set<string>()
  for (const [character, state] of presence.value) {
    if (state === 'exit' || state === 'exit-hold') exiting.add(character)
  }
  return exiting
}

function replaceStable(mounted: readonly MapCell[]) {
  const sorted = mounted.slice().sort((a, b) => (
    a.character < b.character ? -1 : a.character > b.character ? 1 : 0
  ))
  stableIndex.clear()
  for (let i = 0; i < sorted.length; i++) stableIndex.set(sorted[i]!.character, i)
  stableCells.value = sorted
}

function membersMatch(cells: readonly MapCell[], exiting: ReadonlySet<string>): boolean {
  if (stableCells.value.length !== cells.length) return false
  for (let i = 0; i < cells.length; i++) {
    const character = cells[i]!.character
    if (!stableIndex.has(character) || exiting.has(character)) return false
  }
  return true
}

function syncMembership(cells: readonly MapCell[]) {
  const exiting = exitingCharacters()
  if (stableCells.value.length === 0 || membersMatch(cells, exiting)) {
    ensureStable(cells)
    return { exit: [] as string[], enter: [] as string[], restore: [] as string[] }
  }
  const plan = planCellPresence(stableCells.value, cells, exiting)
  const catalog = new Map<string, MapCell>()
  for (const cell of props.catalog ?? []) catalog.set(cell.character, cell)
  replaceStable(plan.mounted.map(cell => catalog.get(cell.character) ?? cell))
  return plan
}

const pinX = new Float64Array(1)
const pinY = new Float64Array(1)

/** Hold a leaving card on its current pixel so neighbors can slide underneath the fade. */
function pinExitingNodes() {
  const pinned: HTMLElement[] = []
  for (const cell of stableCells.value) {
    if (presence.value.get(cell.character) !== 'exit-hold') continue
    const node = nodeByCharacter.get(cell.character)
    if (!node) continue
    if (!readTranslate(getComputedStyle(node).transform, 0, pinX, pinY)) continue
    node.style.transition = 'none'
    node.style.transform = translateOf(pinX[0]!, pinY[0]!)
    pinned.push(node)
  }
  releaseInstantTransitions(pinned)
}

function promoteFades() {
  const next = new Map(presence.value)
  let changed = false
  for (const [character, state] of next) {
    if (state === 'exit-hold') {
      next.set(character, 'exit')
      changed = true
    } else if (state === 'enter') {
      next.set(character, 'enter-live')
      changed = true
    }
  }
  if (changed) presence.value = next
}

function finishFades(generation: number) {
  if (generation !== fadeGeneration) return
  fadeTimer = 0
  const next = new Map(presence.value)
  for (const [character, state] of presence.value) {
    if (
      state === 'exit'
      || state === 'exit-hold'
      || state === 'enter'
      || state === 'enter-live'
      || state === 'show'
    ) {
      next.delete(character)
    }
  }
  presence.value = next
  const live = new Set<string>()
  for (const cell of props.cells) live.add(cell.character)
  const kept: MapCell[] = []
  for (const cell of stableCells.value) {
    if (live.has(cell.character) || next.has(cell.character)) kept.push(cell)
  }
  if (kept.length !== stableCells.value.length) replaceStable(kept)
}

function armFadeClock() {
  const generation = ++fadeGeneration
  if (fadeTimer) {
    clearTimeout(fadeTimer)
    fadeTimer = 0
  }
  if (fadePromoteTimer) {
    clearTimeout(fadePromoteTimer)
    fadePromoteTimer = 0
  }
  // Wait one turn so the resting opacity paints, then fade. Removal is scheduled
  // only after that fade starts, so a late timer cannot drop the card at full opacity.
  fadePromoteTimer = window.setTimeout(() => {
    fadePromoteTimer = 0
    if (generation !== fadeGeneration) return
    promoteFades()
    fadeTimer = window.setTimeout(() => finishFades(generation), CELL_FADE_MS + 80)
  }, 32)
}

let placeAnimated = false

watch(() => props.cells, (cells) => {
  placeAnimated = orderScratch.length > 0 && !orderUnchanged(cells)
  const plan = syncMembership(cells)
  fadeArmed = false
  if (plan.exit.length === 0 && plan.enter.length === 0 && plan.restore.length === 0) return
  const next = new Map(presence.value)
  for (const character of plan.restore) {
    if (next.get(character) === 'exit') next.set(character, 'show')
    else next.delete(character)
  }
  for (const character of plan.exit) next.set(character, 'exit-hold')
  for (const character of plan.enter) next.set(character, 'enter')
  presence.value = next
  fadeArmed = true
  if (tooltipCell.value && plan.exit.includes(tooltipCell.value.character)) hideCellTooltip()
}, { flush: 'pre' })

watch(() => props.cells, (cells) => {
  placeCells(placeAnimated)
  commitOrder(cells)
  if (!fadeArmed) return
  fadeArmed = false
  pinExitingNodes()
  armFadeClock()
}, { flush: 'post' })

ensureStable(props.cells)
commitPaintFrom()

onUnmounted(() => {
  moveGeneration += 1
  fadeGeneration += 1
  if (moveTimer) clearTimeout(moveTimer)
  if (fadeTimer) clearTimeout(fadeTimer)
  if (fadePromoteTimer) clearTimeout(fadePromoteTimer)
  if (colorTransitionFrame) cancelAnimationFrame(colorTransitionFrame)
})

function dimmed(cell: MapCell): boolean {
  return isMapCellDimmed(cell, props.highlightFilters)
}

function presenceClass(cell: MapCell): string {
  const state = presence.value.get(cell.character)
  const opacity = dimmed(cell) ? 'opacity-20' : 'opacity-100'
  const hover = dimmed(cell) ? '' : ' hover:ring-2 hover:ring-[#ffffff]'
  const fade = 'transition-opacity duration-1000 ease-out'
  if (state === 'exit' || state === 'exit-hold') {
    const shown = state === 'exit' ? 'opacity-0' : opacity
    return `pointer-events-none z-[2] ${shown} ${fade}`
  }
  if (state === 'enter') return `opacity-0 ${fade}`
  if (state === 'enter-live' || state === 'show') return `${opacity}${hover} ${fade}`
  return `${opacity}${hover} transition-opacity`
}

function stepColumns(direction: -1 | 1) {
  const next = stepGridColumns(columns.value, direction)
  if (next === columns.value) return
  columns.value = next
}

function onWheel(event: WheelEvent) {
  hideCellTooltip()
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
  hideCellTooltip()
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

/** Arrow keys also drive selects and menus. Panning on those events scrolls the map while the order menu moves. */
function mapShortcutBlocked(event: KeyboardEvent): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true
  }
  if (target instanceof HTMLElement && target.isContentEditable) return true
  return Boolean(target.closest('[role="listbox"], [role="menu"], [role="dialog"], [role="combobox"]'))
}

function onWindowKeyDown(event: KeyboardEvent) {
  if (props.keyboardEnabled === false) return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (mapShortcutBlocked(event)) return

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
  commitOrder(props.cells)
  placeCells(false)
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
  hideCellTooltip()
  window.removeEventListener('keydown', onWindowKeyDown)
  resizeObserver?.disconnect()
})

watch(columns, () => {
  placeCells(false)
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
        class="relative"
        :style="boardStyle"
      >
        <div
          v-for="(offset, row) in rowLabelOffsets"
          :key="`row-${row}`"
          class="pointer-events-none absolute flex items-center justify-center bg-transparent"
          :style="{
            width: `${CELL_W_PX}px`,
            height: `${CELL_H_PX}px`,
            transform: `translate(0px, ${row * STRIDE_Y}px)`
          }"
          :aria-label="`Row starting at cell ${offset}`"
        >
          <span class="select-none text-center text-xs font-bold leading-none text-highlighted">
            {{ offset }}
          </span>
        </div>
        <button
          v-for="cell in stableCells"
          :key="cell.character"
          type="button"
          class="km-cell absolute flex items-center justify-center rounded-sm text-base font-medium leading-none"
          :class="[cellClass(cell), presenceClass(cell)]"
          :style="cellStyle(cell)"
          :data-character="cell.character"
          :aria-description="cellTitle(cell)"
          @click="onCellClick(cell.character)"
          @pointerenter="onCellPointerEnter(cell, $event)"
          @pointerleave="onCellPointerLeave"
        >
          <span class="km-kanji select-none text-gray-900 dark:text-gray-950">{{ cell.character }}</span>
          <span
            class="pointer-events-none absolute top-0.5 left-0.5 text-[0.6rem] font-bold leading-none text-gray-900"
          >
            {{ cell.joyoIndex + 1 }}
          </span>
          <span
            class="top-0.5 right-0.5"
            :class="CELL_META_CLASS"
          >
            {{ strokesLabel(cell) }}
          </span>
          <span
            v-if="showAccuracy !== false"
            class="top-1/2 left-0.5 -translate-y-1/2"
            :class="CELL_META_CLASS"
          >
            {{ wkLevelLabel(cell) }}
          </span>
          <span
            v-if="showAccuracy !== false"
            class="bottom-0.5 left-0.5"
            :class="CELL_META_CLASS"
          >
            {{ accuracyLabel(cell) }}
          </span>
          <span
            class="bottom-0.5 right-0.5"
            :class="CELL_META_CLASS"
          >
            {{ cell.readingCount }}
          </span>
        </button>
      </div>
    </div>
    <UTooltip
      :open="tooltipOpen && tooltipView != null"
      :reference="tooltipReference ?? undefined"
      :content="{ side: 'top', sideOffset: 6 }"
      :ui="{ content: 'h-auto flex-col items-stretch overflow-hidden px-0 py-0 text-sm' }"
    >
      <template #content>
        <div
          v-if="tooltipView"
          class="flex min-w-64 flex-col"
        >
          <div
            class="h-[3px] w-full"
            :style="{ backgroundColor: tooltipView.barColor }"
          />
          <div class="flex flex-col gap-1 px-2.5 py-2">
            <div class="flex items-baseline justify-between gap-4">
              <span>{{ tooltipView.meta }}</span>
              <span class="shrink-0">{{ tooltipView.srs }}</span>
            </div>
            <div class="flex items-baseline justify-between gap-4">
              <span class="min-w-0">
                <span class="km-kanji text-base">{{ tooltipView.character }}</span>
                <span
                  v-if="tooltipView.meaning"
                  class="ml-1.5"
                >{{ tooltipView.meaning }}</span>
              </span>
              <span
                v-if="tooltipView.accuracy"
                class="shrink-0"
              >{{ tooltipView.accuracy }}</span>
            </div>
          </div>
        </div>
      </template>
    </UTooltip>
  </div>
</template>
