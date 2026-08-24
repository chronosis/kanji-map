import { SOURCE_BUNPRO, SOURCE_WANIKANI } from '../types/kanji'

/** WaniKani SRS stages are 0 (locked/lesson) through 9 (burned). */
export const WK_SRS_MAX = 9

/**
 * BunPro uses stages roughly 0–11 (locked → burned).
 * Normalize onto the WK 0–9 scale for averaging.
 */
export function normalizeBunproSrs(bunproStage: number): number {
  if (!Number.isFinite(bunproStage) || bunproStage < 0) return 0
  const clamped = Math.min(bunproStage, 11)
  return (clamped / 11) * WK_SRS_MAX
}

export interface SourceProgress {
  srs: number
  accuracyPct: number | null
}

export interface MergedProgress {
  srsAvg: number | null
  accuracyAvg: number | null
  sources: number
}

export function mergeProgress(
  wanikani: SourceProgress | null,
  bunpro: SourceProgress | null
): MergedProgress {
  const sources
    = (wanikani ? SOURCE_WANIKANI : 0) | (bunpro ? SOURCE_BUNPRO : 0)

  if (!wanikani && !bunpro) {
    return { srsAvg: null, accuracyAvg: null, sources: 0 }
  }

  if (wanikani && !bunpro) {
    return {
      srsAvg: wanikani.srs,
      accuracyAvg: wanikani.accuracyPct,
      sources
    }
  }

  if (!wanikani && bunpro) {
    return {
      srsAvg: bunpro.srs,
      accuracyAvg: bunpro.accuracyPct,
      sources
    }
  }

  const wk = wanikani!
  const bp = bunpro!
  const srsAvg = (wk.srs + bp.srs) / 2

  let accuracyAvg: number | null = null
  if (wk.accuracyPct != null && bp.accuracyPct != null) {
    accuracyAvg = (wk.accuracyPct + bp.accuracyPct) / 2
  } else if (wk.accuracyPct != null) {
    accuracyAvg = wk.accuracyPct
  } else if (bp.accuracyPct != null) {
    accuracyAvg = bp.accuracyPct
  }

  return { srsAvg, accuracyAvg, sources }
}

/** Extract CJK unified ideographs from a string. */
export function extractKanji(text: string): string[] {
  const matches = text.match(/\p{Script=Han}/gu)
  return matches ? [...new Set(matches)] : []
}

export function accuracyFromCounts(correct: number, incorrect: number): number | null {
  const total = correct + incorrect
  if (total <= 0) return null
  return (correct / total) * 100
}
