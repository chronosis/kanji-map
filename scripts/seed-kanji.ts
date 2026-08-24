/**
 * Seeds kanji_ref from data/kanji-union.json into SQLite.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ensureSchema } from '../server/utils/ensure-schema'
import { kanjiRef } from '../drizzle/schema'
import type { KanjiUnionEntry } from '../shared/types/kanji'
import { assignGridIndices } from '../shared/utils/kanji-order'

async function main() {
  const unionPath = resolve('data/kanji-union.json')
  const raw = JSON.parse(readFileSync(unionPath, 'utf8')) as Array<KanjiUnionEntry & { gridIndex?: number }>
  const rows = assignGridIndices(raw)

  const { client, db } = await ensureSchema(process.env.DATABASE_PATH || './data/kanji-map.sqlite')

  await client.execute('DELETE FROM kanji_ref')

  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map(row => ({
      character: row.character,
      schoolGrade: row.schoolGrade,
      jlptLevel: row.jlptLevel,
      inJoyoo: row.inJoyoo,
      freqRank: row.freqRank,
      strokes: row.strokes,
      gridIndex: row.gridIndex
    }))
    await db.insert(kanjiRef).values(chunk)
  }

  console.log(`Seeded ${rows.length} kanji into kanji_ref`)
  client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
