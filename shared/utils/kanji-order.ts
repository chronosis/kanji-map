import type { JlptLevel, KanjiUnionEntry, MapCell, OrderMode, SchoolGrade } from '../types/kanji'
import { isUntracked, sortableAccuracy } from './colors'
import { wkMeaningAttempts, wkReadingAttempts, type WanikaniReviewCounts } from './wanikani-review-stats'

/** In WK order mode, untracked cells sort after all WK levels and get gridIndex ≥ this. */
export const WK_UNTRACKED_SORT_OFFSET = 9000

const JLPT_ORDER: Record<JlptLevel, number> = {
  N5: 0,
  N4: 1,
  N3: 2,
  N2: 3,
  N1: 4
}

function cmpNumNullLast(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

function cmpNumDescNullLast(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return b - a
}

function cmpChar(a: string, b: string): number {
  return a.codePointAt(0)! - b.codePointAt(0)!
}

function cellIsUntracked(cell: {
  inWanikani?: boolean
  sources?: number
  inJoyoo?: boolean
  schoolGrade?: number | null
  wkLevel?: number | null
  srsAvg?: number | null
  accuracyAvg?: number | null
}): boolean {
  if (typeof cell.inWanikani === 'boolean') {
    return !cell.inWanikani
  }
  return isUntracked({
    srsAvg: cell.srsAvg ?? null,
    accuracyAvg: cell.accuracyAvg ?? null,
    sources: cell.sources ?? 0,
    inJoyoo: cell.inJoyoo ?? false,
    schoolGrade: cell.schoolGrade ?? null,
    inWanikani: false
  })
}

/** Default / grade: school year → JLPT → code point. */
export function compareByGrade(a: KanjiUnionEntry, b: KanjiUnionEntry): number {
  const grade = cmpNumNullLast(a.schoolGrade, b.schoolGrade)
  if (grade !== 0) return grade

  const jlptA = a.jlptLevel ? JLPT_ORDER[a.jlptLevel] : 99
  const jlptB = b.jlptLevel ? JLPT_ORDER[b.jlptLevel] : 99
  if (jlptA !== jlptB) return jlptA - jlptB

  return cmpChar(a.character, b.character)
}

/** Usage: newspaper frequency rank (lower = more common). */
export function compareByUsage(a: KanjiUnionEntry, b: KanjiUnionEntry): number {
  const freq = cmpNumNullLast(a.freqRank, b.freqRank)
  if (freq !== 0) return freq
  return cmpChar(a.character, b.character)
}

/**
 * Jōyō appearance: jōyō first (小学校 years, then 中学+ jōyō by strokes),
 * then non-jōyō extras by strokes.
 */
export function compareByJoyoAppearance(a: KanjiUnionEntry, b: KanjiUnionEntry): number {
  if (a.inJoyoo !== b.inJoyoo) return a.inJoyoo ? -1 : 1

  if (a.inJoyoo) {
    const grade = cmpNumNullLast(a.schoolGrade, b.schoolGrade)
    if (grade !== 0) return grade
  }

  const strokes = cmpNumNullLast(a.strokes, b.strokes)
  if (strokes !== 0) return strokes
  return cmpChar(a.character, b.character)
}

/**
 * JLPT level: N5 → N4 → N3 → N2 → N1, then unranked (no JLPT tag);
 * ties break with jōyō appearance.
 */
export function compareByJlpt(a: KanjiUnionEntry, b: KanjiUnionEntry): number {
  const jlptA = a.jlptLevel ? JLPT_ORDER[a.jlptLevel] : 99
  const jlptB = b.jlptLevel ? JLPT_ORDER[b.jlptLevel] : 99
  if (jlptA !== jlptB) return jlptA - jlptB
  return compareByJoyoAppearance(a, b)
}

type WkOrderable = {
  character: string
  wkLevel?: number | null
  wkApiOrder?: number | null
  wkSubjectId?: number | null
  inWanikani?: boolean
  sources?: number
  inJoyoo?: boolean
  schoolGrade?: number | null
  srsAvg?: number | null
  accuracyAvg?: number | null
}

/**
 * WaniKani lesson order: level → API response appearance → code point.
 * Untracked (not in WK) always sort last (effective level +9000).
 */
export function compareByWk(a: WkOrderable, b: WkOrderable): number {
  const aUntracked = cellIsUntracked(a)
  const bUntracked = cellIsUntracked(b)
  if (aUntracked !== bUntracked) return aUntracked ? 1 : -1

  const levelA = aUntracked
    ? WK_UNTRACKED_SORT_OFFSET + (a.wkLevel ?? 0)
    : a.wkLevel ?? null
  const levelB = bUntracked
    ? WK_UNTRACKED_SORT_OFFSET + (b.wkLevel ?? 0)
    : b.wkLevel ?? null

  const level = cmpNumNullLast(levelA, levelB)
  if (level !== 0) return level

  const apiOrder = cmpNumNullLast(a.wkApiOrder ?? null, b.wkApiOrder ?? null)
  if (apiOrder !== 0) return apiOrder

  return cmpChar(a.character, b.character)
}

/** WK level → API response order → code point (no untracked handling). */
function compareByWkLessonOrder(a: WkOrderable, b: WkOrderable): number {
  const level = cmpNumNullLast(a.wkLevel ?? null, b.wkLevel ?? null)
  if (level !== 0) return level

  const apiOrder = cmpNumNullLast(a.wkApiOrder ?? null, b.wkApiOrder ?? null)
  if (apiOrder !== 0) return apiOrder

  return cmpChar(a.character, b.character)
}

/**
 * SRS stage: highest first; then WaniKani lesson order; untracked always last.
 */
export function compareBySrs(a: WkOrderable, b: WkOrderable): number {
  const aUntracked = cellIsUntracked(a)
  const bUntracked = cellIsUntracked(b)
  if (aUntracked !== bUntracked) return aUntracked ? 1 : -1

  const srs = cmpNumDescNullLast(a.srsAvg ?? null, b.srsAvg ?? null)
  if (srs !== 0) return srs

  return compareByWkLessonOrder(a, b)
}

/**
 * Accuracy: highest first; null accuracy after scored cells; untracked always last.
 */
export function compareByAccuracy(a: WkOrderable, b: WkOrderable): number {
  const aUntracked = cellIsUntracked(a)
  const bUntracked = cellIsUntracked(b)
  if (aUntracked !== bUntracked) return aUntracked ? 1 : -1

  const accuracy = cmpNumDescNullLast(
    sortableAccuracy(a.accuracyAvg ?? null, a.sources ?? 0, a.srsAvg ?? null),
    sortableAccuracy(b.accuracyAvg ?? null, b.sources ?? 0, b.srsAvg ?? null)
  )
  if (accuracy !== 0) return accuracy

  return cmpChar(a.character, b.character)
}

type ReadingCountOrderable = KanjiUnionEntry & {
  readingCount?: number | null
}

/**
 * Reading count: most readings first; missing/unknown count as 0; then jōyō appearance.
 */
export function compareByReadingCount(a: ReadingCountOrderable, b: ReadingCountOrderable): number {
  const countA = a.readingCount ?? 0
  const countB = b.readingCount ?? 0
  if (countA !== countB) return countB - countA
  return compareByJoyoAppearance(a, b)
}

/**
 * Stroke count: fewest strokes first (unknown last); then jōyō appearance.
 */
export function compareByStrokeCount(a: KanjiUnionEntry, b: KanjiUnionEntry): number {
  const strokes = cmpNumNullLast(a.strokes, b.strokes)
  if (strokes !== 0) return strokes
  return compareByJoyoAppearance(a, b)
}

type WkAttemptsOrderable = KanjiUnionEntry & Partial<WanikaniReviewCounts>

function reviewCountsOf(cell: WkAttemptsOrderable): WanikaniReviewCounts {
  return {
    meaningCorrect: cell.meaningCorrect ?? 0,
    meaningIncorrect: cell.meaningIncorrect ?? 0,
    readingCorrect: cell.readingCorrect ?? 0,
    readingIncorrect: cell.readingIncorrect ?? 0
  }
}

/**
 * WaniKani meaning attempts (correct + incorrect): most first; then jōyō appearance.
 */
export function compareByWkMeaningAttempts(a: WkAttemptsOrderable, b: WkAttemptsOrderable): number {
  const attemptsA = wkMeaningAttempts(reviewCountsOf(a))
  const attemptsB = wkMeaningAttempts(reviewCountsOf(b))
  if (attemptsA !== attemptsB) return attemptsB - attemptsA
  return compareByJoyoAppearance(a, b)
}

/**
 * WaniKani reading attempts (correct + incorrect): most first; then jōyō appearance.
 */
export function compareByWkReadingAttempts(a: WkAttemptsOrderable, b: WkAttemptsOrderable): number {
  const attemptsA = wkReadingAttempts(reviewCountsOf(a))
  const attemptsB = wkReadingAttempts(reviewCountsOf(b))
  if (attemptsA !== attemptsB) return attemptsB - attemptsA
  return compareByJoyoAppearance(a, b)
}

export function compareKanjiEntries(a: KanjiUnionEntry, b: KanjiUnionEntry): number {
  return compareByGrade(a, b)
}

export function getComparator(mode: OrderMode): (a: KanjiUnionEntry, b: KanjiUnionEntry) => number {
  if (mode === 'usage') return compareByUsage
  if (mode === 'joyo') return compareByJoyoAppearance
  if (mode === 'jlpt') return compareByJlpt
  if (mode === 'wk') {
    return compareByWk as (a: KanjiUnionEntry, b: KanjiUnionEntry) => number
  }
  if (mode === 'accuracy') {
    return compareByAccuracy as (a: KanjiUnionEntry, b: KanjiUnionEntry) => number
  }
  if (mode === 'srs') {
    return compareBySrs as (a: KanjiUnionEntry, b: KanjiUnionEntry) => number
  }
  if (mode === 'readings') {
    return compareByReadingCount as (a: KanjiUnionEntry, b: KanjiUnionEntry) => number
  }
  if (mode === 'strokes') {
    return compareByStrokeCount
  }
  if (mode === 'wk-meaning-attempts') {
    return compareByWkMeaningAttempts as (a: KanjiUnionEntry, b: KanjiUnionEntry) => number
  }
  if (mode === 'wk-reading-attempts') {
    return compareByWkReadingAttempts as (a: KanjiUnionEntry, b: KanjiUnionEntry) => number
  }
  return compareByGrade
}

export function orderKanjiUnion(entries: KanjiUnionEntry[], mode: OrderMode = 'grade'): KanjiUnionEntry[] {
  return [...entries].sort(getComparator(mode))
}

export function assignGridIndices(
  entries: KanjiUnionEntry[],
  mode: OrderMode = 'grade'
): Array<KanjiUnionEntry & { gridIndex: number }> {
  return orderKanjiUnion(entries, mode).map((entry, gridIndex) => ({ ...entry, gridIndex }))
}

export function sortMapCells(cells: MapCell[], mode: OrderMode): MapCell[] {
  const sorted = [...cells].sort(getComparator(mode))

  if (mode !== 'wk') {
    return sorted.map((cell, gridIndex) => ({ ...cell, gridIndex }))
  }

  // WK mode: contiguous indices for WK/trackable cells; untracked get +9000.
  let trackedIndex = 0
  let untrackedIndex = 0
  return sorted.map((cell) => {
    if (cellIsUntracked(cell)) {
      return { ...cell, gridIndex: WK_UNTRACKED_SORT_OFFSET + untrackedIndex++ }
    }
    return { ...cell, gridIndex: trackedIndex++ }
  })
}

export function isSchoolGrade(value: unknown): value is SchoolGrade {
  return typeof value === 'number' && value >= 1 && value <= 6
}

export function isJlptLevel(value: unknown): value is JlptLevel {
  return value === 'N5' || value === 'N4' || value === 'N3' || value === 'N2' || value === 'N1'
}

/** UI label for MEXT elementary year or junior-high+ jōyō. */
export function schoolYearLabel(grade: number | null, inJoyoo: boolean): string {
  if (grade != null && grade >= 1 && grade <= 6) return `小${grade}`
  if (inJoyoo) return '中学+'
  return '—'
}
