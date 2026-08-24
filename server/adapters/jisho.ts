/**
 * Jisho.org word search (unofficial but widely used JSON endpoint).
 * Kanji sheet metadata is not available via this API — use the #kanji page URL.
 * Docs thread: https://jisho.org/forum/54fefc1f6e73340b1f160000-is-there-any-kind-of-search-api
 */
import type { KanjiDetailVocabExample } from '../../shared/types/kanji-detail'
import { jishoKanjiUrl } from '../../shared/utils/kanji'

const JISHO_WORDS = 'https://jisho.org/api/v1/search/words'

interface JishoWordHit {
  slug?: string
  japanese?: Array<{ word?: string, reading?: string }>
  senses?: Array<{ english_definitions?: string[] }>
  is_common?: boolean
}

interface JishoWordsResponse {
  data?: JishoWordHit[]
}

export function jishoWordUrl(slugOrQuery: string): string {
  return `https://jisho.org/word/${encodeURIComponent(slugOrQuery)}`
}

/** Words that contain the given kanji (best-effort dictionary examples). */
export async function fetchJishoWordsForKanji(
  character: string,
  limit = 8
): Promise<KanjiDetailVocabExample[]> {
  if (!character) return []

  const url = `${JISHO_WORDS}?keyword=${encodeURIComponent(character)}`
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' }
    })
  } catch {
    return []
  }
  if (!res.ok) return []

  const body = await res.json() as JishoWordsResponse
  const hits = body.data ?? []
  const out: KanjiDetailVocabExample[] = []

  for (const hit of hits) {
    if (out.length >= limit) break
    const jp = hit.japanese?.[0]
    const characters = jp?.word ?? jp?.reading
    if (!characters || !characters.includes(character)) continue

    const meanings = (hit.senses ?? [])
      .flatMap(s => s.english_definitions ?? [])
      .filter(Boolean)
      .slice(0, 4)

    out.push({
      characters,
      reading: jp?.reading ?? null,
      meanings,
      source: 'jisho',
      url: hit.slug ? jishoWordUrl(hit.slug) : jishoKanjiUrl(character)
    })
  }

  return out
}
