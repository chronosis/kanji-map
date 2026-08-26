import { describe, expect, it } from 'vitest'
import {
  parseJishoKanjiPage,
  parseJishoKanjiParts,
  parseJishoKanjiRadical
} from '../server/adapters/jisho-kanji'

const GO_PAGE_SNIPPET = `
<dt>Radical:</dt>
<dd>
  <span title="KangXi radical 149.">
    <span class="radical_meaning">speech</span>
    言 (訁)
  </span>
</dd>
<dt>Parts:</dt>
<dd>
  <a href="//jisho.org/search/%E5%8F%A3%20%23kanji">口</a>
  <a href="//jisho.org/search/%E4%BA%94%20%23kanji">五</a>
  <a href="//jisho.org/search/%E8%A8%80%20%23kanji">言</a>
</dd>
`

describe('jisho-kanji adapter', () => {
  it('parses radical symbol and alternate forms', () => {
    expect(parseJishoKanjiRadical(GO_PAGE_SNIPPET)).toEqual({
      radicalSymbol: '言',
      radicalForms: ['訁']
    })
  })

  it('parses component parts', () => {
    expect(parseJishoKanjiParts(GO_PAGE_SNIPPET)).toEqual(['五', '口', '言'])
  })

  it('parses full kanji metadata', () => {
    expect(parseJishoKanjiPage(GO_PAGE_SNIPPET)).toEqual({
      radicalSymbol: '言',
      radicalForms: ['訁'],
      parts: ['五', '口', '言']
    })
  })

  it('returns empty metadata when sections are missing', () => {
    expect(parseJishoKanjiPage('<html></html>')).toEqual({
      radicalSymbol: null,
      radicalForms: [],
      parts: []
    })
  })
})
