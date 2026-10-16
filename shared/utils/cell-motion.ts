/** Card reorder slide. Matches the color-blend duration so tiles have time to travel. */
export const CELL_MOVE_MS = 1500

/** Fade when a card crosses a filter. Matches the stage-color blend. */
export const CELL_FADE_MS = 1000

export interface CellMotionBuffers {
  capacity: number
  /** Previous screen position, indexed by stable card slot. */
  fromX: Float64Array
  fromY: Float64Array
  /** Next screen position, indexed by stable card slot. */
  toX: Float64Array
  toY: Float64Array
  /** 1 when this slot was on screen before the reorder. */
  active: Uint8Array
  /** 1 when this slot is still on screen after the reorder. */
  present: Uint8Array
  /** Packed list of slots that actually moved. */
  moveSlot: Uint16Array
  moveX: Float64Array
  moveY: Float64Array
  /**
   * Per visual index: 0 stay, 1 slide to the true cell, 2 slide off the bottom then snap,
   * 3 enter from one row below, 4 snap with no slide.
   */
  kind: Uint8Array
}

export function createCellMotionBuffers(capacity: number): CellMotionBuffers {
  const size = Math.max(0, capacity)
  return {
    capacity: size,
    fromX: new Float64Array(size),
    fromY: new Float64Array(size),
    toX: new Float64Array(size),
    toY: new Float64Array(size),
    active: new Uint8Array(size),
    present: new Uint8Array(size),
    moveSlot: new Uint16Array(size),
    moveX: new Float64Array(size),
    moveY: new Float64Array(size),
    kind: new Uint8Array(size)
  }
}

/** Grow by doubling when the kanji count exceeds the current allocation. Copies filled data. */
export function ensureCellMotionBuffers(
  existing: CellMotionBuffers | null,
  minCapacity: number
): CellMotionBuffers {
  if (existing && existing.capacity >= minCapacity) return existing
  const capacity = existing
    ? Math.max(minCapacity, existing.capacity * 2)
    : Math.max(minCapacity, 1)
  const next = createCellMotionBuffers(capacity)
  if (!existing) return next
  next.fromX.set(existing.fromX)
  next.fromY.set(existing.fromY)
  next.toX.set(existing.toX)
  next.toY.set(existing.toY)
  next.active.set(existing.active)
  next.present.set(existing.present)
  next.kind.set(existing.kind)
  return next
}

/**
 * Pack layout-space deltas into `moveX` / `moveY` / `moveSlot`.
 * Screen deltas are divided by the map scale because card transforms sit inside a scaled parent.
 * Returns how many cards moved.
 */
export function fillCellMoveDeltas(
  buffers: CellMotionBuffers,
  slotCount: number,
  scale: number
): number {
  if (scale <= 0 || slotCount <= 0) return 0
  const inverseScale = 1 / scale
  const limit = Math.min(slotCount, buffers.capacity)
  let moved = 0
  for (let slot = 0; slot < limit; slot++) {
    if (buffers.active[slot] === 0 || buffers.present[slot] === 0) continue
    const x = (buffers.fromX[slot]! - buffers.toX[slot]!) * inverseScale
    const y = (buffers.fromY[slot]! - buffers.toY[slot]!) * inverseScale
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) continue
    buffers.moveX[moved] = x
    buffers.moveY[moved] = y
    buffers.moveSlot[moved] = slot
    moved++
  }
  return moved
}

/**
 * Visual slot of each card in a fixed-size grid.
 * `originX` / `originY` skip the row-index gutter. Positions are local CSS pixels, so the parent scale does not apply.
 */
export function fillGridPositions(
  count: number,
  columns: number,
  originX: number,
  originY: number,
  strideX: number,
  strideY: number,
  outX: Float64Array,
  outY: Float64Array
): void {
  const limit = Math.min(count, outX.length, outY.length)
  const cols = Math.max(1, columns)
  for (let i = 0; i < limit; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    outX[i] = originX + col * strideX
    outY[i] = originY + row * strideY
  }
}

export interface BoardRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Map viewport edges into board coordinates. The board sits inside the scaled, padded layer. */
export function boardViewFromViewport(
  viewportWidth: number,
  viewportHeight: number,
  translateX: number,
  translateY: number,
  scale: number,
  pad: number
): BoardRect | null {
  if (scale <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return null
  const inverseScale = 1 / scale
  return {
    left: -translateX * inverseScale - pad,
    top: -translateY * inverseScale - pad,
    right: (viewportWidth - translateX) * inverseScale - pad,
    bottom: (viewportHeight - translateY) * inverseScale - pad
  }
}

export function boardRectIntersects(
  x: number,
  y: number,
  width: number,
  height: number,
  view: BoardRect
): boolean {
  return x < view.right && x + width > view.left && y < view.bottom && y + height > view.top
}

/** Top of the row that begins just below the visible board area. */
export function rowPastBottom(viewBottom: number, strideY: number): number {
  if (strideY <= 0) return viewBottom
  const lastVisibleRow = Math.floor((viewBottom - 1) / strideY)
  return (lastVisibleRow + 1) * strideY
}

/** Top of the row that sits just above the visible board area. */
export function rowBeforeTop(viewTop: number, cellHeight: number, strideY: number): number {
  if (strideY <= 0) return viewTop - cellHeight
  const firstVisibleRow = Math.floor((viewTop - cellHeight) / strideY) + 1
  return (firstVisibleRow - 1) * strideY
}

export const CELL_MOVE_STAY = 0
export const CELL_MOVE_SLIDE = 1
export const CELL_MOVE_EXIT = 2
export const CELL_MOVE_ENTER = 3
export const CELL_MOVE_SNAP = 4

const TRANSLATE = /translate(?:3d)?\(\s*(-?[\d.]+)px(?:\s*,\s*(-?[\d.]+)px)?/
const MATRIX = /matrix\(\s*(-?[\d.eE]+)(?:px)?\s*,\s*(-?[\d.eE]+)(?:px)?\s*,\s*(-?[\d.eE]+)(?:px)?\s*,\s*(-?[\d.eE]+)(?:px)?\s*,\s*(-?[\d.eE]+)(?:px)?\s*,\s*(-?[\d.eE]+)(?:px)?\s*\)/

/** Read a translate from a specified `translate()` or a computed `matrix()`. A missing y is 0. */
export function readTranslate(
  transform: string,
  index: number,
  outX: Float64Array,
  outY: Float64Array
): boolean {
  const translate = TRANSLATE.exec(transform)
  if (translate) {
    outX[index] = Number(translate[1])
    outY[index] = translate[2] == null ? 0 : Number(translate[2])
    return true
  }
  const matrix = MATRIX.exec(transform)
  if (!matrix) return false
  outX[index] = Number(matrix[5])
  outY[index] = Number(matrix[6])
  return true
}

/**
 * Choose where each card should slide.
 * Cards that leave the viewport slide to one row below the screen, in their new column.
 * Cards that enter are staged on that same row, then slide to `moveX` / `moveY`.
 * `toX` / `toY` stay the real grid position. `moveX` / `moveY` are the on-screen animation target.
 * Returns how many cards should animate.
 */
export function planCellMoves(
  buffers: CellMotionBuffers,
  count: number,
  width: number,
  height: number,
  view: BoardRect,
  exitY: number
): number {
  const limit = Math.min(count, buffers.capacity)
  let moving = 0
  for (let i = 0; i < limit; i++) {
    const fromX = buffers.fromX[i]!
    const fromY = buffers.fromY[i]!
    const toX = buffers.toX[i]!
    const toY = buffers.toY[i]!
    const fromVisible = boardRectIntersects(fromX, fromY, width, height, view)
    const toVisible = boardRectIntersects(toX, toY, width, height, view)
    if (fromVisible && toVisible) {
      if (Math.abs(fromX - toX) < 0.5 && Math.abs(fromY - toY) < 0.5) {
        buffers.kind[i] = CELL_MOVE_STAY
        continue
      }
      buffers.moveX[i] = toX
      buffers.moveY[i] = toY
      buffers.kind[i] = CELL_MOVE_SLIDE
      moving++
      continue
    }
    if (fromVisible && !toVisible) {
      buffers.moveX[i] = toX
      buffers.moveY[i] = exitY
      buffers.kind[i] = CELL_MOVE_EXIT
      moving++
      continue
    }
    if (!fromVisible && toVisible) {
      buffers.moveX[i] = toX
      buffers.moveY[i] = toY
      buffers.kind[i] = CELL_MOVE_ENTER
      moving++
      continue
    }
    buffers.moveX[i] = toX
    buffers.moveY[i] = toY
    buffers.kind[i] = CELL_MOVE_SNAP
  }
  return moving
}
