import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { primaryKanjiMeaning, type KanjiMeaningSource } from '../../shared/utils/kanji-meaning'

let cached: Map<string, string> | null = null

/** Primary meaning for each character in `data/raw/joyo.json`. */
export function loadKanjiMeanings(
  joyoPath = resolve('data/raw/joyo.json')
): Map<string, string> {
  if (cached && joyoPath === resolve('data/raw/joyo.json')) return cached
  const meanings = new Map<string, string>()
  if (!existsSync(joyoPath)) return meanings
  const source = JSON.parse(readFileSync(joyoPath, 'utf8')) as Record<string, KanjiMeaningSource>
  for (const [character, info] of Object.entries(source)) {
    const meaning = primaryKanjiMeaning(info)
    if (meaning) meanings.set(character, meaning)
  }
  if (joyoPath === resolve('data/raw/joyo.json')) cached = meanings
  return meanings
}
