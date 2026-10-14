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
      if (u.includes('/user')) {
        return { ok: true, json: async () => ({ data: { level: 60 } }) }
      }
      if (u.includes('/subjects')) {
        return {
          ok: true,
          json: async () => ({
            pages: { next_url: null },
            data: [
              { id: 1, data: { characters: '日', level: 1, readings: [{ reading: 'にち', type: 'onyomi' }] } },
              { id: 2, data: { characters: '月', level: 2, readings: [{ reading: 'げつ', type: 'onyomi' }] } }
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
    const rows = (await fetchWanikaniKanjiProgress('fake-key')).rows
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
      readingIncorrect: 1,
      readings: ['にち'],
      onKunReadings: ['にち']
    })
    expect(rows.find(r => r.character === '月')).toMatchObject({
      character: '月',
      subjectId: 2,
      level: 2,
      apiOrder: 1,
      srsStage: 0,
      accuracyPct: null,
      readings: ['げつ'],
      onKunReadings: ['げつ']
    })
  })

  it('excludes nanori from onKunReadings but keeps them in readings', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/user')) {
        return { ok: true, json: async () => ({ data: { level: 60 } }) }
      }
      if (u.includes('/subjects')) {
        return {
          ok: true,
          json: async () => ({
            pages: { next_url: null },
            data: [{
              id: 1,
              data: {
                characters: '生',
                level: 3,
                readings: [
                  { reading: 'せい', type: 'onyomi' },
                  { reading: 'い', type: 'kunyomi' },
                  { reading: 'あさ', type: 'nanori' }
                ]
              }
            }]
          })
        }
      }
      if (u.includes('/assignments') || u.includes('/review_statistics')) {
        return { ok: true, json: async () => ({ pages: { next_url: null }, data: [] }) }
      }
      return { ok: false, status: 404, statusText: 'nope' }
    }))

    const { fetchWanikaniKanjiProgress } = await import('../server/adapters/wanikani')
    const rows = (await fetchWanikaniKanjiProgress('fake-key')).rows
    expect(rows[0]).toMatchObject({
      character: '生',
      readings: ['せい', 'い', 'あさ'],
      onKunReadings: ['せい', 'い']
    })
  })

  it('returns an empty result without API key', async () => {
    const { fetchWanikaniKanjiProgress } = await import('../server/adapters/wanikani')
    expect(await fetchWanikaniKanjiProgress('')).toEqual({
      userLevel: 0,
      subjectsThroughLevel: 0,
      rows: []
    })
  })

  it('polls only due kanji once SRS dates are stored', async () => {
    const urls: string[] = []
    const now = Date.parse('2026-06-01T00:00:00.000Z')
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url)
      urls.push(u)
      if (u.includes('/user')) {
        return { ok: true, json: async () => ({ data: { level: 5 } }) }
      }
      if (u.includes('updated_after=')) {
        return { ok: true, json: async () => ({ pages: { next_url: null }, total_count: 0, data: [] }) }
      }
      if (u.includes('/assignments') && u.includes('subject_ids=4')) {
        return {
          ok: true,
          json: async () => ({
            pages: { next_url: null },
            total_count: 1,
            data: [{
              id: 40,
              data_updated_at: '2026-05-31T00:00:00.000Z',
              data: {
                subject_id: 4,
                srs_stage: 6,
                subject_type: 'kanji',
                available_at: '2026-06-10T00:00:00.000Z'
              }
            }]
          })
        }
      }
      if (u.includes('/review_statistics') && u.includes('subject_ids=4')) {
        return { ok: true, json: async () => ({ pages: { next_url: null }, total_count: 1, data: [] }) }
      }
      return { ok: false, status: 404, statusText: 'nope' }
    }))

    const { fetchWanikaniKanjiProgress } = await import('../server/adapters/wanikani')
    const result = await fetchWanikaniKanjiProgress('fake-key', {
      now,
      subjectsThroughLevel: 5,
      snapshots: [
        {
          character: '日',
          subjectId: 1,
          wkLevel: 1,
          srsStage: 5,
          availableAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z'
        },
        {
          character: '月',
          subjectId: 2,
          wkLevel: 2,
          srsStage: 9,
          availableAt: null,
          updatedAt: '2026-01-01T00:00:00.000Z'
        },
        {
          character: '火',
          subjectId: 4,
          wkLevel: 3,
          srsStage: 4,
          availableAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z'
        }
      ]
    })

    expect(result.userLevel).toBe(5)
    expect(result.subjectsThroughLevel).toBe(5)
    expect(result.rows.map(row => row.character)).toEqual(['火'])
    expect(result.rows[0]).toMatchObject({ srsStage: 6, hasSubject: false, availableAt: '2026-06-10T00:00:00.000Z' })
    expect(urls.some(url => url.includes('/subjects?types=kanji'))).toBe(false)
    expect(urls.some(url => url.includes('subject_ids=1'))).toBe(false)
    expect(urls.some(url => url.includes('subject_ids=2'))).toBe(false)
    expect(urls.some(url => url.includes('subject_ids=4'))).toBe(true)
    expect(urls.some(url => url.includes('levels=1,2,3,4,5') && url.includes('updated_after='))).toBe(true)
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
