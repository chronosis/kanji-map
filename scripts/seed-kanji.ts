/**
 * Seeds kanji_ref from data/kanji-union.json into SQLite.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ensureSchema } from '../server/utils/ensure-schema'
import { loadKanjidicReadingIndex } from '../server/utils/kanji-readings'
import { kanjiRef } from '../drizzle/schema'
import type { KanjiUnionEntry } from '../shared/types/kanji'
import type { JishoKanjiMeta } from '../server/adapters/jisho-kanji'
import { assignGridIndices } from '../shared/utils/kanji-order'
import { stringifyJsonStringArray } from '../shared/utils/json-arrays'
import { normalizeReadingsList } from '../shared/utils/readings'

const META_PATH = resolve('data/kanji-jisho-meta.json')
const NANORI_PATH = resolve('data/kanji-nanori.json')

function loadJishoMeta(): Record<string, JishoKanjiMeta> {
  if (!existsSync(META_PATH)) return {}
  return JSON.parse(readFileSync(META_PATH, 'utf8')) as Record<string, JishoKanjiMeta>
}

function loadNanori(): Record<string, string[]> {
  if (!existsSync(NANORI_PATH)) return {}
  return JSON.parse(readFileSync(NANORI_PATH, 'utf8')) as Record<string, string[]>
}

async function main() {
  const unionPath = resolve('data/kanji-union.json')
  const raw = JSON.parse(readFileSync(unionPath, 'utf8')) as Array<KanjiUnionEntry & { gridIndex?: number }>
  const rows = assignGridIndices(raw)
  const jishoMeta = loadJishoMeta()
  const nanoriByChar = loadNanori()
  const kanjidic = loadKanjidicReadingIndex()

  const { client, db } = await ensureSchema(process.env.DATABASE_PATH || './data/kanji-map.sqlite')

  await client.execute('DELETE FROM kanji_ref')

  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) => {
      const meta = jishoMeta[row.character]
      const readings = kanjidic.get(row.character)
      const nanori = nanoriByChar[row.character] ?? []
      const searchReadings = normalizeReadingsList([
        ...(readings?.searchReadings ?? []),
        ...nanori
      ])
      return {
        character: row.character,
        schoolGrade: row.schoolGrade,
        jlptLevel: row.jlptLevel,
        inJoyoo: row.inJoyoo,
        freqRank: row.freqRank,
        strokes: row.strokes,
        gridIndex: row.gridIndex,
        radicalSymbol: meta?.radicalSymbol ?? null,
        radicalFormsJson: stringifyJsonStringArray(meta?.radicalForms ?? []),
        partsJson: stringifyJsonStringArray(meta?.parts ?? []),
        readingsJson: stringifyJsonStringArray(searchReadings),
        readingCount: readings?.readingCount ?? 0,
        nanoriJson: stringifyJsonStringArray(nanori)
      }
    })
    await db.insert(kanjiRef).values(chunk)
  }

  const withMeta = rows.filter(r => jishoMeta[r.character]?.parts?.length || jishoMeta[r.character]?.radicalSymbol).length
  const withReadings = rows.filter(r => (kanjidic.get(r.character)?.readingCount ?? 0) > 0).length
  const withNanori = rows.filter(r => (nanoriByChar[r.character]?.length ?? 0) > 0).length
  console.log(
    `Seeded ${rows.length} kanji into kanji_ref `
    + `(${withMeta} with Jisho radical/parts, ${withReadings} with readings, ${withNanori} with nanori)`
  )
  client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
