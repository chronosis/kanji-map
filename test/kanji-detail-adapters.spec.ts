import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.stubGlobal('createError', (input: { statusCode: number, statusMessage?: string, message?: string }) => {
  const err = new Error(input.statusMessage || input.message || 'error') as Error & { statusCode: number }
  err.statusCode = input.statusCode
  return err
})

describe('jisho adapter', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps word search hits that contain the kanji', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            slug: 'nihongo',
            japanese: [{ word: '日本語', reading: 'にほんご' }],
            senses: [{ english_definitions: ['Japanese language'] }]
          },
          {
            slug: 'ignore',
            japanese: [{ word: '猫', reading: 'ねこ' }],
            senses: [{ english_definitions: ['cat'] }]
          }
        ]
      })
    })))

    const { fetchJishoWordsForKanji } = await import('../server/adapters/jisho')
    const words = await fetchJishoWordsForKanji('語', 8)
    expect(words).toHaveLength(1)
    expect(words[0]).toMatchObject({
      characters: '日本語',
      reading: 'にほんご',
      source: 'jisho',
      meanings: ['Japanese language']
    })
  })
})

describe('wanikani kanji subject detail', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses kanji subject by slug and related ids', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/subjects?types=kanji&slugs=')) {
        return {
          ok: true,
          json: async () => ({
            pages: { next_url: null },
            data: [{
              id: 440,
              object: 'kanji',
              data: {
                characters: '一',
                level: 1,
                document_url: 'https://www.wanikani.com/kanji/一',
                meanings: [{ meaning: 'One', primary: true }],
                readings: [
                  { reading: 'いち', type: 'onyomi', primary: true },
                  { reading: 'ひと', type: 'kunyomi', primary: false }
                ],
                meaning_mnemonic: 'Look at the ground.',
                reading_mnemonic: 'Ichi sheep.',
                component_subject_ids: [1],
                amalgamation_subject_ids: [56],
                visually_similar_subject_ids: []
              }
            }]
          })
        }
      }
      if (u.includes('/subjects?ids=')) {
        return {
          ok: true,
          json: async () => ({
            pages: { next_url: null },
            data: [
              {
                id: 1,
                object: 'radical',
                data: {
                  characters: '一',
                  level: 1,
                  meanings: [{ meaning: 'Ground', primary: true }],
                  readings: []
                }
              },
              {
                id: 56,
                object: 'vocabulary',
                data: {
                  characters: '一つ',
                  level: 1,
                  meanings: [{ meaning: 'One Thing', primary: true }],
                  readings: [{ reading: 'ひとつ', primary: true }]
                }
              }
            ]
          })
        }
      }
      return { ok: false, status: 404, statusText: 'missing' }
    })
    vi.stubGlobal('fetch', fetchMock)

    const {
      fetchWanikaniKanjiSubject,
      fetchWanikaniSubjectsByIds
    } = await import('../server/adapters/wanikani')

    const subject = await fetchWanikaniKanjiSubject('key', { character: '一' })
    expect(subject?.meanings[0]?.meaning).toBe('One')
    expect(subject?.readings[0]).toMatchObject({ reading: 'いち', type: 'onyomi' })

    const related = await fetchWanikaniSubjectsByIds('key', [1, 56])
    expect(related.map(r => r.object)).toEqual(['radical', 'vocabulary'])
    expect(related.find(r => r.subjectId === 56)?.readings[0]).toBe('ひとつ')
  })
})
