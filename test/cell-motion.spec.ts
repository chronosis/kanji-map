import { describe, expect, it } from 'vitest'
import {
  CELL_MOVE_ENTER,
  CELL_MOVE_EXIT,
  CELL_MOVE_SLIDE,
  CELL_MOVE_SNAP,
  CELL_MOVE_STAY,
  boardRectIntersects,
  boardViewFromViewport,
  createCellMotionBuffers,
  ensureCellMotionBuffers,
  fillCellMoveDeltas,
  fillGridPositions,
  planCellMoves,
  readTranslate,
  rowBeforeTop,
  rowPastBottom
} from '../shared/utils/cell-motion'

describe('cell-motion', () => {
  it('reuses a buffer when it is already large enough and doubles when it is not', () => {
    const first = createCellMotionBuffers(2)
    first.fromX[0] = 5
    expect(ensureCellMotionBuffers(first, 2)).toBe(first)

    const grown = ensureCellMotionBuffers(first, 3)
    expect(grown).not.toBe(first)
    expect(grown.capacity).toBe(4)
    expect(grown.fromX[0]).toBe(5)
  })

  it('packs scaled deltas and skips cards that barely moved', () => {
    const buffers = createCellMotionBuffers(3)
    buffers.fromX[0] = 10
    buffers.fromY[0] = 20
    buffers.toX[0] = 30
    buffers.toY[0] = 50
    buffers.active[0] = 1
    buffers.present[0] = 1

    buffers.fromX[1] = 0
    buffers.fromY[1] = 0
    buffers.toX[1] = 0.4
    buffers.toY[1] = 0
    buffers.active[1] = 1
    buffers.present[1] = 1

    buffers.fromX[2] = 8
    buffers.toX[2] = 0
    buffers.active[2] = 1
    buffers.present[2] = 0

    expect(fillCellMoveDeltas(buffers, 3, 2)).toBe(1)
    expect(buffers.moveSlot[0]).toBe(0)
    expect(buffers.moveX[0]).toBe(-10)
    expect(buffers.moveY[0]).toBe(-15)
    expect(fillCellMoveDeltas(buffers, 3, 0)).toBe(0)
  })

  it('writes grid coordinates into preallocated buffers', () => {
    const x = new Float64Array(3)
    const y = new Float64Array(3)
    fillGridPositions(3, 2, 45, 0, 45, 56, x, y)
    expect([...x]).toEqual([45, 90, 45])
    expect([...y]).toEqual([0, 0, 56])
  })

  it('parks cards that leave the viewport one row below the screen, in their new column', () => {
    expect(rowPastBottom(392, 56)).toBe(392)
    expect(rowPastBottom(500, 56)).toBe(504)
    expect(rowBeforeTop(102, 55, 56)).toBe(0)
    expect(rowBeforeTop(-8, 55, 56)).toBe(-112)
    const view = boardViewFromViewport(400, 400, 0, 0, 1, 8)
    expect(view).toEqual({ left: -8, top: -8, right: 392, bottom: 392 })
    expect(boardRectIntersects(45, 0, 44, 55, view!)).toBe(true)
    expect(boardRectIntersects(45, 504, 44, 55, view!)).toBe(false)

    const buffers = createCellMotionBuffers(4)
    buffers.fromX.set([45, 90, 45, 2000])
    buffers.fromY.set([0, 0, 56, 2000])
    buffers.toX.set([90, 45, 45, 90])
    buffers.toY.set([0, 560, 56, 0])
    expect(readTranslate('translate(45px, 0px)', 0, buffers.fromX, buffers.fromY)).toBe(true)
    expect(readTranslate('translate(12px)', 0, buffers.fromX, buffers.fromY)).toBe(true)
    expect(buffers.fromY[0]).toBe(0)
    expect(readTranslate('matrix(1, 0, 0, 1, 45, 112)', 0, buffers.fromX, buffers.fromY)).toBe(true)
    expect(buffers.fromX[0]).toBe(45)
    expect(buffers.fromY[0]).toBe(112)

    expect(planCellMoves(buffers, 4, 44, 55, view!, 392)).toBe(3)
    expect(buffers.kind[0]).toBe(CELL_MOVE_SLIDE)
    expect(buffers.moveX[0]).toBe(90)
    expect(buffers.moveY[0]).toBe(0)
    expect(buffers.kind[1]).toBe(CELL_MOVE_EXIT)
    expect(buffers.moveX[1]).toBe(45)
    expect(buffers.moveY[1]).toBe(392)
    expect(buffers.toY[1]).toBe(560)
    expect(buffers.kind[2]).toBe(CELL_MOVE_STAY)
    expect(buffers.kind[3]).toBe(CELL_MOVE_ENTER)
    expect(buffers.moveX[3]).toBe(90)
    expect(buffers.moveY[3]).toBe(0)

    buffers.fromX[0] = 2000
    buffers.fromY[0] = 2000
    buffers.toX[0] = 3000
    buffers.toY[0] = 3000
    planCellMoves(buffers, 1, 44, 55, view!, 392)
    expect(buffers.kind[0]).toBe(CELL_MOVE_SNAP)
    expect(boardViewFromViewport(0, 400, 0, 0, 1, 8)).toBeNull()
  })
})
