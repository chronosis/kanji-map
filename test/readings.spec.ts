import { describe, expect, it } from 'vitest'
import {
  countDistinctRawReadings,
  expandReadingVariants,
  isKanaOnlyQuery,
  normalizeReadingsList,
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

  it('counts distinct raw readings without stem expansion', () => {
    expect(countDistinctRawReadings(['ご', 'かた.る', 'かた.らう', '!かた'])).toBe(4)
    expect(countDistinctRawReadings(['ご', 'ゴ'])).toBe(1)
    expect(countDistinctRawReadings([])).toBe(0)
  })
})
