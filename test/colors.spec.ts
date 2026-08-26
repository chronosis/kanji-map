import { describe, expect, it } from 'vitest'
import {
  cellVisualClass,
  formatAccuracy,
  hasApiSrs,
  sortableAccuracy,
  isUnstudied,
  isUntracked,
  isOmittedByMapFilter,
  accuracyHeatmapBucket,
  accuracyHeatmapColor,
  interpolateAccuracyColor,
  ACCURACY_HEATMAP_PALETTE,
  accuracyBackground,
  srsBand,
  srsBackground,
  cellBackground
} from '../shared/utils/colors'
import { SOURCE_WANIKANI } from '../shared/types/kanji'

function input(partial: Partial<Parameters<typeof isUntracked>[0]> = {}) {
  return {
    srsAvg: null as number | null,
    accuracyAvg: null as number | null,
    sources: 0,
    inJoyoo: false,
    schoolGrade: null as number | null,
    inWanikani: false,
    ...partial
  }
}

describe('colors', () => {
  it('formats accuracy', () => {
    expect(formatAccuracy(null)).toBe('--')
    expect(formatAccuracy(83.2)).toBe('83%')
    expect(formatAccuracy(100, { sources: 0, srsAvg: null })).toBe('--')
    expect(formatAccuracy(100, { sources: 1, srsAvg: 0 })).toBe('--')
    expect(formatAccuracy(100, { sources: 1, srsAvg: 3 })).toBe('100%')
  })

  it('treats accuracy as null for sort when SRS is zero', () => {
    expect(sortableAccuracy(100, 1, 0)).toBeNull()
    expect(sortableAccuracy(100, 1, 3)).toBe(100)
  })

  it('maps accuracy heatmap every 3% with interpolated colors', () => {
    expect(accuracyHeatmapBucket(100)).toBe(33)
    expect(accuracyHeatmapBucket(99)).toBe(33)
    expect(accuracyHeatmapBucket(98)).toBe(32)
    expect(accuracyHeatmapBucket(50)).toBe(16)
    expect(accuracyHeatmapBucket(49)).toBe(16)
    expect(accuracyHeatmapBucket(25)).toBe(8)
    expect(accuracyHeatmapBucket(0)).toBe(0)

    // Anchor stops keep their exact hex
    expect(interpolateAccuracyColor(100)).toBe('#22c55e')
    expect(interpolateAccuracyColor(50)).toBe('#f87171')
    expect(interpolateAccuracyColor(25)).toBe('#d946ef')
    expect(interpolateAccuracyColor(0)).toBe('#7e22ce')

    // Midpoints between anchors are blends (not equal to either end)
    const mid75 = interpolateAccuracyColor(75)
    expect(mid75).not.toBe(interpolateAccuracyColor(80))
    expect(mid75).not.toBe(interpolateAccuracyColor(70))
    expect(mid75.startsWith('#')).toBe(true)
    expect(mid75).toBe(accuracyHeatmapColor(75))

    expect(ACCURACY_HEATMAP_PALETTE).toHaveLength(34)
    expect(ACCURACY_HEATMAP_PALETTE[33]).toBe('#22c55e')
    expect(ACCURACY_HEATMAP_PALETTE[0]).toBe('#7e22ce')
    expect(ACCURACY_HEATMAP_PALETTE[20]).toBe('#fde047') // 60%

    expect(accuracyBackground(100)).toBe('km-acc km-acc-33')
    expect(accuracyBackground(50)).toBe('km-acc km-acc-16')
    expect(accuracyBackground(25)).toBe('km-acc km-acc-8')
    expect(accuracyBackground(0)).toBe('km-acc km-acc-0')
  })

  it('maps srs bands', () => {
    expect(srsBand(null)).toBe('unstudied')
    expect(srsBand(3)).toBe('apprentice')
    expect(srsBand(9)).toBe('burned')
  })

  it('returns distinct backgrounds for modes', () => {
    expect(srsBackground(null)).toContain('km-unstudied')
    expect(srsBackground(9)).toBe(srsBackground(9))
    expect(cellBackground('srs', 9, 50)).toBe(srsBackground(9))
    expect(cellBackground('accuracy', 9, null)).toContain('km-unstudied')
  })

  it('classifies untracked vs unstudied from inWanikani + curriculum', () => {
    expect(hasApiSrs(0, null)).toBe(false)
    expect(hasApiSrs(1, 0)).toBe(false)
    expect(hasApiSrs(1, 2)).toBe(true)

    // Untracked: jōyō / school, NOT in WK catalog → blue outline
    const untracked = input({ inJoyoo: true, schoolGrade: 1, inWanikani: false })
    expect(isUntracked(untracked)).toBe(true)
    expect(isUnstudied(untracked)).toBe(false)
    expect(cellVisualClass('srs', untracked)).toContain('km-untracked')
    expect(cellVisualClass('srs', untracked)).not.toContain('km-unstudied')

    // Unstudied: in WK catalog, SRS 0 → grey, NO blue
    const unstudied = input({
      inJoyoo: true,
      schoolGrade: 1,
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 0
    })
    expect(isUntracked(unstudied)).toBe(false)
    expect(isUnstudied(unstudied)).toBe(true)
    expect(cellVisualClass('srs', unstudied)).toContain('km-unstudied')
    expect(cellVisualClass('srs', unstudied)).not.toContain('km-untracked')

    // Studied WK: SRS colors win
    expect(cellVisualClass('srs', input({
      inJoyoo: true,
      schoolGrade: 1,
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 5
    }))).toContain('km-guru')

    // Non-curriculum, not in WK → grey unstudied style (not blue)
    expect(cellVisualClass('srs', input({
      inJoyoo: false,
      schoolGrade: null,
      inWanikani: false
    }))).toContain('km-unstudied')
  })

  it('omits map filter categories from the grid', () => {
    const untracked = input({ inJoyoo: true, schoolGrade: 1, inWanikani: false })
    const unstudied = input({
      inJoyoo: true,
      schoolGrade: 1,
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 0
    })
    const studied = input({
      inJoyoo: true,
      schoolGrade: 1,
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 5
    })

    expect(isOmittedByMapFilter('none', untracked)).toBe(false)
    expect(isOmittedByMapFilter('untracked', untracked)).toBe(true)
    expect(isOmittedByMapFilter('untracked', unstudied)).toBe(false)
    expect(isOmittedByMapFilter('untracked', studied)).toBe(false)
    expect(isOmittedByMapFilter('untracked-unstudied', untracked)).toBe(true)
    expect(isOmittedByMapFilter('untracked-unstudied', unstudied)).toBe(true)
    expect(isOmittedByMapFilter('untracked-unstudied', studied)).toBe(false)
    expect(isOmittedByMapFilter('unhighlighted', studied, { dimmed: true })).toBe(true)
    expect(isOmittedByMapFilter('unhighlighted', studied, { dimmed: false })).toBe(false)
  })
})
