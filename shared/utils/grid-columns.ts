/** Allowed map column counts (default 40). */
export const GRID_COLUMN_OPTIONS = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70] as const

export type GridColumnCount = (typeof GRID_COLUMN_OPTIONS)[number]

export const DEFAULT_GRID_COLUMNS: GridColumnCount = 40

export function isGridColumnCount(value: unknown): value is GridColumnCount {
  return typeof value === 'number'
    && (GRID_COLUMN_OPTIONS as readonly number[]).includes(value)
}

/**
 * Step column density for zoom controls.
 * `direction` -1 = zoom in (fewer columns / larger cells), +1 = zoom out (more columns).
 */
export function stepGridColumns(current: number, direction: -1 | 1): GridColumnCount {
  const idx = (GRID_COLUMN_OPTIONS as readonly number[]).indexOf(current)
  const from = idx >= 0
    ? idx
    : (GRID_COLUMN_OPTIONS as readonly number[]).indexOf(DEFAULT_GRID_COLUMNS)
  const next = Math.min(
    GRID_COLUMN_OPTIONS.length - 1,
    Math.max(0, from + direction)
  )
  return GRID_COLUMN_OPTIONS[next]!
}
