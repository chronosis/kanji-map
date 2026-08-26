import { describe, expect, it } from 'vitest'
import {
  assignGridIndices,
  compareByAccuracy,
  compareByJoyoAppearance,
  compareByReadingCount,
  compareBySrs,
  compareByStrokeCount,
  compareByUsage,
  compareByWk,
  compareKanjiEntries,
  orderKanjiUnion,
  schoolYearLabel,
  sortMapCells
} from '../shared/utils/kanji-order'
import type { KanjiUnionEntry, MapCell } from '../shared/types/kanji'

function entry(
  character: string,
  partial: Partial<KanjiUnionEntry> = {}
): KanjiUnionEntry {
  return {
    character,
    schoolGrade: null,
    jlptLevel: null,
    inJoyoo: true,
    freqRank: null,
    strokes: null,
    ...partial
  }
}

function cell(
  character: string,
  partial: Partial<MapCell> = {}
): MapCell {
  return {
    ...entry(character),
    gridIndex: 0,
    srsAvg: null,
    accuracyAvg: null,
    sources: 0,
    inWanikani: false,
    wkLevel: null,
    wkSubjectId: null,
    wkApiOrder: null,
    radicalSymbol: null,
    radicalForms: [],
    parts: [],
    readings: [],
    readingCount: 0,
    joyoIndex: 0,
    ...partial
  }
}

describe('kanji-order', () => {
  it('orders by grade then JLPT then code point', () => {
    const sample = [
      entry('漢', { jlptLevel: 'N1', inJoyoo: true }),
      entry('一', { schoolGrade: 1, jlptLevel: 'N5' }),
      entry('字', { schoolGrade: 1, jlptLevel: 'N4' })
    ]
    const ordered = orderKanjiUnion(sample, 'grade')
    expect(ordered.map(o => o.character)).toEqual(['一', '字', '漢'])
  })

  it('orders by usage frequency', () => {
    const sample = [
      entry('漢', { freqRank: 500 }),
      entry('一', { freqRank: 1 }),
      entry('稀', { freqRank: null })
    ]
    expect(orderKanjiUnion(sample, 'usage').map(o => o.character)).toEqual(['一', '漢', '稀'])
    expect(compareByUsage(sample[0], sample[1])).toBeGreaterThan(0)
  })

  it('orders jōyō appearance: joyo first, then grade, then strokes', () => {
    const sample = [
      entry('外', { inJoyoo: false, strokes: 1 }),
      entry('漢', { inJoyoo: true, schoolGrade: null, strokes: 13 }),
      entry('一', { inJoyoo: true, schoolGrade: 1, strokes: 1 }),
      entry('二', { inJoyoo: true, schoolGrade: 1, strokes: 2 })
    ]
    expect(orderKanjiUnion(sample, 'joyo').map(o => o.character)).toEqual(['一', '二', '漢', '外'])
    expect(compareByJoyoAppearance(sample[0], sample[2])).toBeGreaterThan(0)
  })

  it('orders by WaniKani level then API response appearance', () => {
    const cells = [
      cell('漢', { wkLevel: 10, wkApiOrder: 200, inWanikani: true }),
      cell('一', { wkLevel: 1, wkApiOrder: 50, inWanikani: true }),
      cell('月', { wkLevel: 1, wkApiOrder: 40, inWanikani: true }),
      cell('稀', { wkLevel: null, wkApiOrder: null, inJoyoo: false, inWanikani: false })
    ]
    expect(sortMapCells(cells, 'wk').map(c => c.character)).toEqual(['月', '一', '漢', '稀'])
    expect(compareByWk(cells[0], cells[1])).toBeGreaterThan(0)
  })

  it('orders by accuracy descending with untracked last', () => {
    const cells = [
      cell('未', { inJoyoo: true, schoolGrade: 2, accuracyAvg: 90, inWanikani: false }),
      cell('日', { inWanikani: true, accuracyAvg: 95, sources: 1, srsAvg: 5 }),
      cell('月', { inWanikani: true, accuracyAvg: 80, sources: 1, srsAvg: 4 }),
      cell('学', { inWanikani: true, accuracyAvg: null, sources: 0 }),
      cell('外', { inJoyoo: false, accuracyAvg: null, inWanikani: false })
    ]
    expect(sortMapCells(cells, 'accuracy').map(c => c.character)).toEqual(['日', '月', '外', '学', '未'])
    expect(compareByAccuracy(cells[1], cells[2])).toBeLessThan(0)
    expect(compareByAccuracy(cells[0], cells[1])).toBeGreaterThan(0)
  })

  it('ignores stored accuracy when SRS is still zero (unstudied display)', () => {
    const cells = [
      cell('僕', { inWanikani: true, accuracyAvg: 100, sources: 1, srsAvg: 0 }),
      cell('日', { inWanikani: true, accuracyAvg: 100, sources: 1, srsAvg: 5 }),
      cell('月', { inWanikani: true, accuracyAvg: null, sources: 1, srsAvg: 0 })
    ]
    expect(sortMapCells(cells, 'accuracy').map(c => c.character)).toEqual(['日', '僕', '月'])
  })

  it('orders by reading count descending then jōyō appearance', () => {
    const cells = [
      cell('一', { readingCount: 2, inJoyoo: true, schoolGrade: 1, strokes: 1 }),
      cell('語', { readingCount: 3, inJoyoo: true, schoolGrade: 2, strokes: 14 }),
      cell('漢', { readingCount: 3, inJoyoo: true, schoolGrade: 3, strokes: 13 }),
      cell('外', { readingCount: 0, inJoyoo: false, strokes: 5 }),
      cell('未', { readingCount: 0, inJoyoo: true, schoolGrade: 2, strokes: 5 })
    ]
    expect(sortMapCells(cells, 'readings').map(c => c.character)).toEqual(['語', '漢', '一', '未', '外'])
    expect(compareByReadingCount(cells[1]!, cells[0]!)).toBeLessThan(0)
  })

  it('orders by stroke count ascending then jōyō appearance', () => {
    const cells = [
      cell('漢', { strokes: 13, inJoyoo: true, schoolGrade: null }),
      cell('二', { strokes: 2, inJoyoo: true, schoolGrade: 1 }),
      cell('一', { strokes: 1, inJoyoo: true, schoolGrade: 1 }),
      cell('外', { strokes: 1, inJoyoo: false }),
      cell('稀', { strokes: null, inJoyoo: true, schoolGrade: 5 })
    ]
    expect(sortMapCells(cells, 'strokes').map(c => c.character)).toEqual(['一', '外', '二', '漢', '稀'])
    expect(compareByStrokeCount(cells[2]!, cells[1]!)).toBeLessThan(0)
  })

  it('orders by SRS stage descending then WaniKani lesson order', () => {
    const cells = [
      cell('火', { inWanikani: true, srsAvg: 9, wkLevel: 2, wkApiOrder: 10, sources: 1 }),
      cell('水', { inWanikani: true, srsAvg: 9, wkLevel: 1, wkApiOrder: 5, sources: 1 }),
      cell('木', { inWanikani: true, srsAvg: 4, wkLevel: 3, wkApiOrder: 1, sources: 1 }),
      cell('金', { inWanikani: true, srsAvg: 0, wkLevel: 5, wkApiOrder: 1, sources: 1 }),
      cell('未', { inJoyoo: true, schoolGrade: 2, inWanikani: false, srsAvg: null, sources: 0 })
    ]
    expect(sortMapCells(cells, 'srs').map(c => c.character)).toEqual(['水', '火', '木', '金', '未'])
    expect(compareBySrs(cells[0], cells[1])).toBeGreaterThan(0)
    expect(compareBySrs(cells[2], cells[3])).toBeLessThan(0)
  })

  it('puts untracked last in WK order with gridIndex +9000', () => {
    const cells = [
      cell('未', { inJoyoo: true, schoolGrade: 2, wkLevel: null, sources: 0, inWanikani: false }),
      cell('日', {
        inJoyoo: true,
        schoolGrade: 1,
        wkLevel: 1,
        wkApiOrder: 10,
        sources: 1,
        inWanikani: true
      }),
      cell('外', { inJoyoo: false, wkLevel: null, sources: 0, inWanikani: false }),
      cell('学', { inJoyoo: true, schoolGrade: null, wkLevel: null, sources: 0, inWanikani: false })
    ]
    const sorted = sortMapCells(cells, 'wk')
    expect(sorted.map(c => c.character)).toEqual(['日', '外', '学', '未'])
    expect(sorted.find(c => c.character === '日')?.gridIndex).toBe(0)
    expect(sorted.find(c => c.character === '外')?.gridIndex).toBe(1)
    expect(sorted.find(c => c.character === '学')?.gridIndex).toBe(9000)
    expect(sorted.find(c => c.character === '未')?.gridIndex).toBe(9001)
  })

  it('assigns contiguous grid indices', () => {
    const indexed = assignGridIndices([
      entry('二', { schoolGrade: 1, jlptLevel: 'N5' }),
      entry('一', { schoolGrade: 1, jlptLevel: 'N5' })
    ])
    expect(indexed[0].character).toBe('一')
    expect(indexed[0].gridIndex).toBe(0)
    expect(indexed[1].gridIndex).toBe(1)
  })

  it('compare is stable for equal keys via code point', () => {
    const a = entry('一', { schoolGrade: 1, jlptLevel: 'N5' })
    const b = entry('七', { schoolGrade: 1, jlptLevel: 'N5' })
    expect(compareKanjiEntries(a, b)).toBeLessThan(0)
  })

  it('labels school years as 小N / 中学+', () => {
    expect(schoolYearLabel(1, true)).toBe('小1')
    expect(schoolYearLabel(null, true)).toBe('中学+')
    expect(schoolYearLabel(null, false)).toBe('—')
  })

  it('sortMapCells reindexes for the UI', () => {
    const cells = [
      cell('漢', { freqRank: 10 }),
      cell('一', { freqRank: 1 })
    ]
    const sorted = sortMapCells(cells, 'usage')
    expect(sorted.map(c => c.character)).toEqual(['一', '漢'])
    expect(sorted[0].gridIndex).toBe(0)
  })
})
