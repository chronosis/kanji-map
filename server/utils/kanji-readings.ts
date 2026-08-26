/**
 * Load on/kun readings from the local Kanjidic-derived joyo dump.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { countDistinctReadingStems, normalizeReadingsList } from '../../shared/utils/readings'

interface KanjidicEntry {
  readings_on?: string[]
  readings_kun?: string[]
  wk_readings_on?: string[]
  wk_readings_kun?: string[]
}

export interface KanjidicReadingIndex {
  /** Expanded hiragana forms used for kana search. */
  searchReadings: string[]
  /** Distinct on/kun reading stems (okurigana collapsed; nanori excluded). */
  readingCount: number
  /** Raw on/kun readings used for stem counting (no nanori). */
  rawReadings: string[]
}

function rawReadingsFromEntry(info: KanjidicEntry): string[] {
  return [
    ...(info.readings_on ?? []),
    ...(info.readings_kun ?? []),
    ...(info.wk_readings_on ?? []),
    ...(info.wk_readings_kun ?? [])
  ]
}

export function loadKanjidicReadingIndex(
  joyoPath = resolve('data/raw/joyo.json')
): Map<string, KanjidicReadingIndex> {
  const map = new Map<string, KanjidicReadingIndex>()
  if (!existsSync(joyoPath)) return map

  const source = JSON.parse(readFileSync(joyoPath, 'utf8')) as Record<string, KanjidicEntry>
  for (const [character, info] of Object.entries(source)) {
    const rawReadings = rawReadingsFromEntry(info)
    const searchReadings = normalizeReadingsList(rawReadings)
    const readingCount = countDistinctReadingStems(rawReadings)
    if (searchReadings.length || readingCount > 0) {
      map.set(character, { searchReadings, readingCount, rawReadings })
    }
  }
  return map
}

/** Searchable reading forms only (legacy helper). */
export function loadKanjidicReadingsMap(
  joyoPath = resolve('data/raw/joyo.json')
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const [character, info] of loadKanjidicReadingIndex(joyoPath)) {
    map.set(character, info.searchReadings)
  }
  return map
}
