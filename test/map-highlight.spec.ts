import { describe, expect, it } from 'vitest'
import type { MapCell } from '../shared/types/kanji'
import {
  hasActiveMapHighlight,
  isMapCellDimmed,
  isMapCellHighlighted,
  matchesKanjiSearchQuery
} from '../shared/utils/map-highlight'

function cell(partial: Partial<MapCell> & Pick<MapCell, 'character'>): MapCell {
  return {
    schoolGrade: null,
    jlptLevel: null,
    inJoyoo: true,
    freqRank: null,
    strokes: null,
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

describe('map-highlight', () => {
  const go = cell({
    character: '語',
    radicalSymbol: '言',
    radicalForms: ['訁'],
    parts: ['口', '五', '言']
  })

  it('matches kana-only queries against readings (on/kun stems)', () => {
    const go = cell({
      character: '語',
      readings: ['ご', 'かた', 'かたる', 'かたらう']
    })
    expect(matchesKanjiSearchQuery('ご', go)).toBe(true)
    expect(matchesKanjiSearchQuery('ゴ', go)).toBe(true)
    expect(matchesKanjiSearchQuery('かた', go)).toBe(true)
    expect(matchesKanjiSearchQuery('かたる', go)).toBe(true)
    expect(matchesKanjiSearchQuery('あ', go)).toBe(false)
  })

  it('does not use reading match when the query includes kanji', () => {
    const go = cell({
      character: '語',
      readings: ['ご']
    })
    expect(matchesKanjiSearchQuery('語ご', go)).toBe(false)
  })

  it('matches exact kanji', () => {
    expect(matchesKanjiSearchQuery('語', go)).toBe(true)
  })

  it('matches component parts', () => {
    expect(matchesKanjiSearchQuery('口', go)).toBe(true)
    expect(matchesKanjiSearchQuery('五', go)).toBe(true)
  })

  it('matches radical symbol and alternate forms', () => {
    expect(matchesKanjiSearchQuery('言', go)).toBe(true)
    expect(matchesKanjiSearchQuery('訁', go)).toBe(true)
  })

  it('does not match unrelated queries', () => {
    expect(matchesKanjiSearchQuery('木', go)).toBe(false)
  })

  it('treats empty search as matching all for highlight logic', () => {
    expect(matchesKanjiSearchQuery('', go)).toBe(true)
  })

  it('dims non-matching cells when search is active', () => {
    const filters = {
      highlightGrade: null,
      highlightSrsMin: null,
      highlightSrsMax: null,
      searchQuery: '口'
    }
    expect(hasActiveMapHighlight(filters)).toBe(true)
    expect(isMapCellHighlighted(go, filters)).toBe(true)
    expect(isMapCellDimmed(cell({ character: '木' }), filters)).toBe(true)
  })

  it('combines year and search filters', () => {
    const grade2 = cell({
      character: '語',
      schoolGrade: 2,
      parts: ['口']
    })
    const filters = {
      highlightGrade: 2 as const,
      highlightSrsMin: null,
      highlightSrsMax: null,
      searchQuery: '口'
    }
    expect(isMapCellHighlighted(grade2, filters)).toBe(true)
    expect(isMapCellHighlighted({ ...grade2, schoolGrade: 3 }, filters)).toBe(false)
  })
})
