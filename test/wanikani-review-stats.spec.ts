import { describe, expect, it } from 'vitest'
import {
  hasWkReviewStats,
  wanikaniReviewStatsLookStale,
  wkMeaningAttempts,
  wkReadingAttempts
} from '../shared/utils/wanikani-review-stats'

describe('wanikani review stats helpers', () => {
  it('detects stale rows where correct counts were never stored', () => {
    expect(wanikaniReviewStatsLookStale({
      meaningCorrect: 0,
      meaningIncorrect: 2,
      readingCorrect: 0,
      readingIncorrect: 1,
      accuracyPct: 92
    })).toBe(true)
  })

  it('accepts rows where counts match stored accuracy', () => {
    expect(wanikaniReviewStatsLookStale({
      meaningCorrect: 23,
      meaningIncorrect: 2,
      readingCorrect: 11,
      readingIncorrect: 1,
      accuracyPct: 92
    })).toBe(false)
  })

  it('computes per-dimension attempt totals', () => {
    const stats = {
      meaningCorrect: 23,
      meaningIncorrect: 2,
      readingCorrect: 11,
      readingIncorrect: 1,
      accuracyPct: 92
    }
    expect(wkMeaningAttempts(stats)).toBe(25)
    expect(wkReadingAttempts(stats)).toBe(12)
    expect(hasWkReviewStats(stats)).toBe(true)
  })
})
