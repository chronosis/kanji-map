import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  parseJishoKanjiMeanings,
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

const ICHI_MEANINGS_SNIPPET = `
<div class="kanji-details__main-meanings">
  one, one radical (no.1)
</div>
`

describe('jisho-kanji adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

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

  it('parses English meanings from the main meanings block', () => {
    expect(parseJishoKanjiMeanings(ICHI_MEANINGS_SNIPPET)).toEqual([
      'one',
      'one radical (no.1)'
    ])
    expect(parseJishoKanjiMeanings('<html></html>')).toEqual([])
  })

  it('fetches and parses kanji meanings from a Jisho page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => `
        <div class="kanji details"></div>
        <div class="kanji-details__main-meanings">
          language, word, saying
        </div>
      `
    })))

    const { fetchJishoKanjiMeanings } = await import('../server/adapters/jisho-kanji')
    await expect(fetchJishoKanjiMeanings('語')).resolves.toEqual([
      'language',
      'word',
      'saying'
    ])
  })

  it('returns empty metadata when sections are missing', () => {
    expect(parseJishoKanjiPage('<html></html>')).toEqual({
      radicalSymbol: null,
      radicalForms: [],
      parts: []
    })
  })
})
