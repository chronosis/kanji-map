import { eq } from 'drizzle-orm'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  kanjiRef,
  progressBunpro,
  progressMerged,
  progressWanikani
} from '../../drizzle/schema'
import { SOURCE_BUNPRO, SOURCE_WANIKANI } from '../../shared/types/kanji'
import type { JishoKanjiMeta } from '../adapters/jisho-kanji'
import type { JlptLevel, KanjiUnionEntry, MapCell, SchoolGrade } from '../../shared/types/kanji'
import { assignGridIndices, compareByJoyoAppearance } from '../../shared/utils/kanji-order'
import { parseJsonStringArray, stringifyJsonStringArray } from '../../shared/utils/json-arrays'
import { countDistinctRawReadings, normalizeReadingsList } from '../../shared/utils/readings'
import { mergeProgress } from '../../shared/utils/merge-progress'
import { fetchBunproKanjiProgress } from '../adapters/bunpro'
import { fetchWanikaniKanjiProgress } from '../adapters/wanikani'
import { getDb } from './db'
import { ensureSchema } from './ensure-schema'
import { loadKanjidicReadingIndex } from './kanji-readings'

function loadJishoMeta(): Record<string, JishoKanjiMeta> {
  const metaPath = resolve('data/kanji-jisho-meta.json')
  if (!existsSync(metaPath)) return {}
  return JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, JishoKanjiMeta>
}

/** Backfill searchable readings + counts from Kanjidic when missing. */
async function ensureKanjiReadings(db: ReturnType<typeof getDb>) {
  const probe = await db.select({
    readingsJson: kanjiRef.readingsJson,
    readingCount: kanjiRef.readingCount
  }).from(kanjiRef).where(eq(kanjiRef.character, '語')).limit(1)

  const existingProbe = parseJsonStringArray(probe[0]?.readingsJson)
  const hasSearchReadings = existingProbe.includes('ご')
    || existingProbe.includes('かたる')
    || existingProbe.includes('かた')
  const hasCount = (probe[0]?.readingCount ?? 0) > 0
  if (hasSearchReadings && hasCount) return

  const kanjidic = loadKanjidicReadingIndex()
  if (kanjidic.size === 0) return

  const refs = await db.select({
    character: kanjiRef.character,
    readingsJson: kanjiRef.readingsJson
  }).from(kanjiRef)

  await db.transaction(async (tx) => {
    for (const ref of refs) {
      const index = kanjidic.get(ref.character)
      const mergedSearch = normalizeReadingsList([
        ...parseJsonStringArray(ref.readingsJson),
        ...(index?.searchReadings ?? [])
      ])
      await tx.update(kanjiRef).set({
        readingsJson: stringifyJsonStringArray(mergedSearch),
        readingCount: index?.readingCount ?? 0
      }).where(eq(kanjiRef.character, ref.character))
    }
  })
}

export async function ensureSeeded(databasePath: string) {
  await ensureSchema(databasePath)
  const db = getDb()
  const existing = await db.select({ c: kanjiRef.character }).from(kanjiRef).limit(1)
  if (existing.length > 0) {
    await ensureKanjiReadings(db)
    return
  }

  const raw = JSON.parse(readFileSync(resolve('data/kanji-union.json'), 'utf8')) as KanjiUnionEntry[]
  const rows = assignGridIndices(raw)
  const jishoMeta = loadJishoMeta()
  const kanjidic = loadKanjidicReadingIndex()
  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) => {
      const meta = jishoMeta[row.character]
      const readings = kanjidic.get(row.character)
      return {
        character: row.character,
        schoolGrade: row.schoolGrade,
        jlptLevel: row.jlptLevel,
        inJoyoo: row.inJoyoo,
        freqRank: row.freqRank ?? null,
        strokes: row.strokes ?? null,
        gridIndex: row.gridIndex,
        inWanikani: false,
        wkLevel: null,
        wkApiOrder: null,
        radicalSymbol: meta?.radicalSymbol ?? null,
        radicalFormsJson: stringifyJsonStringArray(meta?.radicalForms ?? []),
        partsJson: stringifyJsonStringArray(meta?.parts ?? []),
        readingsJson: stringifyJsonStringArray(readings?.searchReadings ?? []),
        readingCount: readings?.readingCount ?? 0
      }
    })
    await db.insert(kanjiRef).values(chunk)
  }
}

/**
 * Stamp WaniKani catalog membership onto kanji_ref.
 * This is the source of truth for untracked vs unstudied (not SRS progress alone).
 * Also merges WK readings (including nanori) into searchable readings_json.
 */
async function applyWanikaniCatalog(
  db: ReturnType<typeof getDb>,
  wkRows: Array<{ character: string, level: number, apiOrder: number, readings: string[] }>
) {
  const byChar = new Map(wkRows.map(r => [r.character, r]))
  const kanjidic = loadKanjidicReadingIndex()
  const refs = await db.select({
    character: kanjiRef.character,
    readingsJson: kanjiRef.readingsJson
  }).from(kanjiRef)

  await db.transaction(async (tx) => {
    for (const ref of refs) {
      const wk = byChar.get(ref.character)
      const index = kanjidic.get(ref.character)
      const readings = normalizeReadingsList([
        ...parseJsonStringArray(ref.readingsJson),
        ...(index?.searchReadings ?? []),
        ...(wk?.readings ?? [])
      ])
      const readingCount = countDistinctRawReadings([
        ...(index?.rawReadings ?? []),
        ...(wk?.readings ?? [])
      ])
      await tx.update(kanjiRef).set({
        inWanikani: Boolean(wk),
        wkLevel: wk?.level ?? null,
        wkApiOrder: wk?.apiOrder ?? null,
        readingsJson: stringifyJsonStringArray(readings),
        readingCount
      }).where(eq(kanjiRef.character, ref.character))
    }
  })
}

export async function syncAllProgress() {
  const config = useRuntimeConfig()
  const databasePath = String(config.databasePath || './data/kanji-map.sqlite')
  const wkKey = String(config.wanikaniApiKey || '')
  const bpJwt = String(config.bunproFrontendJwt || '')

  await ensureSeeded(databasePath)
  const db = getDb()
  const syncedAt = new Date().toISOString()

  let wkRows: Awaited<ReturnType<typeof fetchWanikaniKanjiProgress>> = []
  let bpRows: Awaited<ReturnType<typeof fetchBunproKanjiProgress>> = []
  const warnings: string[] = []

  if (wkKey) {
    wkRows = await fetchWanikaniKanjiProgress(wkKey)
  } else {
    warnings.push('WANIKANI_API_KEY is empty — skipped WaniKani sync')
  }

  if (bpJwt) {
    try {
      bpRows = await fetchBunproKanjiProgress(bpJwt)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'BunPro sync failed'
      warnings.push(message)
      console.warn('[sync] BunPro skipped:', message)
    }
  } else {
    warnings.push('BUNPRO_FRONTEND_JWT is empty — skipped BunPro sync')
  }

  // Full subject catalog → progress + kanji_ref membership flags.
  for (const row of wkRows) {
    await db.insert(progressWanikani).values({
      character: row.character,
      subjectId: row.subjectId,
      wkLevel: row.level,
      apiOrder: row.apiOrder,
      srsStage: row.srsStage,
      accuracyPct: row.accuracyPct,
      meaningCorrect: row.meaningCorrect,
      meaningIncorrect: row.meaningIncorrect,
      readingCorrect: row.readingCorrect,
      readingIncorrect: row.readingIncorrect,
      rawJson: JSON.stringify(row),
      syncedAt
    }).onConflictDoUpdate({
      target: progressWanikani.character,
      set: {
        subjectId: row.subjectId,
        wkLevel: row.level,
        apiOrder: row.apiOrder,
        srsStage: row.srsStage,
        accuracyPct: row.accuracyPct,
        meaningCorrect: row.meaningCorrect,
        meaningIncorrect: row.meaningIncorrect,
        readingCorrect: row.readingCorrect,
        readingIncorrect: row.readingIncorrect,
        rawJson: JSON.stringify(row),
        syncedAt
      }
    })
  }

  if (wkRows.length > 0) {
    await applyWanikaniCatalog(db, wkRows)
  }

  for (const row of bpRows) {
    await db.insert(progressBunpro).values({
      character: row.character,
      srsStageNormalized: row.srsStageNormalized,
      accuracyPct: row.accuracyPct,
      rawJson: JSON.stringify(row),
      syncedAt
    }).onConflictDoUpdate({
      target: progressBunpro.character,
      set: {
        srsStageNormalized: row.srsStageNormalized,
        accuracyPct: row.accuracyPct,
        rawJson: JSON.stringify(row),
        syncedAt
      }
    })
  }

  const refs = await db.select({ character: kanjiRef.character }).from(kanjiRef)
  const wkAll = await db.select().from(progressWanikani)
  const bpAll = await db.select().from(progressBunpro)
  const wkMap = new Map(wkAll.map(r => [r.character, r]))
  const bpMap = new Map(bpAll.map(r => [r.character, r]))

  let mergedCount = 0
  for (const { character } of refs) {
    const wk = wkMap.get(character)
    const bp = bpMap.get(character)
    const merged = mergeProgress(
      wk ? { srs: wk.srsStage, accuracyPct: wk.accuracyPct } : null,
      bp ? { srs: bp.srsStageNormalized, accuracyPct: bp.accuracyPct } : null
    )

    if (merged.sources === 0) {
      await db.delete(progressMerged).where(eq(progressMerged.character, character))
      continue
    }

    await db.insert(progressMerged).values({
      character,
      srsAvg: merged.srsAvg,
      accuracyAvg: merged.accuracyAvg,
      sources: merged.sources,
      syncedAt
    }).onConflictDoUpdate({
      target: progressMerged.character,
      set: {
        srsAvg: merged.srsAvg,
        accuracyAvg: merged.accuracyAvg,
        sources: merged.sources,
        syncedAt
      }
    })
    mergedCount++
  }

  return {
    wanikani: wkRows.length,
    bunpro: bpRows.length,
    merged: mergedCount,
    syncedAt,
    warnings,
    sourcesPresent: {
      wanikani: Boolean(wkKey),
      bunpro: Boolean(bpJwt)
    },
    sourceFlags: { wanikani: SOURCE_WANIKANI, bunpro: SOURCE_BUNPRO }
  }
}

export async function getMapCells(): Promise<MapCell[]> {
  const config = useRuntimeConfig()
  await ensureSeeded(String(config.databasePath || './data/kanji-map.sqlite'))
  const db = getDb()
  const refs = await db.select().from(kanjiRef)
  const mergedRows = await db.select().from(progressMerged)
  const wkRows = await db.select({
    character: progressWanikani.character,
    subjectId: progressWanikani.subjectId
  }).from(progressWanikani)
  const mergedMap = new Map(mergedRows.map(r => [r.character, r]))
  const wkMeta = new Map(wkRows.map(r => [r.character, r]))

  const joyoOrderByChar = new Map(
    refs
      .map(ref => ({
        character: ref.character,
        schoolGrade: ref.schoolGrade as SchoolGrade | null,
        jlptLevel: ref.jlptLevel as JlptLevel | null,
        inJoyoo: ref.inJoyoo,
        freqRank: ref.freqRank ?? null,
        strokes: ref.strokes ?? null
      }))
      .sort(compareByJoyoAppearance)
      .map((entry, index) => [entry.character, index] as const)
  )

  return refs
    .slice()
    .sort((a, b) => a.gridIndex - b.gridIndex)
    .map((ref) => {
      const m = mergedMap.get(ref.character)
      const wk = wkMeta.get(ref.character)
      // Catalog membership comes from kanji_ref (stamped at sync), with progress row as fallback
      // for DBs that have not re-synced since in_wanikani was added.
      const inWanikani = Boolean(ref.inWanikani) || Boolean(wk)
      let sources = m?.sources ?? 0
      if (inWanikani) sources |= SOURCE_WANIKANI
      return {
        character: ref.character,
        schoolGrade: ref.schoolGrade as SchoolGrade | null,
        jlptLevel: ref.jlptLevel as JlptLevel | null,
        inJoyoo: ref.inJoyoo,
        freqRank: ref.freqRank ?? null,
        strokes: ref.strokes ?? null,
        gridIndex: ref.gridIndex,
        joyoIndex: joyoOrderByChar.get(ref.character) ?? 0,
        srsAvg: m?.srsAvg ?? (inWanikani ? 0 : null),
        accuracyAvg: m?.accuracyAvg ?? null,
        sources,
        inWanikani,
        wkLevel: ref.wkLevel ?? null,
        wkSubjectId: wk?.subjectId ?? null,
        wkApiOrder: ref.wkApiOrder ?? null,
        radicalSymbol: ref.radicalSymbol ?? null,
        radicalForms: parseJsonStringArray(ref.radicalFormsJson),
        parts: parseJsonStringArray(ref.partsJson),
        readings: parseJsonStringArray(ref.readingsJson),
        readingCount: ref.readingCount ?? 0
      }
    })
}
