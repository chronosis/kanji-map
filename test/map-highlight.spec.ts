import { describe, expect, it } from 'vitest'
import type { MapCell } from '../shared/types/kanji'
import {
  buildCollapsibleHighlightMenuItems,
  buildHighlightMenuItems,
  filterHighlightSelectionForSources,
  hasActiveMapHighlight,
  highlightFiltersFromSelection,
  isMapCellDimmed,
  isMapCellHighlighted,
  matchesKanjiSearchQuery,
  parseHighlightGradeValue,
  parseHighlightSrsValue,
  parseHighlightWkLevelValue
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
    meaningCorrect: 0,
    meaningIncorrect: 0,
    readingCorrect: 0,
    readingIncorrect: 0,
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
      highlightGrades: [],
      highlightJlptLevels: [],
      highlightSrsBands: [],
      highlightWkLevels: [],
      searchQuery: '口'
    }
    expect(hasActiveMapHighlight(filters)).toBe(true)
    expect(isMapCellHighlighted(go, filters)).toBe(true)
    expect(isMapCellDimmed(cell({ character: '木' }), filters)).toBe(true)
  })

  it('ORs multiple school years and ANDs with search', () => {
    const grade2 = cell({
      character: '語',
      schoolGrade: 2,
      parts: ['口']
    })
    const filters = highlightFiltersFromSelection(['year:2', 'year:3'], '口')
    expect(filters.highlightGrades).toEqual([2, 3])
    expect(isMapCellHighlighted(grade2, filters)).toBe(true)
    expect(isMapCellHighlighted({ ...grade2, schoolGrade: 3 }, filters)).toBe(true)
    expect(isMapCellHighlighted({ ...grade2, schoolGrade: 1 }, filters)).toBe(false)
  })

  it('ORs multiple SRS bands', () => {
    const apprentice = cell({
      character: '火',
      sources: 1,
      inWanikani: true,
      srsAvg: 3
    })
    const burned = cell({
      character: '水',
      sources: 1,
      inWanikani: true,
      srsAvg: 9
    })
    const filters = highlightFiltersFromSelection(['srs:1-4', 'srs:9-9'], '')
    expect(isMapCellHighlighted(apprentice, filters)).toBe(true)
    expect(isMapCellHighlighted(burned, filters)).toBe(true)
    expect(isMapCellHighlighted(cell({
      character: '木',
      sources: 1,
      inWanikani: true,
      srsAvg: 5
    }), filters)).toBe(false)
  })

  it('ORs WaniKani levels and ANDs with other categories', () => {
    const level5 = cell({
      character: '火',
      schoolGrade: 1,
      inWanikani: true,
      wkLevel: 5
    })
    const filters = highlightFiltersFromSelection(['year:1', 'wk:5', 'wk:6'], '')
    expect(filters.highlightWkLevels).toEqual([5, 6])
    expect(isMapCellHighlighted(level5, filters)).toBe(true)
    expect(isMapCellHighlighted({ ...level5, wkLevel: 6 }, filters)).toBe(true)
    expect(isMapCellHighlighted({ ...level5, wkLevel: 7 }, filters)).toBe(false)
    expect(isMapCellHighlighted({ ...level5, schoolGrade: 2 }, filters)).toBe(false)
  })

  it('ANDs year and SRS categories', () => {
    const match = cell({
      character: '日',
      schoolGrade: 1,
      sources: 1,
      inWanikani: true,
      srsAvg: 9
    })
    const filters = highlightFiltersFromSelection(['year:1', 'srs:9-9'], '')
    expect(isMapCellHighlighted(match, filters)).toBe(true)
    expect(isMapCellHighlighted({ ...match, schoolGrade: 2 }, filters)).toBe(false)
    expect(isMapCellHighlighted({ ...match, srsAvg: 3 }, filters)).toBe(false)
  })

  it('parses highlight option values and menu groups', () => {
    expect(parseHighlightGradeValue('year:jh')).toBe('jh')
    expect(parseHighlightSrsValue('srs:unstudied')).toEqual({ min: -1, max: -1 })
    expect(parseHighlightSrsValue('srs:5-9')).toEqual({ min: 5, max: 9 })
    expect(parseHighlightWkLevelValue('wk:12')).toBe(12)
    expect(parseHighlightWkLevelValue('wk:0')).toBeNull()
    expect(parseHighlightWkLevelValue('wk:61')).toBeNull()

    const withWk = buildHighlightMenuItems({ includeSrs: true, includeWkLevels: true })
    expect(withWk).toHaveLength(4)
    expect(withWk[0]?.[0]).toMatchObject({ type: 'label', label: 'School year' })
    expect(withWk[1]?.[0]).toMatchObject({ type: 'label', label: 'JLPT level' })
    expect(withWk[2]?.[0]).toMatchObject({ type: 'label', label: 'SRS stage' })
    expect(withWk[3]?.[0]).toMatchObject({ type: 'label', label: 'WaniKani level' })
    expect(withWk[3]).toHaveLength(61) // label + 60 levels

    const withoutWk = buildHighlightMenuItems({ includeSrs: false, includeWkLevels: false })
    expect(withoutWk).toHaveLength(2)
    expect(buildHighlightMenuItems()).toHaveLength(2)

    expect(filterHighlightSelectionForSources(['year:1', 'srs:1-4', 'wk:3'], false)).toEqual(['year:1'])
    expect(filterHighlightSelectionForSources(['year:1', 'srs:1-4', 'wk:3'], true)).toEqual([
      'year:1',
      'srs:1-4',
      'wk:3'
    ])
  })

  it('builds collapsible menu sections from collapsed state', () => {
    const expanded = buildCollapsibleHighlightMenuItems({
      includeSrs: true,
      includeWkLevels: true,
      collapsed: { year: false, jlpt: false, srs: false, wk: false }
    })
    expect(expanded[0]).toHaveLength(8) // header + 7 years
    expect(expanded[1]).toHaveLength(6) // header + 5 JLPT
    expect(expanded[3]).toHaveLength(61) // header + 60 levels

    const wkCollapsed = buildCollapsibleHighlightMenuItems({
      includeWkLevels: true,
      collapsed: { year: false, jlpt: false, srs: false, wk: true }
    })
    expect(wkCollapsed[2]).toHaveLength(1)
    expect(wkCollapsed[2]?.[0]).toMatchObject({
      isCategoryHeader: true,
      label: 'WaniKani level',
      icon: 'i-lucide-chevron-right'
    })
  })

  it('ORs JLPT levels and ANDs with other categories', () => {
    const n5 = cell({
      character: '火',
      schoolGrade: 1,
      jlptLevel: 'N5'
    })
    const filters = highlightFiltersFromSelection(['year:1', 'jlpt:N5', 'jlpt:N4'], '')
    expect(filters.highlightJlptLevels).toEqual(['N5', 'N4'])
    expect(isMapCellHighlighted(n5, filters)).toBe(true)
    expect(isMapCellHighlighted({ ...n5, jlptLevel: 'N4' }, filters)).toBe(true)
    expect(isMapCellHighlighted({ ...n5, jlptLevel: 'N1' }, filters)).toBe(false)
    expect(isMapCellHighlighted({ ...n5, schoolGrade: 2 }, filters)).toBe(false)
  })
})
