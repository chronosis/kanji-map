import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRID_COLUMNS,
  GRID_COLUMN_OPTIONS,
  isGridColumnCount,
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
})
