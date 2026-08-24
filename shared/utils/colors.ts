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
      const bucket = Math.min(9, Math.floor(Math.max(0, input.accuracyAvg) / 10))
      return `km-acc km-acc-${bucket}`
    }
    return `km-srs km-${srsBand(input.srsAvg)}`
  }

  // No positive SRS: untracked (blue) vs unstudied / other grey (no blue)
  if (isUntracked(input)) {
    return 'km-srs km-untracked'
  }

  return 'km-srs km-unstudied'
}

/** @deprecated Prefer cellVisualClass — kept for existing tests. */
export function srsBackground(srsAvg: number | null): string {
  return `km-srs km-${srsBand(srsAvg)}`
}

/** @deprecated Prefer cellVisualClass — kept for existing tests. */
export function accuracyBackground(accuracyAvg: number | null): string {
  if (accuracyAvg == null) return 'km-unstudied'
  const bucket = Math.min(9, Math.floor(Math.max(0, accuracyAvg) / 10))
  return `km-acc km-acc-${bucket}`
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
  if (options) {
    if (!hasApiSrs(options.sources ?? 0, options.srsAvg ?? null)) return '--'
  }
  if (accuracyAvg == null) return '--'
  return `${Math.round(accuracyAvg)}%`
}
