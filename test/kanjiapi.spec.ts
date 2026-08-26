import { describe, expect, it, vi } from 'vitest'
import { normalizeKanjiapiNanori } from '../server/adapters/kanjiapi'

describe('kanjiapi adapter', () => {
  it('normalizes nanori to hiragana and dedupes', () => {
    expect(normalizeKanjiapiNanori(['アサ', 'あさ', 'いき', ''])).toEqual(['あさ', 'いき'])
  })

  it('fetches nanori for 生 from kanjiapi.dev', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        kanji: '生',
        name_readings: ['あさ', 'いき', 'いく'],
        on_readings: ['セイ'],
        kun_readings: ['い.きる'],
        meanings: ['life']
      })
    })))

    const { fetchKanjiapiNanori } = await import('../server/adapters/kanjiapi')
    await expect(fetchKanjiapiNanori('生')).resolves.toEqual(['あさ', 'いき', 'いく'])
    vi.unstubAllGlobals()
  })
})
