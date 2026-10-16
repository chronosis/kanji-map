/**
 * Shared types for kanji reference and map cells.
 */

/** MEXT elementary years only (学年別漢字配当表). Post-elementary jōyō have null. */
export type SchoolGrade = 1 | 2 | 3 | 4 | 5 | 6
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

/** How the grid is ordered. */
export type OrderMode
  = | 'grade'
    | 'usage'
    | 'joyo'
    | 'jlpt'
    | 'wk'
    | 'accuracy'
    | 'srs'
    | 'readings'
    | 'strokes'
    | 'wk-meaning-attempts'
    | 'wk-reading-attempts'

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
  /** Stable 0-based index in jōyō-appearance order (UI shows joyoIndex + 1). */
  joyoIndex: number
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
  /** Kangxi radical symbol from Jisho (Kanjidic2), e.g. 言 */
  radicalSymbol: string | null
  /** Alternate radical forms on the Jisho page, e.g. 訁 */
  radicalForms: string[]
  /** Component parts from Jisho used for radical/component search */
  parts: string[]
  /**
   * Searchable readings (hiragana forms from Kanjidic on/kun and WK sync,
   * including stems before okurigana dots).
   */
  readings: string[]
  /**
   * Distinct on/kun reading-stem count (okurigana collapsed; nanori excluded).
   * 0 when unknown / missing.
   */
  readingCount: number
  /** Cumulative WaniKani meaning correct answers (0 when no progress row). */
  meaningCorrect: number
  /** Cumulative WaniKani meaning incorrect answers (0 when no progress row). */
  meaningIncorrect: number
  /** Cumulative WaniKani reading correct answers (0 when no progress row). */
  readingCorrect: number
  /** Cumulative WaniKani reading incorrect answers (0 when no progress row). */
  readingIncorrect: number
  /**
   * Primary English meaning. WaniKani’s primary gloss when the catalog has one,
   * otherwise the first Kanjidic gloss.
   */
  meaning?: string | null
}

export type ColorMode
  = | 'none'
    | 'year'
    | 'jlpt'
    | 'srs'
    | 'accuracy'
    | 'accuracy-meaning'
    | 'accuracy-reading'
    | 'strokes'
    | 'readings'
    | 'wk'
    | 'wk-group'

/**
 * How the secondary color scale is painted on each card.
 * `border` draws a 2px edge; `gradient` blends primary → secondary across the fill.
 */
export type SecondaryColorPaint = 'border' | 'gradient'

/**
 * Toolbar filters that remove matching cells. Several may be active at once.
 * An empty selection shows every cell.
 */
export type MapFilterId = 'untracked' | 'unstudied' | 'unhighlighted' | 'burned'

export const SOURCE_WANIKANI = 1
export const SOURCE_BUNPRO = 2
