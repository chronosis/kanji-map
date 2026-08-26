/**
 * Fetches Jisho kanji metadata (radical + parts) for all union characters.
 * Writes data/kanji-jisho-meta.json — run sparingly (respect Jisho rate limits).
 *
 * Usage: pnpm data:jisho-meta
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { KanjiUnionEntry } from '../shared/types/kanji'
import type { JishoKanjiMeta } from '../server/adapters/jisho-kanji'
import { fetchJishoKanjiMeta } from '../server/adapters/jisho-kanji'

const OUT_PATH = resolve('data/kanji-jisho-meta.json')
const UNION_PATH = resolve('data/kanji-union.json')
const DELAY_MS = 350
const CONCURRENCY = 3

type MetaRecord = Record<string, JishoKanjiMeta>

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

  const existing: MetaRecord = existsSync(OUT_PATH)
    ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) as MetaRecord
    : {}

  const pending = characters.filter(c => !existing[c]?.parts?.length && !existing[c]?.radicalSymbol)
  console.log(`Jisho meta: ${characters.length} total, ${Object.keys(existing).length} cached, ${pending.length} to fetch`)

  let done = 0
  await mapPool(pending, CONCURRENCY, async (character) => {
    const meta = await fetchJishoKanjiMeta(character)
    if (meta) {
      existing[character] = meta
    } else {
      existing[character] = { radicalSymbol: null, radicalForms: [], parts: [] }
    }
    done++
    if (done % 25 === 0 || done === pending.length) {
      writeFileSync(OUT_PATH, `${JSON.stringify(existing, null, 0)}\n`)
      console.log(`  fetched ${done}/${pending.length}`)
    }
    return meta
  })

  writeFileSync(OUT_PATH, `${JSON.stringify(existing, null, 0)}\n`)
  console.log(`Wrote ${OUT_PATH} (${Object.keys(existing).length} entries)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
