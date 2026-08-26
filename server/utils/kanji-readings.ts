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
  /** Kanjidic on/kun readings (source A for stem counting). */
  kanjidicReadings: string[]
  /** WK on/kun readings embedded in the joyo dump (source B). */
  wkDumpReadings: string[]
  /**
   * All on/kun raws from both dump sources (search / legacy merge helpers).
   * Prefer {@link kanjidicReadings} + {@link wkDumpReadings} for counting.
   */
  rawReadings: string[]
}

function kanjidicReadingsFromEntry(info: KanjidicEntry): string[] {
  return [
    ...(info.readings_on ?? []),
    ...(info.readings_kun ?? [])
  ]
}

function wkDumpReadingsFromEntry(info: KanjidicEntry): string[] {
  return [
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
    const kanjidicReadings = kanjidicReadingsFromEntry(info)
    const wkDumpReadings = wkDumpReadingsFromEntry(info)
    const rawReadings = [...kanjidicReadings, ...wkDumpReadings]
    const searchReadings = normalizeReadingsList(rawReadings)
    // One Set across Kanjidic + embedded WK dump — never sum per-source sizes.
    const readingCount = countDistinctReadingStems(kanjidicReadings, wkDumpReadings)
    if (searchReadings.length || readingCount > 0) {
      map.set(character, {
        searchReadings,
        readingCount,
        kanjidicReadings,
        wkDumpReadings,
        rawReadings
      })
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
