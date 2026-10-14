import { describe, expect, it } from 'vitest'
import { primaryKanjiMeaning } from '../shared/utils/kanji-meaning'

describe('primary kanji meaning', () => {
  it('uses the WaniKani primary gloss and skips accepted alternates', () => {
    expect(primaryKanjiMeaning({
      wk_meanings: ['Sun', '^Day'],
      meanings: ['Day', 'Sun', 'Japan']
    })).toBe('Sun')
  })

  it('falls back to the first Kanjidic gloss', () => {
    expect(primaryKanjiMeaning({
      meanings: ['In Ancient Times_ Article For Preparing The Body']
    })).toBe('In Ancient Times')
  })

  it('returns null when no gloss is stored', () => {
    expect(primaryKanjiMeaning(null)).toBeNull()
    expect(primaryKanjiMeaning({ wk_meanings: ['^Only Alternate'] })).toBeNull()
  })
})
