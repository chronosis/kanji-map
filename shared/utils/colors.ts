import type { ColorMode } from '../types/kanji'
import { SOURCE_WANIKANI } from '../types/kanji'

/**
 * Cell visual bands — see `.ai/memory-bank/decisions/unstudied-vs-untracked.md`.
 *
 * Decision order for grey cells (no positive SRS):
 * 1. Untracked = curriculum (jōyō / 小1–6) AND NOT in the WaniKani kanji catalog
 * 2. Unstudied = everything else without positive SRS (typically in WK at SRS 0)
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
 * Untracked: on the school/jōyō list but absent from WaniKani’s catalog.
 * These will never receive a WK SRS stage. Visual: neutral-500 + blue outline.
 */
export function isUntracked(input: CellVisualInput): boolean {
  return isCurriculum(input) && !input.inWanikani
}

/**
 * Unstudied: in WaniKani’s catalog (so an SRS stage is possible) but no positive SRS yet.
 * Visual: neutral-400, no blue outline.
 *
 * Note: JLPT-only extras with no WK membership also fall through to the unstudied *style*
 * in `cellVisualClass` (grey, no blue) but are not “unstudied” in the WK sense.
 */
export function isUnstudied(input: CellVisualInput): boolean {
  return input.inWanikani && !hasApiSrs(input.sources, input.srsAvg)
}

/**
 * Whether the toolbar Filters control should omit this cell from the grid.
 * Modes name the categories to hide (not highlight).
 */
export function isOmittedByMapFilter(
  mode: 'none' | 'untracked' | 'untracked-unstudied',
  input: CellVisualInput
): boolean {
  if (mode === 'none') return false
  if (mode === 'untracked') return isUntracked(input)
  return isUntracked(input) || isUnstudied(input)
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

export function cellVisualClass(mode: ColorMode, input: CellVisualInput): string {
  if (hasApiSrs(input.sources, input.srsAvg)) {
    if (mode === 'accuracy') {
      if (input.accuracyAvg == null) return 'km-srs km-unstudied'
      return `km-acc km-acc-${accuracyHeatmapBucket(input.accuracyAvg)}`
    }
    return `km-srs km-${srsBand(input.srsAvg)}`
  }

  // No positive SRS: untracked (blue) vs unstudied / other grey (no blue)
  if (isUntracked(input)) {
    return 'km-srs km-untracked'
  }

  return 'km-srs km-unstudied'
}

/** Anchor colors at the named accuracy levels (interpolated every 5% between these). */
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

/** 5% steps → buckets 0 (0%) … 20 (100%). */
export const ACCURACY_HEATMAP_STEP_PCT = 5
export const ACCURACY_HEATMAP_MAX_BUCKET = 20

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
 * Map accuracy % to a 5% heatmap bucket (0–20).
 * Bucket n covers roughly [n×5%, n×5%+5); 100% → 20.
 */
export function accuracyHeatmapBucket(accuracyAvg: number): number {
  const a = Math.min(100, Math.max(0, accuracyAvg))
  return Math.min(ACCURACY_HEATMAP_MAX_BUCKET, Math.floor(a / ACCURACY_HEATMAP_STEP_PCT))
}

/** Hex for the 5% bucket containing this accuracy. */
export function accuracyHeatmapColor(accuracyAvg: number): string {
  return ACCURACY_HEATMAP_PALETTE[accuracyHeatmapBucket(accuracyAvg)]!
}

/** Precomputed palette: index 0 = 0%, index 20 = 100%. */
export const ACCURACY_HEATMAP_PALETTE: readonly string[] = Array.from(
  { length: ACCURACY_HEATMAP_MAX_BUCKET + 1 },
  (_, bucket) => interpolateAccuracyColor(bucket * ACCURACY_HEATMAP_STEP_PCT)
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
