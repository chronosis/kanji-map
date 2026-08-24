/**
 * BunPro frontend API client (unofficial).
 *
 * Auth: browser cookie `frontend_api_token` sent as:
 *   Authorization: Token token=<frontend_api_token>
 * (wkbp / community forum). Bearer is tried as a fallback.
 *
 * The cookie value is often a 32-char hex string — the same *shape* as the
 * deprecated settings “API key”, but it is a different credential. Do **not**
 * reject hex tokens. The settings page key does not authorize `/api/frontend`.
 *
 * Spec: https://github.com/cbullard-dev/bunpro-community-api
 * Forum: https://community.bunpro.jp/t/bunpro-api-when/100574
 */
import { extractKanji, normalizeBunproSrs } from '../../shared/utils/merge-progress'

const BP_BASE = 'https://api.bunpro.jp/api/frontend'

export interface BunproKanjiProgress {
  character: string
  srsStageNormalized: number
  accuracyPct: number | null
  touchCount: number
}

/** Non-empty frontend_api_token (hex, JWT, or other opaque string). */
export function isBunproFrontendToken(token: string): boolean {
  return token.trim().length > 0
}

/** @deprecated Prefer isBunproFrontendToken — hex tokens are valid cookie values. */
export function isBunproFrontendJwt(token: string): boolean {
  return isBunproFrontendToken(token)
}

function authHeaders(token: string, style: 'token' | 'bearer'): HeadersInit {
  const t = token.trim()
  return {
    Authorization: style === 'token' ? `Token token=${t}` : `Bearer ${t}`,
    Accept: 'application/json'
  }
}

async function bpFetchOnce<T>(
  path: string,
  token: string,
  style: 'token' | 'bearer'
): Promise<{ ok: true, data: T } | { ok: false, status: number }> {
  const res = await fetch(`${BP_BASE}${path}`, {
    headers: authHeaders(token, style)
  })
  if (!res.ok) return { ok: false, status: res.status }
  return { ok: true, data: await res.json() as T }
}

let preferredAuthStyle: 'token' | 'bearer' | null = null

/**
 * Call a frontend path. Prefer `Token token=` (current BunPro web client style);
 * fall back to Bearer if Token gets 401/403. Remembers which style worked.
 */
async function bpFetch<T>(path: string, token: string): Promise<T | null> {
  const styles: Array<'token' | 'bearer'> = preferredAuthStyle === 'bearer'
    ? ['bearer', 'token']
    : ['token', 'bearer']

  let lastStatus = 0
  for (const style of styles) {
    const result = await bpFetchOnce<T>(path, token, style)
    if (result.ok) {
      preferredAuthStyle = style
      return result.data
    }
    lastStatus = result.status
    if (result.status !== 401 && result.status !== 403) break
  }

  if (lastStatus === 401 || lastStatus === 403) {
    throw createError({
      statusCode: lastStatus,
      message:
        'BunPro frontend_api_token rejected — copy a fresh value from the '
        + 'bunpro.jp cookie named frontend_api_token (DevTools → Application → Cookies)'
    })
  }

  // Some frontend routes still 500 even with a valid token (unstable undocumented API).
  console.warn(`BunPro ${path} → ${lastStatus}`)
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  }
  return null
}

function collectStrings(node: unknown, out: string[], depth = 0): void {
  if (depth > 6 || node == null) return
  if (typeof node === 'string') {
    out.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out, depth + 1)
    return
  }
  const obj = asRecord(node)
  if (!obj) return
  for (const [key, value] of Object.entries(obj)) {
    if (/title|japanese|expression|kanji|vocab|spelling|primary|text|sentence|example/i.test(key)) {
      collectStrings(value, out, depth + 1)
    } else if (typeof value === 'object') {
      collectStrings(value, out, depth + 1)
    }
  }
}

function unwrapItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  const rec = asRecord(payload)
  if (!rec) return []
  for (const key of ['data', 'reviews', 'queue', 'items', 'results']) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[]
  }
  const nested = asRecord(rec.data)
  if (nested && Array.isArray(nested.data)) return nested.data as unknown[]
  return [payload]
}

interface Acc {
  srsSum: number
  srsCount: number
  correct: number
  incorrect: number
  touches: number
}

function bump(map: Map<string, Acc>, character: string, srs: number | null, correct: number, incorrect: number) {
  const cur = map.get(character) ?? { srsSum: 0, srsCount: 0, correct: 0, incorrect: 0, touches: 0 }
  if (srs != null) {
    cur.srsSum += srs
    cur.srsCount += 1
  }
  cur.correct += correct
  cur.incorrect += incorrect
  cur.touches += 1
  map.set(character, cur)
}

function ingestItems(map: Map<string, Acc>, items: unknown[]) {
  for (const item of items) {
    const rec = asRecord(item)
    if (!rec) continue
    const texts: string[] = []
    collectStrings(item, texts)
    const kanji = extractKanji(texts.join(''))
    if (!kanji.length) continue

    const srsRaw = readNumber(
      rec.srs,
      rec.srs_stage,
      rec.stage,
      rec.streak,
      asRecord(rec.attributes)?.srs,
      asRecord(rec.attributes)?.srs_stage,
      asRecord(rec.review)?.srs,
      asRecord(rec.review)?.stage
    )
    const normalized = srsRaw != null ? normalizeBunproSrs(srsRaw) : null
    const correct = readNumber(rec.times_correct, rec.correct, rec.correct_count) ?? 0
    const incorrect = readNumber(rec.times_incorrect, rec.incorrect, rec.incorrect_count, rec.fail_count) ?? 0

    for (const ch of kanji) {
      bump(map, ch, normalized, correct, incorrect)
    }
  }
}

async function fetchAllReviewPages(token: string): Promise<unknown[]> {
  const all: unknown[] = []
  for (let page = 1; page <= 50; page++) {
    const payload = await bpFetch<unknown>(`/reviews?page=${page}&per_page=100`, token)
    if (!payload) break
    const items = unwrapItems(payload)
    if (!items.length) break
    all.push(...items)
    if (items.length < 100) break
  }
  return all
}

export async function fetchBunproKanjiProgress(token: string): Promise<BunproKanjiProgress[]> {
  if (!isBunproFrontendToken(token)) return []

  const map = new Map<string, Acc>()

  const [user, queue, due, reviewItems, lastSession, last24h] = await Promise.all([
    bpFetch<unknown>('/user', token),
    bpFetch<unknown>('/user/queue', token),
    bpFetch<unknown>('/user/due', token),
    fetchAllReviewPages(token),
    bpFetch<unknown>('/review_histories/last_session', token),
    bpFetch<unknown>('/review_histories/last_24_hours', token)
  ])

  void user
  ingestItems(map, unwrapItems(queue))
  ingestItems(map, unwrapItems(due))
  ingestItems(map, reviewItems)
  ingestItems(map, unwrapItems(lastSession))
  ingestItems(map, unwrapItems(last24h))

  const results: BunproKanjiProgress[] = []
  for (const [character, acc] of map) {
    const srsStageNormalized = acc.srsCount > 0 ? acc.srsSum / acc.srsCount : 5
    const total = acc.correct + acc.incorrect
    const accuracyPct = total > 0 ? (acc.correct / total) * 100 : null
    results.push({
      character,
      srsStageNormalized,
      accuracyPct,
      touchCount: acc.touches
    })
  }

  return results
}
