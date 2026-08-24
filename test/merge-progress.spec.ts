import { describe, expect, it } from 'vitest'
import {
  accuracyFromCounts,
  extractKanji,
  mergeProgress,
  normalizeBunproSrs
} from '../shared/utils/merge-progress'
import { SOURCE_BUNPRO, SOURCE_WANIKANI } from '../shared/types/kanji'

describe('merge-progress', () => {
  it('normalizes BunPro SRS onto 0–9', () => {
    expect(normalizeBunproSrs(0)).toBe(0)
    expect(normalizeBunproSrs(11)).toBe(9)
    expect(normalizeBunproSrs(5.5)).toBeCloseTo(4.5)
  })

  it('uses single source when only one present', () => {
    expect(mergeProgress({ srs: 5, accuracyPct: 80 }, null)).toEqual({
      srsAvg: 5,
      accuracyAvg: 80,
      sources: SOURCE_WANIKANI
    })
    expect(mergeProgress(null, { srs: 4, accuracyPct: null })).toEqual({
      srsAvg: 4,
      accuracyAvg: null,
      sources: SOURCE_BUNPRO
    })
  })

  it('averages both sources', () => {
    const merged = mergeProgress(
      { srs: 8, accuracyPct: 90 },
      { srs: 4, accuracyPct: 70 }
    )
    expect(merged.srsAvg).toBe(6)
    expect(merged.accuracyAvg).toBe(80)
    expect(merged.sources).toBe(SOURCE_WANIKANI | SOURCE_BUNPRO)
  })

  it('returns nulls when unstudied', () => {
    expect(mergeProgress(null, null)).toEqual({
      srsAvg: null,
      accuracyAvg: null,
      sources: 0
    })
  })

  it('extracts unique kanji', () => {
    expect(extractKanji('日本語abc漢')).toEqual(['日', '本', '語', '漢'])
    expect(extractKanji('hello')).toEqual([])
  })

  it('computes accuracy from counts', () => {
    expect(accuracyFromCounts(8, 2)).toBe(80)
    expect(accuracyFromCounts(0, 0)).toBeNull()
  })
})
