import { describe, expect, it } from 'vitest'
import { assignGridIndices, compareKanjiEntries } from '../shared/utils/kanji-order'
import {
  accuracyFromCounts,
  extractKanji,
  mergeProgress,
  normalizeBunproSrs
} from '../shared/utils/merge-progress'
import { accuracyBackground, formatAccuracy, srsBackground } from '../shared/utils/colors'
import { jishoKanjiUrl } from '../shared/utils/kanji'
import type { KanjiUnionEntry } from '../shared/types/kanji'

describe('normalizeBunproSrs', () => {
  it('maps 0 → 0 and 11 → 9', () => {
    expect(normalizeBunproSrs(0)).toBe(0)
    expect(normalizeBunproSrs(11)).toBe(9)
  })

  it('clamps above max', () => {
    expect(normalizeBunproSrs(99)).toBe(9)
  })
})

describe('mergeProgress', () => {
  it('returns nulls when neither source exists', () => {
    expect(mergeProgress(null, null)).toEqual({
      srsAvg: null,
      accuracyAvg: null,
      sources: 0
    })
  })

  it('uses single source as-is', () => {
    expect(mergeProgress({ srs: 5, accuracyPct: 80 }, null)).toEqual({
      srsAvg: 5,
      accuracyAvg: 80,
      sources: 1
    })
  })

  it('averages both sources', () => {
    const merged = mergeProgress(
      { srs: 4, accuracyPct: 100 },
      { srs: 6, accuracyPct: 50 }
    )
    expect(merged.srsAvg).toBe(5)
    expect(merged.accuracyAvg).toBe(75)
    expect(merged.sources).toBe(3)
  })

  it('averages accuracy when only one side has it', () => {
    const merged = mergeProgress(
      { srs: 4, accuracyPct: 90 },
      { srs: 6, accuracyPct: null }
    )
    expect(merged.accuracyAvg).toBe(90)
  })
})

describe('kanji order', () => {
  it('orders by grade then JLPT then code point', () => {
    const a: KanjiUnionEntry = {
      character: '日', schoolGrade: 1, jlptLevel: 'N5', inJoyoo: true, freqRank: 1, strokes: 4
    }
    const b: KanjiUnionEntry = {
      character: '月', schoolGrade: 1, jlptLevel: 'N4', inJoyoo: true, freqRank: 2, strokes: 4
    }
    const c: KanjiUnionEntry = {
      character: '漢', schoolGrade: null, jlptLevel: 'N1', inJoyoo: true, freqRank: 100, strokes: 13
    }
    expect(compareKanjiEntries(a, b)).toBeLessThan(0)
    expect(compareKanjiEntries(b, c)).toBeLessThan(0)
    const ordered = assignGridIndices([c, b, a])
    expect(ordered.map(e => e.character)).toEqual(['日', '月', '漢'])
    expect(ordered.map(e => e.gridIndex)).toEqual([0, 1, 2])
  })
})

describe('extractKanji', () => {
  it('pulls unique ideographs', () => {
    expect(extractKanji('これは漢字とkanjiと漢字')).toEqual(['漢', '字'])
  })
})

describe('accuracyFromCounts', () => {
  it('returns null for empty', () => {
    expect(accuracyFromCounts(0, 0)).toBeNull()
  })

  it('computes percentage', () => {
    expect(accuracyFromCounts(3, 1)).toBe(75)
  })
})

describe('colors', () => {
  it('formats unstudied accuracy as --', () => {
    expect(formatAccuracy(null)).toBe('--')
    expect(formatAccuracy(87.2)).toBe('87%')
  })

  it('returns backgrounds for srs and accuracy', () => {
    expect(srsBackground(null)).toContain('km-unstudied')
    expect(srsBackground(9)).toContain('km-burned')
    expect(accuracyBackground(null)).toContain('km-unstudied')
    expect(accuracyBackground(50)).toContain('km-acc-')
  })
})

describe('jishoKanjiUrl', () => {
  it('builds jisho kanji search URL', () => {
    expect(jishoKanjiUrl('漢字')).toBe('https://jisho.org/search/%E6%BC%A2%E5%AD%97%23kanji')
  })
})
