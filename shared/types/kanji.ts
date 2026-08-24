/**
 * Shared types for kanji reference and map cells.
 */

/** MEXT elementary years only (学年別漢字配当表). Post-elementary jōyō have null. */
export type SchoolGrade = 1 | 2 | 3 | 4 | 5 | 6
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

/** How the grid is ordered. */
export type OrderMode = 'grade' | 'usage' | 'joyo' | 'wk'

export interface KanjiUnionEntry {
  character: string
  schoolGrade: SchoolGrade | null
  jlptLevel: JlptLevel | null
  inJoyoo: boolean
  /** Newspaper frequency rank (lower = more common). null if unknown. */
  freqRank: number | null
  /** Stroke count for jōyō-appearance / visual ordering. */
  strokes: number | null
}

export interface MapCell {
  character: string
  schoolGrade: SchoolGrade | null
  jlptLevel: JlptLevel | null
  inJoyoo: boolean
  freqRank: number | null
  strokes: number | null
  gridIndex: number
  /** Averaged SRS 0–9 (WK scale). null = unstudied */
  srsAvg: number | null
  /** Averaged accuracy 0–100. null = unstudied */
  accuracyAvg: number | null
  /** Bitmask: 1 = WaniKani, 2 = BunPro */
  sources: number
  /**
   * True when this character is in WaniKani’s kanji subject catalog
   * (independent of whether the learner has started it).
   */
  inWanikani: boolean
  /** WaniKani level 1–60 when known from subject catalog */
  wkLevel: number | null
  /** WaniKani subject id (reference) */
  wkSubjectId: number | null
  /** Index in WK `/subjects?types=kanji` response order (within-level sort) */
  wkApiOrder: number | null
}

export type ColorMode = 'srs' | 'accuracy'

/** Focus filter for untracked / unstudied cells (dims non-matches). */
export type MapFilterMode = 'none' | 'untracked' | 'untracked-unstudied'

export const SOURCE_WANIKANI = 1
export const SOURCE_BUNPRO = 2
