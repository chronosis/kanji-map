import { describe, expect, it } from 'vitest'
import {
  cellVisualClass,
  formatAccuracy,
  hasApiSrs,
  isUnstudied,
  isUntracked,
  isOmittedByMapFilter,
  accuracyHeatmapBucket,
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

  it('maps accuracy heatmap: 100–50% green→red, 50–0% red→magenta→purple', () => {
    expect(accuracyHeatmapBucket(100)).toBe(9)
    expect(accuracyHeatmapBucket(90)).toBe(9)
    expect(accuracyHeatmapBucket(80)).toBe(8)
    expect(accuracyHeatmapBucket(70)).toBe(7)
    expect(accuracyHeatmapBucket(60)).toBe(6)
    expect(accuracyHeatmapBucket(50)).toBe(5)
    expect(accuracyHeatmapBucket(40)).toBe(4)
    expect(accuracyHeatmapBucket(25)).toBe(2)
    expect(accuracyHeatmapBucket(10)).toBe(1)
    expect(accuracyHeatmapBucket(0)).toBe(0)

    expect(accuracyBackground(100)).toBe('km-acc km-acc-9')
    expect(accuracyBackground(50)).toBe('km-acc km-acc-5')
    expect(accuracyBackground(25)).toBe('km-acc km-acc-2')
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
  })
})
