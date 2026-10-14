import { eq } from 'drizzle-orm'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  kanjiRef,
  progressBunpro,
  progressMerged,
  progressWanikani,
  syncMeta
} from '../../drizzle/schema'
import { SOURCE_BUNPRO, SOURCE_WANIKANI } from '../../shared/types/kanji'
import type { JishoKanjiMeta } from '../adapters/jisho-kanji'
import type { JlptLevel, KanjiUnionEntry, MapCell, SchoolGrade } from '../../shared/types/kanji'
import { assignGridIndices, compareByJoyoAppearance } from '../../shared/utils/kanji-order'
import { parseJsonStringArray, stringifyJsonStringArray } from '../../shared/utils/json-arrays'
import { countDistinctReadingStems, normalizeReadingsList } from '../../shared/utils/readings'
import { mergeProgress } from '../../shared/utils/merge-progress'
import type { KanjiSrsSnapshot } from '../../shared/utils/wanikani-sync-plan'
import { fetchBunproKanjiProgress } from '../adapters/bunpro'
import { fetchWanikaniKanjiProgress, type WanikaniKanjiProgress } from '../adapters/wanikani'
import { getDb } from './db'
import { ensureSchema } from './ensure-schema'
import { loadKanjidicReadingIndex } from './kanji-readings'
import { recordMapSnapshot } from './map-snapshots'

const WK_SUBJECTS_THROUGH_LEVEL = 'wk_subjects_through_level'

type SyncConfig = {
  databasePath?: string
  wanikaniApiKey?: string
  bunproFrontendJwt?: string
}

export type SyncStatusReporter = (message: string) => void

function resolveSyncConfig(config?: SyncConfig) {
  const runtime = config ?? useRuntimeConfig()
  return {
    databasePath: String(runtime.databasePath || './data/kanji-map.sqlite'),
    wanikaniApiKey: String(runtime.wanikaniApiKey || ''),
    bunproFrontendJwt: String(runtime.bunproFrontendJwt || '')
  }
}

function loadJishoMeta(): Record<string, JishoKanjiMeta> {
  const metaPath = resolve('data/kanji-jisho-meta.json')
  if (!existsSync(metaPath)) return {}
  return JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, JishoKanjiMeta>
}

function loadNanori(): Record<string, string[]> {
  const path = resolve('data/kanji-nanori.json')
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string[]>
}

/** Refresh searchable readings (if missing), stem counts when stale, and nanori from cache. */
async function ensureKanjiReadings(db: ReturnType<typeof getDb>) {
  const kanjidic = loadKanjidicReadingIndex()
  if (kanjidic.size === 0) return

  const nanoriByChar = loadNanori()

  const goProbe = await db.select({
    readingsJson: kanjiRef.readingsJson
  }).from(kanjiRef).where(eq(kanjiRef.character, '語')).limit(1)

  const seiProbe = await db.select({
    readingCount: kanjiRef.readingCount,
    nanoriJson: kanjiRef.nanoriJson
  }).from(kanjiRef).where(eq(kanjiRef.character, '生')).limit(1)

  const existingProbe = parseJsonStringArray(goProbe[0]?.readingsJson)
  const hasSearchReadings = existingProbe.includes('ご')
    || existingProbe.includes('かたる')
    || existingProbe.includes('かた')
  const expectedSeiCount = kanjidic.get('生')?.readingCount ?? 0
  const countsAreCurrent = expectedSeiCount > 0
    && (seiProbe[0]?.readingCount ?? 0) === expectedSeiCount
  // Also refresh when 行 lost hyphen-suffix / okurigana-split double-counts (was 9).
  const gyouProbe = await db.select({
    readingCount: kanjiRef.readingCount
  }).from(kanjiRef).where(eq(kanjiRef.character, '行')).limit(1)
  const expectedGyouCount = kanjidic.get('行')?.readingCount ?? 0
  const gyouCountsAreCurrent = expectedGyouCount > 0
    && (gyouProbe[0]?.readingCount ?? 0) === expectedGyouCount
  const expectedSeiNanori = nanoriByChar['生'] ?? []
  const nanoriAreCurrent = expectedSeiNanori.length === 0
    || parseJsonStringArray(seiProbe[0]?.nanoriJson).length > 0

  if (hasSearchReadings && countsAreCurrent && gyouCountsAreCurrent && nanoriAreCurrent) return

  const refs = await db.select({
    character: kanjiRef.character,
    readingsJson: kanjiRef.readingsJson,
    nanoriJson: kanjiRef.nanoriJson
  }).from(kanjiRef)

  await db.transaction(async (tx) => {
    for (const ref of refs) {
      const index = kanjidic.get(ref.character)
      const nanori = nanoriByChar[ref.character]
        ?? parseJsonStringArray(ref.nanoriJson)
      const patch: {
        readingsJson?: string
        readingCount: number
        nanoriJson: string
      } = {
        readingCount: index?.readingCount ?? 0,
        nanoriJson: stringifyJsonStringArray(nanori)
      }
      if (!hasSearchReadings || !nanoriAreCurrent) {
        patch.readingsJson = stringifyJsonStringArray(normalizeReadingsList([
          ...parseJsonStringArray(ref.readingsJson),
          ...(index?.searchReadings ?? []),
          ...nanori
        ]))
      }
      await tx.update(kanjiRef).set(patch).where(eq(kanjiRef.character, ref.character))
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
  const nanoriByChar = loadNanori()
  const kanjidic = loadKanjidicReadingIndex()
  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) => {
      const meta = jishoMeta[row.character]
      const readings = kanjidic.get(row.character)
      const nanori = nanoriByChar[row.character] ?? []
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
        readingsJson: stringifyJsonStringArray(normalizeReadingsList([
          ...(readings?.searchReadings ?? []),
          ...nanori
        ])),
        readingCount: readings?.readingCount ?? 0,
        nanoriJson: stringifyJsonStringArray(nanori)
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
  wkRows: Array<{
    character: string
    level: number
    apiOrder: number
    readings: string[]
    onKunReadings: string[]
  }>
) {
  const byChar = new Map(wkRows.map(r => [r.character, r]))
  const kanjidic = loadKanjidicReadingIndex()
  const refs = await db.select({
    character: kanjiRef.character,
    readingsJson: kanjiRef.readingsJson,
    nanoriJson: kanjiRef.nanoriJson
  }).from(kanjiRef)

  await db.transaction(async (tx) => {
    for (const ref of refs) {
      const wk = byChar.get(ref.character)
      if (!wk) continue
      const index = kanjidic.get(ref.character)
      const nanori = parseJsonStringArray(ref.nanoriJson)
      const readings = normalizeReadingsList([
        ...parseJsonStringArray(ref.readingsJson),
        ...(index?.searchReadings ?? []),
        ...nanori,
        ...(wk?.readings ?? [])
      ])
      // Stem count: one Set across Kanjidic + joyo WK dump + live WK on/kun (never nanori).
      const readingCount = countDistinctReadingStems(
        index?.kanjidicReadings ?? [],
        index?.wkDumpReadings ?? [],
        wk?.onKunReadings ?? []
      )
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

async function readSubjectsThroughLevel(db: ReturnType<typeof getDb>): Promise<number> {
  const [row] = await db.select().from(syncMeta)
    .where(eq(syncMeta.key, WK_SUBJECTS_THROUGH_LEVEL))
    .limit(1)
  const level = Number(row?.value)
  return Number.isFinite(level) ? level : 0
}

async function writeSubjectsThroughLevel(db: ReturnType<typeof getDb>, level: number) {
  await db.insert(syncMeta).values({
    key: WK_SUBJECTS_THROUGH_LEVEL,
    value: String(level)
  }).onConflictDoUpdate({
    target: syncMeta.key,
    set: { value: String(level) }
  })
}

function wanikaniAssignments(row: WanikaniKanjiProgress, syncedAt: string) {
  const shared = {
    subjectId: row.subjectId,
    srsStage: row.srsStage,
    accuracyPct: row.accuracyPct,
    meaningCorrect: row.meaningCorrect,
    meaningIncorrect: row.meaningIncorrect,
    readingCorrect: row.readingCorrect,
    readingIncorrect: row.readingIncorrect,
    availableAt: row.availableAt,
    assignmentUpdatedAt: row.assignmentUpdatedAt,
    rawJson: JSON.stringify(row),
    syncedAt
  }
  if (!row.hasSubject) return shared
  return {
    ...shared,
    wkLevel: row.level,
    apiOrder: row.apiOrder
  }
}

export async function syncAllProgress(onStatus?: SyncStatusReporter, config?: SyncConfig) {
  const resolved = resolveSyncConfig(config)
  const databasePath = resolved.databasePath
  const wkKey = resolved.wanikaniApiKey
  const bpJwt = resolved.bunproFrontendJwt

  await ensureSeeded(databasePath)
  const db = getDb()
  const syncedAt = new Date().toISOString()

  let wkRows: WanikaniKanjiProgress[] = []
  let bpRows: Awaited<ReturnType<typeof fetchBunproKanjiProgress>> = []
  const warnings: string[] = []

  if (wkKey) {
    const stored = await db.select({
      character: progressWanikani.character,
      subjectId: progressWanikani.subjectId,
      wkLevel: progressWanikani.wkLevel,
      srsStage: progressWanikani.srsStage,
      availableAt: progressWanikani.availableAt,
      assignmentUpdatedAt: progressWanikani.assignmentUpdatedAt
    }).from(progressWanikani)
    const snapshots: KanjiSrsSnapshot[] = []
    for (const row of stored) {
      if (row.subjectId == null) continue
      snapshots.push({
        character: row.character,
        subjectId: row.subjectId,
        wkLevel: row.wkLevel,
        srsStage: row.srsStage,
        availableAt: row.availableAt,
        updatedAt: row.assignmentUpdatedAt
      })
    }
    const fetched = await fetchWanikaniKanjiProgress(wkKey, {
      snapshots,
      subjectsThroughLevel: await readSubjectsThroughLevel(db),
      onStatus
    })
    wkRows = fetched.rows
    if (fetched.subjectsThroughLevel > 0) {
      await writeSubjectsThroughLevel(db, fetched.subjectsThroughLevel)
    }
  } else {
    warnings.push('WANIKANI_API_KEY is empty — skipped WaniKani sync')
    onStatus?.('WaniKani API key is empty')
  }

  if (bpJwt) {
    try {
      bpRows = await fetchBunproKanjiProgress(bpJwt, onStatus)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'BunPro sync failed'
      warnings.push(message)
      console.warn('[sync] BunPro skipped:', message)
    }
  } else {
    warnings.push('BUNPRO_FRONTEND_JWT is empty — skipped BunPro sync')
  }

  onStatus?.('Saving progress…')
  for (const row of wkRows) {
    const values = wanikaniAssignments(row, syncedAt)
    await db.insert(progressWanikani).values({
      character: row.character,
      wkLevel: row.hasSubject ? row.level : null,
      apiOrder: row.hasSubject ? row.apiOrder : null,
      ...values
    }).onConflictDoUpdate({
      target: progressWanikani.character,
      set: values
    })
  }

  const catalogRows = wkRows.filter(row => row.hasSubject)
  if (catalogRows.length > 0) {
    await applyWanikaniCatalog(db, catalogRows)
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

  onStatus?.('Saving map snapshot…')
  await recordMapSnapshot(await getMapCells(resolved), syncedAt)

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

export async function getMapCells(config?: SyncConfig): Promise<MapCell[]> {
  const resolved = resolveSyncConfig(config)
  await ensureSeeded(resolved.databasePath)
  const db = getDb()
  const refs = await db.select().from(kanjiRef)
  const mergedRows = await db.select().from(progressMerged)
  const wkRows = await db.select({
    character: progressWanikani.character,
    subjectId: progressWanikani.subjectId,
    meaningCorrect: progressWanikani.meaningCorrect,
    meaningIncorrect: progressWanikani.meaningIncorrect,
    readingCorrect: progressWanikani.readingCorrect,
    readingIncorrect: progressWanikani.readingIncorrect
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
        readingCount: ref.readingCount ?? 0,
        meaningCorrect: wk?.meaningCorrect ?? 0,
        meaningIncorrect: wk?.meaningIncorrect ?? 0,
        readingCorrect: wk?.readingCorrect ?? 0,
        readingIncorrect: wk?.readingIncorrect ?? 0
      }
    })
}
