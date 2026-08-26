/**
 * Fetch nanori (name readings) from kanjiapi.dev for all union characters.
 * Writes data/kanji-nanori.json — rate-limited; resumes from cache.
 *
 * Usage: pnpm data:kanjiapi-nanori
 *
 * Attribution: KANJIDIC via kanjiapi.dev / EDRDG — see NOTICE.md.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { KanjiUnionEntry } from '../shared/types/kanji'
import { fetchKanjiapiKanji, normalizeKanjiapiNanori } from '../server/adapters/kanjiapi'

const OUT_PATH = resolve('data/kanji-nanori.json')
const UNION_PATH = resolve('data/kanji-union.json')
const DELAY_MS = 120
const CONCURRENCY = 6

type NanoriRecord = Record<string, string[]>

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const i = nextIndex++
      if (i >= items.length) break
      results[i] = await fn(items[i]!, i)
      await sleep(DELAY_MS)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}

async function main() {
  const union = JSON.parse(readFileSync(UNION_PATH, 'utf8')) as KanjiUnionEntry[]
  const characters = union.map(e => e.character)

  const existing: NanoriRecord = existsSync(OUT_PATH)
    ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) as NanoriRecord
    : {}

  const pending = characters.filter(c => existing[c] == null)
  console.log(
    `kanjiapi nanori: ${characters.length} total, ${Object.keys(existing).length} cached, ${pending.length} to fetch`
  )

  let done = 0
  await mapPool(pending, CONCURRENCY, async (character) => {
    const data = await fetchKanjiapiKanji(character)
    existing[character] = data ? normalizeKanjiapiNanori(data.name_readings) : []
    done++
    if (done % 50 === 0 || done === pending.length) {
      writeFileSync(OUT_PATH, `${JSON.stringify(existing, null, 0)}\n`)
      console.log(`  fetched ${done}/${pending.length}`)
    }
    return existing[character]
  })

  writeFileSync(OUT_PATH, `${JSON.stringify(existing, null, 0)}\n`)
  const withNanori = Object.values(existing).filter(list => list.length > 0).length
  console.log(`Wrote ${OUT_PATH} (${Object.keys(existing).length} entries, ${withNanori} with nanori)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
