import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRID_COLUMNS,
  GRID_COLUMN_OPTIONS,
  buildMapGridTrackItems,
  gridTrackColumnCount,
  isGridColumnCount,
  rowOffsetLabel,
  stepGridColumns
} from '../shared/utils/grid-columns'

describe('grid-columns', () => {
  it('defaults to 40 and lists 25–70 by fives', () => {
    expect(DEFAULT_GRID_COLUMNS).toBe(40)
    expect([...GRID_COLUMN_OPTIONS]).toEqual([25, 30, 35, 40, 45, 50, 55, 60, 65, 70])
  })

  it('validates column counts', () => {
    expect(isGridColumnCount(40)).toBe(true)
    expect(isGridColumnCount(25)).toBe(true)
    expect(isGridColumnCount(70)).toBe(true)
    expect(isGridColumnCount(42)).toBe(false)
    expect(isGridColumnCount('40')).toBe(false)
  })

  it('steps columns for zoom in/out', () => {
    expect(stepGridColumns(40, -1)).toBe(35)
    expect(stepGridColumns(40, 1)).toBe(45)
    expect(stepGridColumns(25, -1)).toBe(25)
    expect(stepGridColumns(70, 1)).toBe(70)
    expect(stepGridColumns(42, -1)).toBe(35)
  })

  it('labels rows by cell offset for the current column count', () => {
    expect(rowOffsetLabel(0, 40)).toBe(0)
    expect(rowOffsetLabel(1, 40)).toBe(40)
    expect(rowOffsetLabel(2, 40)).toBe(80)
    expect(rowOffsetLabel(3, 35)).toBe(105)
    expect(gridTrackColumnCount(40)).toBe(41)
  })

  it('interleaves row labels with cells for an n+1 track grid', () => {
    const cells = [
      { character: '一' },
      { character: '二' },
      { character: '三' },
      { character: '四' },
      { character: '五' }
    ]
    const items = buildMapGridTrackItems(cells, 2)
    expect(items.map((item) => {
      if (item.kind === 'label') return `L${item.offset}`
      return item.cell.character
    })).toEqual(['L0', '一', '二', 'L2', '三', '四', 'L4', '五'])
  })
})
