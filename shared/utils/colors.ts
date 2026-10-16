import type { ColorMode, MapFilterId, SecondaryColorPaint } from '../types/kanji'
import { SOURCE_WANIKANI } from '../types/kanji'
import { accuracyFromCounts } from './merge-progress'

/**
 * Cell visual bands — see `.ai/memory-bank/decisions/unstudied-vs-untracked.md`.
 *
 * Decision order for grey cells (no positive SRS):
 * 1. Untracked = on the map but NOT in the WaniKani kanji catalog
 * 2. Unstudied = in WK catalog with no positive SRS yet
 */
export type SrsBand
  = 'unstudied'
    | 'untracked'
    | 'locked'
    | 'apprentice'
    | 'guru'
    | 'master'
    | 'enlightened'
    | 'burned'

export interface CellVisualInput {
  srsAvg: number | null
  accuracyAvg: number | null
  sources: number
  inJoyoo: boolean
  schoolGrade: number | null
  /**
   * True when this character appears in WaniKani’s kanji *subject catalog*
   * (not merely “has a progress row with SRS > 0”).
   */
  inWanikani: boolean
  /** Stroke count for stroke-count heatmap coloring. */
  strokes?: number | null
  /** Distinct reading count for reading-count heatmap coloring. */
  readingCount?: number
  /** Cumulative WaniKani meaning correct answers. */
  meaningCorrect?: number | null
  /** Cumulative WaniKani meaning incorrect answers. */
  meaningIncorrect?: number | null
  /** Cumulative WaniKani reading correct answers. */
  readingCorrect?: number | null
  /** Cumulative WaniKani reading incorrect answers. */
  readingIncorrect?: number | null
  /** WaniKani subject level 1–60 when known from the catalog. */
  wkLevel?: number | null
  /** Community JLPT level when known. */
  jlptLevel?: string | null
}

/** Official WaniKani kanji level ceiling (used for level heatmap scaling). */
export const WANIKANI_MAX_LEVEL = 60

export interface HeatmapScale {
  maxStrokes: number
  maxReadingCount: number
}

/**
 * Map a count onto the accuracy heatmap scale:
 * `pct = (1 - count / max) * 100` — highest counts → 0% (purple), lowest → 100% (green).
 */
export function invertedCountHeatmapPct(count: number, max: number): number {
  if (max <= 0) return 100
  const ratio = Math.min(1, Math.max(0, count / max))
  return (1 - ratio) * 100
}

/** Curriculum list: MEXT 小1–6 and/or 常用漢字 (jōyō). */
export function isCurriculum(input: Pick<CellVisualInput, 'inJoyoo' | 'schoolGrade'>): boolean {
  return input.inJoyoo || input.schoolGrade != null
}

/** True when an API has reported a positive SRS stage (> 0). */
export function hasApiSrs(sources: number, srsAvg: number | null): boolean {
  return sources > 0 && srsAvg != null && srsAvg > 0
}

/** Accuracy used for labels and sort order; null when the cell shows `--`. */
export function sortableAccuracy(
  accuracyAvg: number | null,
  sources: number,
  srsAvg: number | null
): number | null {
  if (!hasApiSrs(sources, srsAvg)) return null
  return accuracyAvg
}

/**
 * Untracked: on the map but absent from WaniKani’s kanji catalog
 * (jōyō / school or JLPT-only extras). These will never receive a WK SRS stage.
 * Visual: neutral-500 + blue outline.
 */
export function isUntracked(input: CellVisualInput): boolean {
  return !input.inWanikani
}

/**
 * Unstudied: in WaniKani’s catalog (so an SRS stage is possible) but no positive SRS yet.
 * Visual: neutral-400, no blue outline.
 */
export function isUnstudied(input: CellVisualInput): boolean {
  return input.inWanikani && !hasApiSrs(input.sources, input.srsAvg)
}

export const MAP_FILTER_ITEMS: ReadonlyArray<{ label: string, value: MapFilterId }> = [
  { label: 'Untracked', value: 'untracked' },
  { label: 'Unstudied', value: 'unstudied' },
  { label: 'Unhighlighted', value: 'unhighlighted' },
  { label: 'Burned', value: 'burned' }
]

/**
 * Whether any active toolbar filter should omit this cell.
 * Each filter names a category to hide. An empty list hides nothing.
 */
export function isOmittedByMapFilter(
  active: readonly MapFilterId[],
  input: CellVisualInput,
  options?: { dimmed?: boolean }
): boolean {
  for (let i = 0; i < active.length; i++) {
    const mode = active[i]!
    if (mode === 'unhighlighted') {
      if (options?.dimmed === true) return true
      continue
    }
    if (mode === 'untracked') {
      if (isUntracked(input)) return true
      continue
    }
    if (mode === 'unstudied') {
      if (isUnstudied(input)) return true
      continue
    }
    if (isBurnedSrs(input)) return true
  }
  return false
}

/** @deprecated Prefer input.inWanikani */
export function isInWanikani(sources: number, wkLevel?: number | null): boolean {
  return (sources & SOURCE_WANIKANI) !== 0 || (wkLevel != null && wkLevel > 0)
}

/** @deprecated Prefer isInWanikani / input.inWanikani */
export function hasWanikaniSource(sources: number): boolean {
  return (sources & SOURCE_WANIKANI) !== 0
}

/** @deprecated Prefer isUntracked */
export function isCurriculumUnlinked(input: CellVisualInput): boolean {
  return isUntracked(input)
}

/** Classify averaged SRS (0–9 WK scale) into a named band. */
export function srsBand(srsAvg: number | null): SrsBand {
  if (srsAvg == null) return 'unstudied'
  const stage = Math.round(srsAvg)
  if (stage <= 0) return 'locked'
  if (stage <= 4) return 'apprentice'
  if (stage <= 5) return 'guru'
  if (stage <= 7) return 'master'
  if (stage <= 8) return 'enlightened'
  return 'burned'
}

/** Top WaniKani-scale SRS band (rounded stage 9), and only when an API stage exists. */
export function isBurnedSrs(input: CellVisualInput): boolean {
  return hasApiSrs(input.sources, input.srsAvg) && srsBand(input.srsAvg) === 'burned'
}

/** Hex fills matching `.km-srs.*` in `app/assets/css/main.css`. */
export const SRS_BAND_COLORS: Readonly<Record<SrsBand, string>> = {
  unstudied: '#a3a3a3',
  locked: '#a3a3a3',
  untracked: '#737373',
  apprentice: '#fca5a5',
  guru: '#fbbf24',
  master: '#4ade80',
  enlightened: '#22d3ee',
  burned: '#818cf8'
}

/** Text / fill color for an averaged SRS stage (same palette as map SRS mode). */
export function srsBandColor(srsAvg: number | null): string {
  return SRS_BAND_COLORS[srsBand(srsAvg)]
}

const SRS_BAND_LABELS: Readonly<Record<SrsBand, string>> = {
  unstudied: 'Unstudied',
  untracked: 'Untracked',
  locked: 'Locked',
  apprentice: 'Apprentice',
  guru: 'Guru',
  master: 'Master',
  enlightened: 'Enlightened',
  burned: 'Burned'
}

/**
 * SRS band used for labels and the hover bar.
 * Matches SRS color mode: a positive API stage, otherwise untracked vs unstudied.
 */
export function srsDisplayBand(input: {
  srsAvg: number | null
  sources: number
  inWanikani: boolean
}): SrsBand {
  if (hasApiSrs(input.sources, input.srsAvg)) return srsBand(input.srsAvg)
  if (!input.inWanikani) return 'untracked'
  return 'unstudied'
}

export function srsDisplayLabel(input: {
  srsAvg: number | null
  sources: number
  inWanikani: boolean
}): string {
  const band = srsDisplayBand(input)
  const name = SRS_BAND_LABELS[band]
  if (band === 'unstudied' || band === 'untracked') return name
  const stage = Math.round(input.srsAvg ?? 0)
  return `${name} (${stage})`
}

export function srsDisplayColor(input: {
  srsAvg: number | null
  sources: number
  inWanikani: boolean
}): string {
  return SRS_BAND_COLORS[srsDisplayBand(input)]
}

/**
 * Text color for accuracy % (same palette as the accuracy heatmap).
 * Null when accuracy is not displayable (`--`).
 */
export function accuracyTextColor(
  accuracyAvg: number | null,
  options?: { sources?: number, srsAvg?: number | null }
): string | null {
  const effective = options
    ? sortableAccuracy(accuracyAvg, options.sources ?? 0, options.srsAvg ?? null)
    : accuracyAvg
  if (effective == null) return null
  return accuracyHeatmapColor(effective)
}

/** School-year / jōyō band for the year color mode. */
export type SchoolYearBand
  = 'g1'
    | 'g2'
    | 'g3'
    | 'g4'
    | 'g5'
    | 'g6'
    | 'jh'
    | 'other'

export function schoolYearBand(
  input: Pick<CellVisualInput, 'schoolGrade' | 'inJoyoo'>
): SchoolYearBand {
  if (input.schoolGrade === 1) return 'g1'
  if (input.schoolGrade === 2) return 'g2'
  if (input.schoolGrade === 3) return 'g3'
  if (input.schoolGrade === 4) return 'g4'
  if (input.schoolGrade === 5) return 'g5'
  if (input.schoolGrade === 6) return 'g6'
  if (input.inJoyoo) return 'jh'
  return 'other'
}

/** JLPT band for the jlpt color mode (N5 easiest → N1 hardest). */
export type JlptColorBand = 'n5' | 'n4' | 'n3' | 'n2' | 'n1' | 'other'

export function jlptBand(jlptLevel: string | null | undefined): JlptColorBand {
  if (jlptLevel === 'N5') return 'n5'
  if (jlptLevel === 'N4') return 'n4'
  if (jlptLevel === 'N3') return 'n3'
  if (jlptLevel === 'N2') return 'n2'
  if (jlptLevel === 'N1') return 'n1'
  return 'other'
}

/**
 * WaniKani level decade for the wk-group color mode
 * (1–10 earliest → 51–60 latest).
 */
export type WkLevelGroupBand
  = 'wg1'
    | 'wg2'
    | 'wg3'
    | 'wg4'
    | 'wg5'
    | 'wg6'
    | 'other'

export function wkLevelGroupBand(wkLevel: number | null | undefined): WkLevelGroupBand {
  if (wkLevel == null || wkLevel <= 0) return 'other'
  if (wkLevel <= 10) return 'wg1'
  if (wkLevel <= 20) return 'wg2'
  if (wkLevel <= 30) return 'wg3'
  if (wkLevel <= 40) return 'wg4'
  if (wkLevel <= 50) return 'wg5'
  if (wkLevel <= WANIKANI_MAX_LEVEL) return 'wg6'
  return 'other'
}

export function cellVisualClass(
  mode: ColorMode,
  input: CellVisualInput,
  scale?: HeatmapScale
): string {
  if (mode === 'none') {
    return 'km-srs km-unstudied'
  }

  if (mode === 'year') {
    return `km-year km-${schoolYearBand(input)}`
  }

  if (mode === 'jlpt') {
    return `km-jlpt km-${jlptBand(input.jlptLevel)}`
  }

  if (mode === 'wk-group') {
    return `km-wkg km-${wkLevelGroupBand(input.wkLevel)}`
  }

  if (mode === 'strokes') {
    if (input.strokes == null || !scale || scale.maxStrokes <= 0) {
      return isUntracked(input) ? 'km-srs km-untracked' : 'km-srs km-unstudied'
    }
    const pct = invertedCountHeatmapPct(input.strokes, scale.maxStrokes)
    return `km-acc km-acc-${accuracyHeatmapBucket(pct)}`
  }

  if (mode === 'readings') {
    if (!scale || scale.maxReadingCount <= 0) {
      return isUntracked(input) ? 'km-srs km-untracked' : 'km-srs km-unstudied'
    }
    const pct = invertedCountHeatmapPct(input.readingCount ?? 0, scale.maxReadingCount)
    return `km-acc km-acc-${accuracyHeatmapBucket(pct)}`
  }

  if (mode === 'wk') {
    const level = input.wkLevel
    if (level == null || level <= 0) {
      return isUntracked(input) ? 'km-srs km-untracked' : 'km-srs km-unstudied'
    }
    // Level 1 → green (early), level 60 → purple (late), same palette as strokes/readings.
    const pct = invertedCountHeatmapPct(level, WANIKANI_MAX_LEVEL)
    return `km-acc km-acc-${accuracyHeatmapBucket(pct)}`
  }

  if (isAccuracyColorMode(mode)) {
    if (!hasApiSrs(input.sources, input.srsAvg)) {
      return isUntracked(input) ? 'km-srs km-untracked' : 'km-srs km-unstudied'
    }
    const pct = accuracyPctForColorMode(mode, input)
    if (pct == null) return 'km-srs km-unstudied'
    return `km-acc km-acc-${accuracyHeatmapBucket(pct)}`
  }

  if (hasApiSrs(input.sources, input.srsAvg)) {
    return `km-srs km-${srsBand(input.srsAvg)}`
  }

  // No positive SRS: untracked (blue) vs unstudied / other grey (no blue)
  if (isUntracked(input)) {
    return 'km-srs km-untracked'
  }

  return 'km-srs km-unstudied'
}

/** Chromatic fills shared by background classes. Grey bands are omitted. */
const VISUAL_FILL_COLORS: Readonly<Record<string, string>> = {
  'km-apprentice': '#fca5a5',
  'km-guru': '#fbbf24',
  'km-master': '#4ade80',
  'km-enlightened': '#22d3ee',
  'km-burned': '#818cf8',
  'km-g1': '#fca5a5',
  'km-g2': '#fdba74',
  'km-g3': '#fbbf24',
  'km-g4': '#4ade80',
  'km-g5': '#22d3ee',
  'km-g6': '#60a5fa',
  'km-jh': '#818cf8',
  'km-n5': '#fca5a5',
  'km-n4': '#fdba74',
  'km-n3': '#fbbf24',
  'km-n2': '#4ade80',
  'km-n1': '#818cf8',
  'km-wg1': '#fca5a5',
  'km-wg2': '#fdba74',
  'km-wg3': '#fbbf24',
  'km-wg4': '#4ade80',
  'km-wg5': '#22d3ee',
  'km-wg6': '#818cf8'
}

const GREY_VISUAL_CLASSES: ReadonlySet<string> = new Set([
  'km-unstudied',
  'km-locked',
  'km-untracked',
  'km-other'
])

/** Hex fill for a visual class, or null when that class is grey or colorless. */
export function visualFillColor(className: string): string | null {
  const parts = className.split(/\s+/)
  for (const part of parts) {
    if (GREY_VISUAL_CLASSES.has(part)) return null
  }
  for (const part of parts) {
    if (part.startsWith('km-acc-')) {
      const bucket = Number(part.slice('km-acc-'.length))
      const hex = ACCURACY_HEATMAP_PALETTE[bucket]
      if (hex) return hex
    }
    const fill = VISUAL_FILL_COLORS[part]
    if (fill) return fill
  }
  return null
}

/**
 * 2px border color for the same scale as Color mode.
 * Null when that mode would paint grey or no color.
 */
export function cellBorderColor(
  mode: ColorMode,
  input: CellVisualInput,
  scale?: HeatmapScale
): string | null {
  return visualFillColor(cellVisualClass(mode, input, scale))
}

/** How Secondary color is drawn. Default is the 2px edge. */
export const DEFAULT_SECONDARY_COLOR_PAINT: SecondaryColorPaint = 'border'

export const SECONDARY_COLOR_PAINT_ITEMS: ReadonlyArray<{ label: string, value: SecondaryColorPaint }> = [
  { label: 'Border', value: 'border' },
  { label: 'Gradient', value: 'gradient' }
]

/**
 * CSS gradient angle for secondary Gradient mode.
 * 150deg is 60° below the horizontal, top-left → bottom-right.
 */
export const SECONDARY_GRADIENT_ANGLE_DEG = 150

/** Hex fill for a color mode, including the grey bands used when that mode has no chroma. */
export function cellPaintColor(
  mode: ColorMode,
  input: CellVisualInput,
  scale?: HeatmapScale
): string {
  const className = cellVisualClass(mode, input, scale)
  const chromatic = visualFillColor(className)
  if (chromatic) return chromatic
  if (className.includes('km-untracked')) return SRS_BAND_COLORS.untracked
  return SRS_BAND_COLORS.unstudied
}

/**
 * Inline styles for Secondary color on a card.
 * Border mode: 2px outline when secondary is chromatic.
 * Gradient mode: primary → secondary fill at {@link SECONDARY_GRADIENT_ANGLE_DEG}.
 */
export function cellSecondaryStyle(
  paint: SecondaryColorPaint,
  primaryMode: ColorMode,
  secondaryMode: ColorMode,
  input: CellVisualInput,
  scale?: HeatmapScale
): Record<string, string> {
  const secondary = cellBorderColor(secondaryMode, input, scale)
  if (!secondary) return {}
  if (paint === 'gradient') {
    const primary = cellPaintColor(primaryMode, input, scale)
    return {
      backgroundImage: `linear-gradient(${SECONDARY_GRADIENT_ANGLE_DEG}deg, ${primary}, ${secondary})`
    }
  }
  return {
    outline: `2px solid ${secondary}`,
    outlineOffset: '-2px'
  }
}

/** True for overall / meaning / reading accuracy heatmap color modes. */
export function isAccuracyColorMode(mode: ColorMode): boolean {
  return mode === 'accuracy'
    || mode === 'accuracy-meaning'
    || mode === 'accuracy-reading'
}

/**
 * Accuracy % used for heatmap coloring.
 * Overall uses merged accuracy; meaning/reading use WK answer counts.
 * Null when there is no positive SRS or no applicable attempts.
 */
export function accuracyPctForColorMode(
  mode: ColorMode,
  input: CellVisualInput
): number | null {
  if (!isAccuracyColorMode(mode)) return null
  if (!hasApiSrs(input.sources, input.srsAvg)) return null

  if (mode === 'accuracy-meaning') {
    return accuracyFromCounts(input.meaningCorrect ?? 0, input.meaningIncorrect ?? 0)
  }
  if (mode === 'accuracy-reading') {
    return accuracyFromCounts(input.readingCorrect ?? 0, input.readingIncorrect ?? 0)
  }
  return sortableAccuracy(input.accuracyAvg, input.sources, input.srsAvg)
}

/** Anchor colors at the named accuracy levels (interpolated every 3% between these). */
export const ACCURACY_COLOR_STOPS: ReadonlyArray<{ pct: number, hex: string }> = [
  { pct: 100, hex: '#22c55e' }, // green
  { pct: 80, hex: '#86efac' }, // light green
  { pct: 70, hex: '#bef264' }, // lime
  { pct: 60, hex: '#fde047' }, // yellow
  { pct: 50, hex: '#f87171' }, // red
  { pct: 40, hex: '#fb7185' }, // rose
  { pct: 25, hex: '#d946ef' }, // magenta
  { pct: 10, hex: '#a855f7' }, // violet
  { pct: 0, hex: '#7e22ce' } // purple
]

/** 3% steps → buckets 0 (0%) … 33 (100%). */
export const ACCURACY_HEATMAP_STEP_PCT = 3
export const ACCURACY_HEATMAP_MAX_BUCKET = 33

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16)
  ]
}

function formatHex(r: number, g: number, b: number): string {
  const channel = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** Continuous color at an accuracy %, lerping RGB between adjacent stops. */
export function interpolateAccuracyColor(accuracyPct: number): string {
  const a = Math.min(100, Math.max(0, accuracyPct))
  const stops = ACCURACY_COLOR_STOPS
  if (a >= stops[0]!.pct) return stops[0]!.hex
  if (a <= stops[stops.length - 1]!.pct) return stops[stops.length - 1]!.hex

  for (let i = 0; i < stops.length - 1; i++) {
    const hi = stops[i]!
    const lo = stops[i + 1]!
    if (a <= hi.pct && a >= lo.pct) {
      const span = hi.pct - lo.pct
      const t = span === 0 ? 0 : (a - lo.pct) / span
      const [r0, g0, b0] = parseHex(lo.hex)
      const [r1, g1, b1] = parseHex(hi.hex)
      return formatHex(
        r0 + (r1 - r0) * t,
        g0 + (g1 - g0) * t,
        b0 + (b1 - b0) * t
      )
    }
  }
  return stops[stops.length - 1]!.hex
}

/**
 * Map accuracy % to a 3% heatmap bucket (0–33).
 * Bucket n covers roughly [n×3%, n×3%+3); 100% → 33.
 */
export function accuracyHeatmapBucket(accuracyAvg: number): number {
  const a = Math.min(100, Math.max(0, accuracyAvg))
  return Math.min(ACCURACY_HEATMAP_MAX_BUCKET, Math.floor(a / ACCURACY_HEATMAP_STEP_PCT))
}

/** Hex for the 3% bucket containing this accuracy. */
export function accuracyHeatmapColor(accuracyAvg: number): string {
  return ACCURACY_HEATMAP_PALETTE[accuracyHeatmapBucket(accuracyAvg)]!
}

/** Precomputed palette: index 0 = 0%, index 33 = 100%. */
export const ACCURACY_HEATMAP_PALETTE: readonly string[] = Array.from(
  { length: ACCURACY_HEATMAP_MAX_BUCKET + 1 },
  (_, bucket) => interpolateAccuracyColor(
    bucket === ACCURACY_HEATMAP_MAX_BUCKET
      ? 100
      : bucket * ACCURACY_HEATMAP_STEP_PCT
  )
)

/** @deprecated Prefer cellVisualClass — kept for existing tests. */
export function srsBackground(srsAvg: number | null): string {
  return `km-srs km-${srsBand(srsAvg)}`
}

/** @deprecated Prefer cellVisualClass — kept for existing tests. */
export function accuracyBackground(accuracyAvg: number | null): string {
  if (accuracyAvg == null) return 'km-unstudied'
  return `km-acc km-acc-${accuracyHeatmapBucket(accuracyAvg)}`
}

/** @deprecated Prefer cellVisualClass */
export function cellBackground(
  mode: ColorMode,
  srsAvg: number | null,
  accuracyAvg: number | null
): string {
  return mode === 'accuracy'
    ? accuracyBackground(accuracyAvg)
    : srsBackground(srsAvg)
}

export function formatAccuracy(
  accuracyAvg: number | null,
  options?: { sources?: number, srsAvg?: number | null }
): string {
  const effective = options
    ? sortableAccuracy(accuracyAvg, options.sources ?? 0, options.srsAvg ?? null)
    : accuracyAvg
  if (effective == null) return '--'
  return `${Math.round(effective)}%`
}
