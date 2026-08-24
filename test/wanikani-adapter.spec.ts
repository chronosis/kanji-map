import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => {
  const err = new Error(input.statusMessage) as Error & { statusCode: number }
  err.statusCode = input.statusCode
  return err
})

describe('wanikani adapter parsing', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('maps subjects, assignments, and review statistics', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/subjects')) {
        return {
          ok: true,
          json: async () => ({
            pages: { next_url: null },
            data: [
              { id: 1, data: { characters: '日', level: 1 } },
              { id: 2, data: { characters: '月', level: 2 } }
            ]
          })
        }
      }
      if (u.includes('/assignments')) {
        return {
          ok: true,
          json: async () => ({
            pages: { next_url: null },
            data: [{ id: 10, data: { subject_id: 1, srs_stage: 5, subject_type: 'kanji' } }]
          })
        }
      }
      if (u.includes('/review_statistics')) {
        return {
          ok: true,
          json: async () => ({
            pages: { next_url: null },
            data: [{
              id: 20,
              data: {
                subject_id: 1,
                meaning_correct: 8,
                meaning_incorrect: 2,
                reading_correct: 9,
                reading_incorrect: 1,
                percentage_correct: 85
              }
            }]
          })
        }
      }
      return { ok: false, status: 404, statusText: 'nope' }
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchWanikaniKanjiProgress } = await import('../server/adapters/wanikani')
    const rows = await fetchWanikaniKanjiProgress('fake-key')
    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.character === '日')).toMatchObject({
      character: '日',
      subjectId: 1,
      level: 1,
      apiOrder: 0,
      srsStage: 5,
      accuracyPct: 85,
      meaningCorrect: 8,
      meaningIncorrect: 2,
      readingCorrect: 9,
      readingIncorrect: 1
    })
    expect(rows.find(r => r.character === '月')).toMatchObject({
      character: '月',
      subjectId: 2,
      level: 2,
      apiOrder: 1,
      srsStage: 0,
      accuracyPct: null
    })
  })

  it('returns empty array without API key', async () => {
    const { fetchWanikaniKanjiProgress } = await import('../server/adapters/wanikani')
    expect(await fetchWanikaniKanjiProgress('')).toEqual([])
  })

  it('fetches review stats for one subject id', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(String(url)).toContain('/review_statistics?subject_ids=468')
      return {
        ok: true,
        json: async () => ({
          pages: { next_url: null },
          data: [{
            id: 20,
            data: {
              subject_id: 468,
              meaning_correct: 23,
              meaning_incorrect: 2,
              reading_correct: 11,
              reading_incorrect: 1,
              percentage_correct: 92
            }
          }]
        })
      }
    }))

    const { fetchWanikaniReviewStatsForSubject } = await import('../server/adapters/wanikani')
    await expect(fetchWanikaniReviewStatsForSubject('fake-key', 468)).resolves.toEqual({
      meaningCorrect: 23,
      meaningIncorrect: 2,
      readingCorrect: 11,
      readingIncorrect: 1,
      accuracyPct: 92
    })
  })
})
