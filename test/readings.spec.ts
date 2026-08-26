import { describe, expect, it } from 'vitest'
import {
  countDistinctReadingStems,
  expandReadingVariants,
  isKanaOnlyQuery,
  normalizeReadingsList,
  readingFullForm,
  readingStem,
  readingStemSet,
  readingsMatchQuery,
  toHiragana
} from '../shared/utils/readings'

describe('readings', () => {
  it('detects kana-only queries', () => {
    expect(isKanaOnlyQuery('ご')).toBe(true)
    expect(isKanaOnlyQuery('カタカナ')).toBe(true)
    expect(isKanaOnlyQuery('かたる')).toBe(true)
    expect(isKanaOnlyQuery('語')).toBe(false)
    expect(isKanaOnlyQuery('ご語')).toBe(false)
    expect(isKanaOnlyQuery('')).toBe(false)
  })

  it('converts katakana to hiragana', () => {
    expect(toHiragana('ゴ')).toBe('ご')
    expect(toHiragana('カタカナ')).toBe('かたかな')
  })

  it('expands okurigana readings into full and stem forms', () => {
    expect(expandReadingVariants('かた.る')).toEqual(['かたる', 'かた'])
    expect(expandReadingVariants('!かた')).toEqual(['かた'])
    expect(normalizeReadingsList(['ご', 'かた.る', 'かた.らう'])).toEqual([
      'かた',
      'かたらう',
      'かたる',
      'ご'
    ])
  })

  it('matches reading queries exactly against stored forms', () => {
    const readings = normalizeReadingsList(['ご', 'かた.る'])
    expect(readingsMatchQuery('ご', readings)).toBe(true)
    expect(readingsMatchQuery('ゴ', readings)).toBe(true)
    expect(readingsMatchQuery('かた', readings)).toBe(true)
    expect(readingsMatchQuery('かたる', readings)).toBe(true)
    expect(readingsMatchQuery('かた.る', readings)).toBe(true)
    expect(readingsMatchQuery('あ', readings)).toBe(false)
  })

  it('counts distinct reading stems (okurigana collapsed)', () => {
    expect(countDistinctReadingStems(['ご', 'かた.る', 'かた.らう', '!かた'])).toBe(2)
    expect(countDistinctReadingStems(['ご', 'ゴ'])).toBe(1)
    expect(countDistinctReadingStems(['なま-', '-う', 'い.きる'])).toBe(3)
    expect(countDistinctReadingStems([])).toBe(0)
  })

  it('dedupes stems across separate data sources via one Set', () => {
    const kanjidic = ['ご', 'かた.る', 'かた.らう']
    const wkDump = ['ご', '!かた']
    const liveWk = ['ゴ', 'かた']
    expect(countDistinctReadingStems(kanjidic, wkDump, liveWk)).toBe(2)
    expect(readingStemSet(kanjidic, wkDump, liveWk)).toEqual(new Set(['ご', 'かた']))
  })

  it('merges alternate okurigana splits of the same reading', () => {
    expect(readingFullForm('おこ.なう')).toBe('おこなう')
    expect(readingFullForm('おこな.う')).toBe('おこなう')
    // おこ.なう / おこな.う → one stem; -いき / -ゆき covered by い / ゆ
    expect(countDistinctReadingStems(
      ['こう', 'ぎょう', 'あん', 'い.く', '-いき', 'ゆ.く', '-ゆき', 'おこな.う', 'おこ.なう'],
      ['こう', 'ぎょう', '!い', '!おこな', '!ゆ']
    )).toBe(6)
  })

  it('collapses 生-style Kanjidic+WK variants to stems', () => {
    const kanjidic = [
      'せい', 'しょう',
      'い.きる', 'い.かす', 'い.ける',
      'う.まれる', 'うま.れる', 'う.まれ', 'うまれ', 'う.む',
      'お.う', 'は.える', 'は.やす',
      'き', 'なま', 'なま-', 'な.る', 'な.す', 'む.す', '-う'
    ]
    const wk = ['!い', '!なま', '!う', '!は', '!き', 'せい', 'しょう']
    // on: せい/しょう; kun: い/う/うま/うまれ/お/は/き/なま/な/む
    expect(countDistinctReadingStems(kanjidic, wk)).toBe(12)
    expect(readingStem('い.きる')).toBe('い')
    expect(readingStem('なま-')).toBe('なま')
    expect(readingStem('-う')).toBe('う')
  })
})
