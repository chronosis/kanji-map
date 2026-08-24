import { accuracyFromCounts } from './merge-progress'

export interface WanikaniReviewCounts {
  meaningCorrect: number | null
  meaningIncorrect: number | null
  readingCorrect: number | null
  readingIncorrect: number | null
}

export interface WanikaniReviewStatsSnapshot extends WanikaniReviewCounts {
  accuracyPct: number | null
}

export function wkMeaningAttempts(stats: WanikaniReviewCounts): number {
  return (stats.meaningCorrect ?? 0) + (stats.meaningIncorrect ?? 0)
}

export function wkReadingAttempts(stats: WanikaniReviewCounts): number {
  return (stats.readingCorrect ?? 0) + (stats.readingIncorrect ?? 0)
}

export function hasWkReviewStats(stats: WanikaniReviewCounts): boolean {
  return wkMeaningAttempts(stats) > 0 || wkReadingAttempts(stats) > 0
}

/** True when stored correct counts are missing but accuracy / incorrect counts disagree. */
export function wanikaniReviewStatsLookStale(stats: WanikaniReviewStatsSnapshot): boolean {
  const mc = stats.meaningCorrect ?? 0
  const mi = stats.meaningIncorrect ?? 0
  const rc = stats.readingCorrect ?? 0
  const ri = stats.readingIncorrect ?? 0
  const wrong = mi + ri
  if (wrong === 0) return false

  const correct = mc + rc
  if (correct === 0 && stats.accuracyPct != null && stats.accuracyPct > 0) {
    return true
  }

  const computed = accuracyFromCounts(correct, wrong)
  if (stats.accuracyPct == null) {
    return correct === 0
  }
  if (computed == null) return true
  return Math.abs(computed - stats.accuracyPct) > 1
}
