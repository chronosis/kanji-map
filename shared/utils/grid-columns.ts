/** Allowed map column counts (default 40). Lower counts suit mobile / large cells. */
export const GRID_COLUMN_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70] as const

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

/** First cell index shown on a grid row (0, N, 2N, …). */
export function rowOffsetLabel(rowIndex: number, columnCount: number): number {
  return Math.max(0, rowIndex) * Math.max(0, columnCount)
}

/** Data columns plus the leading row-index gutter. */
export function gridTrackColumnCount(dataColumns: number): number {
  return Math.max(0, dataColumns) + 1
}

export type MapGridTrackItem<T>
  = | { kind: 'label', key: string, offset: number }
    | { kind: 'cell', key: string, cell: T }

/** Interleave row-index labels with cells for an (n+1)-column CSS grid. */
export function buildMapGridTrackItems<T extends { character: string }>(
  cells: readonly T[],
  columnCount: number
): Array<MapGridTrackItem<T>> {
  if (columnCount <= 0 || cells.length === 0) return []

  const items: Array<MapGridTrackItem<T>> = []
  for (let i = 0; i < cells.length; i++) {
    if (i % columnCount === 0) {
      const rowIndex = i / columnCount
      items.push({
        kind: 'label',
        key: `row-label-${rowIndex}`,
        offset: rowOffsetLabel(rowIndex, columnCount)
      })
    }
    const cell = cells[i]!
    items.push({
      kind: 'cell',
      key: cell.character,
      cell
    })
  }
  return items
}
