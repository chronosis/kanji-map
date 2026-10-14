import type { MapCell } from '../types/kanji'

/** Progress fields that move or recolor a cell. Static metadata stays on the live map. */
export interface MapSnapshotCell {
  character: string
  srsAvg: number | null
  accuracyAvg: number | null
  sources: number
  inWanikani: boolean
  wkLevel: number | null
  wkSubjectId: number | null
  wkApiOrder: number | null
  readingCount: number
  meaningCorrect: number
  meaningIncorrect: number
  readingCorrect: number
  readingIncorrect: number
}

export interface MapSnapshotSummary {
  id: number
  capturedAt: string
}

export function toSnapshotCells(cells: readonly MapCell[]): MapSnapshotCell[] {
  return cells.map(cell => ({
    character: cell.character,
    srsAvg: cell.srsAvg,
    accuracyAvg: cell.accuracyAvg,
    sources: cell.sources,
    inWanikani: cell.inWanikani,
    wkLevel: cell.wkLevel,
    wkSubjectId: cell.wkSubjectId,
    wkApiOrder: cell.wkApiOrder,
    readingCount: cell.readingCount,
    meaningCorrect: cell.meaningCorrect,
    meaningIncorrect: cell.meaningIncorrect,
    readingCorrect: cell.readingCorrect,
    readingIncorrect: cell.readingIncorrect
  }))
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function finiteOrZero(value: unknown): number {
  return finiteOrNull(value) ?? 0
}

export function parseMapSnapshotState(raw: string): MapSnapshotCell[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null

  const cells: MapSnapshotCell[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') return null
    const row = item as Partial<MapSnapshotCell>
    if (typeof row.character !== 'string' || row.character.length === 0) return null
    cells.push({
      character: row.character,
      srsAvg: finiteOrNull(row.srsAvg),
      accuracyAvg: finiteOrNull(row.accuracyAvg),
      sources: finiteOrZero(row.sources),
      inWanikani: row.inWanikani === true,
      wkLevel: finiteOrNull(row.wkLevel),
      wkSubjectId: finiteOrNull(row.wkSubjectId),
      wkApiOrder: finiteOrNull(row.wkApiOrder),
      readingCount: finiteOrZero(row.readingCount),
      meaningCorrect: finiteOrZero(row.meaningCorrect),
      meaningIncorrect: finiteOrZero(row.meaningIncorrect),
      readingCorrect: finiteOrZero(row.readingCorrect),
      readingIncorrect: finiteOrZero(row.readingIncorrect)
    })
  }
  return cells
}

/**
 * Characters in WaniKani lesson order. Absolute `wkApiOrder` values are not
 * compared, because a refetch can renumber them without moving any kanji.
 */
function wanikaniLessonSequence(cells: readonly MapSnapshotCell[]): string {
  return cells
    .filter(cell => cell.inWanikani && cell.wkLevel != null)
    .slice()
    .sort((a, b) => {
      const level = (a.wkLevel ?? 0) - (b.wkLevel ?? 0)
      if (level !== 0) return level
      const order = (a.wkApiOrder ?? Number.MAX_SAFE_INTEGER) - (b.wkApiOrder ?? Number.MAX_SAFE_INTEGER)
      if (order !== 0) return order
      if (a.character < b.character) return -1
      if (a.character > b.character) return 1
      return 0
    })
    .map(cell => cell.character)
    .join('\n')
}

/** Stable identity of a map view. Equal signatures mean the snapshot date can move forward. */
export function mapSnapshotSignature(cells: readonly MapSnapshotCell[]): string {
  const rows = cells.map(cell => [
    cell.character,
    cell.srsAvg,
    cell.accuracyAvg,
    cell.sources,
    cell.inWanikani ? 1 : 0,
    cell.wkLevel,
    cell.readingCount,
    cell.meaningCorrect,
    cell.meaningIncorrect,
    cell.readingCorrect,
    cell.readingIncorrect
  ])
  rows.sort((a, b) => {
    const left = String(a[0])
    const right = String(b[0])
    if (left < right) return -1
    if (left > right) return 1
    return 0
  })
  return JSON.stringify([rows, wanikaniLessonSequence(cells)])
}

export function nextSnapshotAction(
  previous: readonly MapSnapshotCell[] | null,
  next: readonly MapSnapshotCell[]
): 'insert' | 'touch' {
  if (!previous) return 'insert'
  return mapSnapshotSignature(previous) === mapSnapshotSignature(next) ? 'touch' : 'insert'
}

const EMPTY_PROGRESS = {
  srsAvg: null,
  accuracyAvg: null,
  sources: 0,
  inWanikani: false,
  wkLevel: null,
  wkSubjectId: null,
  wkApiOrder: null,
  meaningCorrect: 0,
  meaningIncorrect: 0,
  readingCorrect: 0,
  readingIncorrect: 0
} as const

/** Overlay a historical progress snapshot onto the current kanji metadata. */
export function applyMapSnapshot(cells: readonly MapCell[], snapshot: readonly MapSnapshotCell[]): MapCell[] {
  const byCharacter = new Map(snapshot.map(row => [row.character, row]))
  return cells.map((cell) => {
    const row = byCharacter.get(cell.character)
    if (!row) {
      return {
        ...cell,
        ...EMPTY_PROGRESS,
        readingCount: 0
      }
    }
    return {
      ...cell,
      srsAvg: row.srsAvg,
      accuracyAvg: row.accuracyAvg,
      sources: row.sources,
      inWanikani: row.inWanikani,
      wkLevel: row.wkLevel,
      wkSubjectId: row.wkSubjectId,
      wkApiOrder: row.wkApiOrder,
      readingCount: row.readingCount,
      meaningCorrect: row.meaningCorrect,
      meaningIncorrect: row.meaningIncorrect,
      readingCorrect: row.readingCorrect,
      readingIncorrect: row.readingIncorrect
    }
  })
}

export function formatSnapshotTimestamp(
  iso: string,
  locales: Intl.LocalesArgument = undefined,
  timeZone?: string
): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locales, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone
  }).format(date)
}
