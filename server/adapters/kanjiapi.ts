/**
 * kanjiapi.dev client (Kanjidic-derived JSON).
 * Docs / data: https://kanjiapi.dev/
 * Licence: EDRDG KANJIDIC (see NOTICE.md).
 */
import { z } from 'zod'
import { toHiragana } from '../../shared/utils/readings'

const KanjiapiKanjiSchema = z.object({
  kanji: z.string(),
  name_readings: z.array(z.string()).default([]),
  on_readings: z.array(z.string()).default([]),
  kun_readings: z.array(z.string()).default([]),
  meanings: z.array(z.string()).default([])
})

export type KanjiapiKanji = z.infer<typeof KanjiapiKanjiSchema>

const BASE = 'https://kanjiapi.dev/v1'

/** Normalize kanjiapi name readings to hiragana for storage / display. */
export function normalizeKanjiapiNanori(raws: readonly string[]): string[] {
  const out = new Set<string>()
  for (const raw of raws) {
    const hira = toHiragana(raw.trim())
    if (hira) out.add(hira)
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'ja'))
}

export async function fetchKanjiapiKanji(character: string): Promise<KanjiapiKanji | null> {
  if (!character) return null
  const url = `${BASE}/kanji/${encodeURIComponent(character)}`
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) return null
    const parsed = KanjiapiKanjiSchema.safeParse(await res.json())
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function fetchKanjiapiNanori(character: string): Promise<string[]> {
  const data = await fetchKanjiapiKanji(character)
  if (!data) return []
  return normalizeKanjiapiNanori(data.name_readings)
}
