import { describe, expect, it } from 'vitest'
import {
  parseWanikaniMnemonic,
  wanikaniKanjiUrl,
  wanikaniRadicalUrl
} from '../shared/utils/wanikani-mnemonic'

describe('wanikani mnemonic parsing', () => {
  it('builds radical URLs from tag slug text', () => {
    expect(wanikaniRadicalUrl('head')).toBe('https://www.wanikani.com/radicals/head')
    expect(wanikaniRadicalUrl('Ground Floor')).toBe('https://www.wanikani.com/radicals/ground-floor')
  })

  it('builds kanji URLs from resolved characters', () => {
    expect(wanikaniKanjiUrl('円')).toBe('https://www.wanikani.com/kanji/%E5%86%86')
  })

  it('replaces radical and kanji tags with link segments', () => {
    const lookup = new Map([['yen', '円']])
    const segments = parseWanikaniMnemonic(
      'The <radical>head</radical> looks like <kanji>yen</kanji> coin.',
      lookup
    )

    expect(segments).toEqual([
      { type: 'text', content: 'The ' },
      {
        type: 'link',
        content: 'head',
        href: 'https://www.wanikani.com/radicals/head'
      },
      { type: 'text', content: ' looks like ' },
      {
        type: 'link',
        content: 'yen',
        href: 'https://www.wanikani.com/kanji/%E5%86%86'
      },
      { type: 'text', content: ' coin.' }
    ])
  })

  it('keeps unknown kanji tag text when no primary meaning match exists', () => {
    const segments = parseWanikaniMnemonic('See <kanji>unknown</kanji>.', new Map())
    expect(segments).toEqual([
      { type: 'text', content: 'See ' },
      { type: 'text', content: 'unknown' },
      { type: 'text', content: '.' }
    ])
  })

  it('matches kanji meanings case-insensitively', () => {
    const segments = parseWanikaniMnemonic('<kanji>Yen</kanji>', new Map([['yen', '円']]))
    expect(segments[0]).toMatchObject({
      type: 'link',
      content: 'Yen',
      href: wanikaniKanjiUrl('円')
    })
  })

  it('styles reading tags as red italic text without links', () => {
    const segments = parseWanikaniMnemonic(
      'Sounds like <reading>sheep</reading>.',
      new Map()
    )
    expect(segments).toEqual([
      { type: 'text', content: 'Sounds like ' },
      { type: 'reading', content: 'sheep' },
      { type: 'text', content: '.' }
    ])
  })
})
