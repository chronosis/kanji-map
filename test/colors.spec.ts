import { describe, expect, it } from 'vitest'
import {
  cellBorderColor,
  cellPaintColor,
  cellSecondaryStyle,
  SECONDARY_GRADIENT_ANGLE_DEG,
  cellVisualClass,
  formatAccuracy,
  hasApiSrs,
  sortableAccuracy,
  isUnstudied,
  isUntracked,
  isOmittedByMapFilter,
  accuracyHeatmapBucket,
  accuracyHeatmapColor,
  accuracyTextColor,
  interpolateAccuracyColor,
  ACCURACY_HEATMAP_PALETTE,
  accuracyBackground,
  invertedCountHeatmapPct,
  schoolYearBand,
  jlptBand,
  wkLevelGroupBand,
  srsBand,
  srsBandColor,
  srsDisplayColor,
  srsDisplayLabel,
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

  it('uses a chromatic border only when the color mode would not be grey', () => {
    const burned = input({ inWanikani: true, sources: SOURCE_WANIKANI, srsAvg: 9 })
    const unstudied = input({ inWanikani: true, sources: SOURCE_WANIKANI, srsAvg: 0 })
    const untracked = input({ inWanikani: false, sources: 0, srsAvg: null })
    expect(cellBorderColor('none', burned)).toBeNull()
    expect(cellBorderColor('srs', burned)).toBe('#818cf8')
    expect(cellBorderColor('srs', unstudied)).toBeNull()
    expect(cellBorderColor('srs', untracked)).toBeNull()
    expect(cellBorderColor('year', input({ schoolGrade: 1, inJoyoo: true }))).toBe('#fca5a5')
    expect(cellBorderColor('year', input({ schoolGrade: null, inJoyoo: false }))).toBeNull()
    expect(cellBorderColor('jlpt', input({ jlptLevel: null }))).toBeNull()
    expect(cellBorderColor('accuracy', input({
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 9,
      accuracyAvg: 100
    }))).toBe('#22c55e')
    expect(cellBorderColor('accuracy', unstudied)).toBeNull()
  })

  it('paints secondary color as a border or a primary→secondary gradient', () => {
    const burned = input({ inWanikani: true, sources: SOURCE_WANIKANI, srsAvg: 9 })
    const grade1 = input({ schoolGrade: 1, inJoyoo: true })
    expect(cellSecondaryStyle('border', 'srs', 'none', burned)).toEqual({})
    expect(cellSecondaryStyle('border', 'srs', 'year', grade1)).toEqual({
      outline: '2px solid #fca5a5',
      outlineOffset: '-2px'
    })
    expect(cellSecondaryStyle('gradient', 'srs', 'none', burned)).toEqual({})
    const burnedGrade1 = input({
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 9,
      schoolGrade: 1,
      inJoyoo: true
    })
    expect(cellSecondaryStyle('gradient', 'srs', 'year', burnedGrade1)).toEqual({
      backgroundImage: `linear-gradient(${SECONDARY_GRADIENT_ANGLE_DEG}deg, #818cf8, #fca5a5)`
    })
    expect(cellPaintColor('none', burned)).toBe('#a3a3a3')
    expect(cellPaintColor('srs', input({ inWanikani: false, sources: 0, srsAvg: null }))).toBe('#737373')
  })

  it('names the SRS level that paints the hover bar', () => {
    const burned = input({ inWanikani: true, sources: SOURCE_WANIKANI, srsAvg: 9 })
    expect(srsDisplayLabel(burned)).toBe('Burned (9)')
    expect(srsDisplayColor(burned)).toBe('#818cf8')
    expect(srsDisplayLabel(input({ inWanikani: true, sources: SOURCE_WANIKANI, srsAvg: 5 }))).toBe('Guru (5)')
    expect(srsDisplayLabel(input({ inWanikani: true, sources: SOURCE_WANIKANI, srsAvg: 6 }))).toBe('Master (6)')
    expect(srsDisplayLabel(input({ inWanikani: true, sources: SOURCE_WANIKANI, srsAvg: 0 }))).toBe('Unstudied')
    expect(srsDisplayColor(input({ inWanikani: false, sources: 0, srsAvg: null }))).toBe('#737373')
    expect(srsDisplayLabel(input({ inWanikani: false, sources: 0, srsAvg: null }))).toBe('Untracked')
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

  it('inverts count heatmaps relative to corpus max', () => {
    expect(invertedCountHeatmapPct(0, 10)).toBe(100)
    expect(invertedCountHeatmapPct(5, 10)).toBe(50)
    expect(invertedCountHeatmapPct(10, 10)).toBe(0)
    expect(invertedCountHeatmapPct(0, 0)).toBe(100)

    const scale = { maxStrokes: 20, maxReadingCount: 4 }
    expect(cellVisualClass('strokes', input({ strokes: 20 }), scale)).toBe('km-acc km-acc-0')
    expect(cellVisualClass('strokes', input({ strokes: 10 }), scale)).toBe('km-acc km-acc-16')
    expect(cellVisualClass('strokes', input({ strokes: 0 }), scale)).toBe('km-acc km-acc-33')
    expect(cellVisualClass('strokes', input({ strokes: null }), scale)).toContain('km-untracked')
    expect(cellVisualClass('strokes', input({ strokes: null, inWanikani: true }), scale)).toContain('km-unstudied')

    expect(cellVisualClass('readings', input({ readingCount: 4 }), scale)).toBe('km-acc km-acc-0')
    expect(cellVisualClass('readings', input({ readingCount: 2 }), scale)).toBe('km-acc km-acc-16')
    expect(cellVisualClass('readings', input({ readingCount: 0 }), scale)).toBe('km-acc km-acc-33')
  })

  it('maps WaniKani level onto the inverted heatmap (1 green … 60 purple)', () => {
    expect(cellVisualClass('wk', input({ wkLevel: 60 }))).toBe('km-acc km-acc-0')
    expect(cellVisualClass('wk', input({ wkLevel: 30 }))).toBe('km-acc km-acc-16')
    expect(cellVisualClass('wk', input({ wkLevel: 1 }))).toBe(
      `km-acc km-acc-${accuracyHeatmapBucket(invertedCountHeatmapPct(1, 60))}`
    )
    expect(cellVisualClass('wk', input({ wkLevel: null, inWanikani: true }))).toContain('km-unstudied')
    expect(cellVisualClass('wk', input({
      wkLevel: null,
      inJoyoo: true,
      schoolGrade: 1,
      inWanikani: false
    }))).toContain('km-untracked')
  })

  it('maps srs bands', () => {
    expect(srsBand(null)).toBe('unstudied')
    expect(srsBand(3)).toBe('apprentice')
    expect(srsBand(9)).toBe('burned')
  })

  it('exposes SRS and accuracy text colors matching map palettes', () => {
    expect(srsBandColor(3)).toBe('#fca5a5')
    expect(srsBandColor(5)).toBe('#fbbf24')
    expect(srsBandColor(9)).toBe('#818cf8')
    expect(srsBandColor(null)).toBe('#a3a3a3')

    expect(accuracyTextColor(100, { sources: 1, srsAvg: 3 })).toBe(accuracyHeatmapColor(100))
    expect(accuracyTextColor(50, { sources: 1, srsAvg: 3 })).toBe(accuracyHeatmapColor(50))
    expect(accuracyTextColor(100, { sources: 1, srsAvg: 0 })).toBeNull()
    expect(accuracyTextColor(null, { sources: 1, srsAvg: 3 })).toBeNull()
  })

  it('maps school-year color bands', () => {
    expect(schoolYearBand({ schoolGrade: 1, inJoyoo: true })).toBe('g1')
    expect(schoolYearBand({ schoolGrade: 6, inJoyoo: true })).toBe('g6')
    expect(schoolYearBand({ schoolGrade: null, inJoyoo: true })).toBe('jh')
    expect(schoolYearBand({ schoolGrade: null, inJoyoo: false })).toBe('other')
    expect(cellVisualClass('year', input({ schoolGrade: 3, inJoyoo: true }))).toBe('km-year km-g3')
    expect(cellVisualClass('year', input({ schoolGrade: null, inJoyoo: true }))).toBe('km-year km-jh')
    expect(cellVisualClass('year', input({ inJoyoo: false }))).toBe('km-year km-other')
  })

  it('maps JLPT levels onto discrete color bands', () => {
    expect(jlptBand('N5')).toBe('n5')
    expect(jlptBand('N1')).toBe('n1')
    expect(jlptBand(null)).toBe('other')
    expect(cellVisualClass('jlpt', input({ jlptLevel: 'N5' }))).toBe('km-jlpt km-n5')
    expect(cellVisualClass('jlpt', input({ jlptLevel: 'N3' }))).toBe('km-jlpt km-n3')
    expect(cellVisualClass('jlpt', input({ jlptLevel: 'N1' }))).toBe('km-jlpt km-n1')
    expect(cellVisualClass('jlpt', input({ jlptLevel: null }))).toBe('km-jlpt km-other')
  })

  it('maps WaniKani levels onto decade color bands', () => {
    expect(wkLevelGroupBand(1)).toBe('wg1')
    expect(wkLevelGroupBand(10)).toBe('wg1')
    expect(wkLevelGroupBand(11)).toBe('wg2')
    expect(wkLevelGroupBand(30)).toBe('wg3')
    expect(wkLevelGroupBand(40)).toBe('wg4')
    expect(wkLevelGroupBand(50)).toBe('wg5')
    expect(wkLevelGroupBand(51)).toBe('wg6')
    expect(wkLevelGroupBand(60)).toBe('wg6')
    expect(wkLevelGroupBand(null)).toBe('other')
    expect(wkLevelGroupBand(0)).toBe('other')
    expect(cellVisualClass('wk-group', input({ wkLevel: 5 }))).toBe('km-wkg km-wg1')
    expect(cellVisualClass('wk-group', input({ wkLevel: 25 }))).toBe('km-wkg km-wg3')
    expect(cellVisualClass('wk-group', input({ wkLevel: 55 }))).toBe('km-wkg km-wg6')
    expect(cellVisualClass('wk-group', input({ wkLevel: null }))).toBe('km-wkg km-other')
  })

  it('maps meaning and reading accuracy onto the heatmap', () => {
    const studied = input({
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 5,
      accuracyAvg: 90,
      meaningCorrect: 9,
      meaningIncorrect: 1,
      readingCorrect: 5,
      readingIncorrect: 5
    })
    expect(cellVisualClass('accuracy', studied)).toBe('km-acc km-acc-30')
    expect(cellVisualClass('accuracy-meaning', studied)).toBe('km-acc km-acc-30')
    expect(cellVisualClass('accuracy-reading', studied)).toBe('km-acc km-acc-16')

    const noMeaningAttempts = input({
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 5,
      accuracyAvg: 90,
      meaningCorrect: 0,
      meaningIncorrect: 0,
      readingCorrect: 10,
      readingIncorrect: 0
    })
    expect(cellVisualClass('accuracy-meaning', noMeaningAttempts)).toContain('km-unstudied')
    expect(cellVisualClass('accuracy-reading', noMeaningAttempts)).toBe('km-acc km-acc-33')

    expect(cellVisualClass('accuracy-meaning', input({
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 0,
      meaningCorrect: 5,
      meaningIncorrect: 0
    }))).toContain('km-unstudied')
  })

  it('paints every cell the same grey in none mode', () => {
    expect(cellVisualClass('none', input({ schoolGrade: 1, inJoyoo: true, inWanikani: false }))).toBe(
      'km-srs km-unstudied'
    )
    expect(cellVisualClass('none', input({
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 9
    }))).toBe('km-srs km-unstudied')
  })

  it('returns distinct backgrounds for modes', () => {
    expect(srsBackground(null)).toContain('km-unstudied')
    expect(srsBackground(9)).toBe(srsBackground(9))
    expect(cellBackground('srs', 9, 50)).toBe(srsBackground(9))
    expect(cellBackground('accuracy', 9, null)).toContain('km-unstudied')
  })

  it('classifies untracked vs unstudied from inWanikani', () => {
    expect(hasApiSrs(0, null)).toBe(false)
    expect(hasApiSrs(1, 0)).toBe(false)
    expect(hasApiSrs(1, 2)).toBe(true)

    // Untracked: not in WK catalog (jōyō or JLPT-only) → blue outline
    const untracked = input({ inJoyoo: true, schoolGrade: 1, inWanikani: false })
    expect(isUntracked(untracked)).toBe(true)
    expect(isUnstudied(untracked)).toBe(false)
    expect(cellVisualClass('srs', untracked)).toContain('km-untracked')
    expect(cellVisualClass('srs', untracked)).not.toContain('km-unstudied')

    const jlptOnlyUntracked = input({
      inJoyoo: false,
      schoolGrade: null,
      jlptLevel: 'N1',
      inWanikani: false
    })
    expect(isUntracked(jlptOnlyUntracked)).toBe(true)
    expect(cellVisualClass('srs', jlptOnlyUntracked)).toContain('km-untracked')

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

    const burned = input({
      inJoyoo: true,
      schoolGrade: 1,
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 9
    })
    const enlightened = input({
      inJoyoo: true,
      schoolGrade: 1,
      inWanikani: true,
      sources: SOURCE_WANIKANI,
      srsAvg: 8
    })

    expect(isOmittedByMapFilter([], untracked)).toBe(false)
    expect(isOmittedByMapFilter(['untracked'], untracked)).toBe(true)
    expect(isOmittedByMapFilter(['untracked'], unstudied)).toBe(false)
    expect(isOmittedByMapFilter(['untracked'], studied)).toBe(false)
    expect(isOmittedByMapFilter(['unstudied'], unstudied)).toBe(true)
    expect(isOmittedByMapFilter(['unstudied'], untracked)).toBe(false)
    expect(isOmittedByMapFilter(['unstudied'], studied)).toBe(false)
    expect(isOmittedByMapFilter(['untracked', 'unstudied'], untracked)).toBe(true)
    expect(isOmittedByMapFilter(['untracked', 'unstudied'], unstudied)).toBe(true)
    expect(isOmittedByMapFilter(['untracked', 'unstudied'], studied)).toBe(false)
    expect(isOmittedByMapFilter(['unhighlighted'], studied, { dimmed: true })).toBe(true)
    expect(isOmittedByMapFilter(['unhighlighted'], studied, { dimmed: false })).toBe(false)
    expect(isOmittedByMapFilter(['burned'], burned)).toBe(true)
    expect(isOmittedByMapFilter(['burned'], enlightened)).toBe(false)
    expect(isOmittedByMapFilter(['burned'], studied)).toBe(false)
    expect(isOmittedByMapFilter(['burned'], input({
      inWanikani: true,
      sources: 0,
      srsAvg: 9
    }))).toBe(false)
    expect(isOmittedByMapFilter(['burned', 'untracked'], untracked)).toBe(true)
    expect(isOmittedByMapFilter(['burned', 'untracked'], burned)).toBe(true)
  })
})
