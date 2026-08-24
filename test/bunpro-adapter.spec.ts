import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('bunpro adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('createError', (input: { statusCode: number, message: string }) => {
      const err = new Error(input.message) as Error & { statusCode: number }
      err.statusCode = input.statusCode
      return err
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns empty without token', async () => {
    const { fetchBunproKanjiProgress } = await import('../server/adapters/bunpro')
    expect(await fetchBunproKanjiProgress('')).toEqual([])
  })

  it('accepts 32-char hex frontend_api_token cookie values', async () => {
    const { isBunproFrontendToken, isBunproFrontendJwt } = await import('../server/adapters/bunpro')
    const hex = 'a65f896457d61dafc8d5a5792349faa5'
    expect(isBunproFrontendToken(hex)).toBe(true)
    expect(isBunproFrontendJwt(hex)).toBe(true)
  })

  it('uses Token token= auth and extracts kanji from reviews', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      const auth = init?.headers?.Authorization ?? ''
      expect(auth.startsWith('Token token=') || auth.startsWith('Bearer ')).toBe(true)
      if (url.includes('/reviews?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ([
            {
              srs_stage: 11,
              reviewable_type: 'Vocab',
              reviewable: { japanese: '日本語', type: 'Vocab' }
            }
          ])
        }
      }
      return { ok: true, status: 200, json: async () => ([]) }
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchBunproKanjiProgress } = await import('../server/adapters/bunpro')
    const hexToken = 'a65f896457d61dafc8d5a5792349faa5'
    const rows = await fetchBunproKanjiProgress(hexToken)
    const chars = rows.map(r => r.character).sort().join('')
    expect(chars).toContain('日')
    expect(chars).toContain('本')
    expect(chars).toContain('語')
    expect(rows[0].srsStageNormalized).toBe(9)

    const firstAuth = fetchMock.mock.calls[0]?.[1]?.headers?.Authorization
    expect(firstAuth).toBe(`Token token=${hexToken}`)
  })

  it('falls back to Bearer when Token token= returns 401', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: { headers?: Record<string, string> }) => {
      const auth = init?.headers?.Authorization ?? ''
      if (auth.startsWith('Token token=')) {
        return { ok: false, status: 401, json: async () => ({}) }
      }
      return { ok: true, status: 200, json: async () => ([]) }
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchBunproKanjiProgress } = await import('../server/adapters/bunpro')
    await fetchBunproKanjiProgress('a65f896457d61dafc8d5a5792349faa5')
    const auths = fetchMock.mock.calls.map(c => c[1]?.headers?.Authorization)
    expect(auths.some(a => a?.startsWith('Token token='))).toBe(true)
    expect(auths.some(a => a?.startsWith('Bearer '))).toBe(true)
  })
})
