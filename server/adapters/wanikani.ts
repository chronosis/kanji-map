/**
 * WaniKani API v2 client (server-side only).
 * Docs: https://docs.api.wanikani.com/
 */
import { accuracyFromCounts } from '../../shared/utils/merge-progress'
import {
  latestAssignmentUpdate,
  planKanjiPolls,
  snapshotsAtOrBelowLevel,
  wanikaniLevelList,
  type KanjiSrsSnapshot
} from '../../shared/utils/wanikani-sync-plan'

const WK_BASE = 'https://api.wanikani.com/v2'
const REVISION = '20170710'

export interface WanikaniKanjiProgress {
  character: string
  subjectId: number
  /** WaniKani radical/kanji/vocab level 1–60 */
  level: number
  /** 0-based index among kanji subjects in the paginated `/subjects` response. */
  apiOrder: number
  /** 0 = in catalog but no assignment yet (or locked) */
  srsStage: number
  accuracyPct: number | null
  meaningCorrect: number
  meaningIncorrect: number
  readingCorrect: number
  readingIncorrect: number
  /** Raw WK readings (onyomi / kunyomi / nanori) for search indexing. */
  readings: string[]
  /** On/kun only — used for map reading-count stems (excludes nanori). */
  onKunReadings: string[]
  /** Next review. Null when burned, locked, or not yet scheduled. */
  availableAt: string | null
  /** Assignment data_updated_at. */
  assignmentUpdatedAt: string | null
  /** False when this sync refreshed SRS only and the subject payload was already stored. */
  hasSubject: boolean
}

export interface WanikaniSyncResult {
  userLevel: number
  /** Highest level whose kanji subjects are now stored, including earlier syncs. */
  subjectsThroughLevel: number
  rows: WanikaniKanjiProgress[]
}

export interface WanikaniSyncOptions {
  snapshots?: readonly KanjiSrsSnapshot[]
  /** Highest level already stored from an earlier subject fetch. */
  subjectsThroughLevel?: number
  now?: number
  onStatus?: (message: string) => void
}

interface WkResource<T> {
  id: number
  data_updated_at?: string | null
  data: T
}

interface WkCollection<T> {
  total_count?: number
  pages: { next_url: string | null }
  data: WkResource<T>[]
}

type StatusFn = (message: string) => void

const ID_BATCH = 500

function chunkIds(ids: number[], size: number): number[][] {
  const batches: number[][] = []
  for (let index = 0; index < ids.length; index += size) {
    batches.push(ids.slice(index, index + size))
  }
  return batches
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function wkFetch<T>(pathOrUrl: string, apiKey: string, onStatus?: StatusFn): Promise<T> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${WK_BASE}${pathOrUrl}`
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Wanikani-Revision': REVISION
      }
    })
    if (res.status === 429 || res.status >= 500) {
      if (attempt === 3) {
        throw createError({
          statusCode: res.status,
          statusMessage: `WaniKani API error: ${res.status} ${res.statusText}`
        })
      }
      const retryAfter = Number(res.headers.get('Retry-After'))
      const reset = Number(res.headers.get('RateLimit-Reset'))
      const fromReset = Number.isFinite(reset) && reset > 0 ? reset * 1000 - Date.now() : 0
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.max(1000 * (attempt + 1), fromReset)
      onStatus?.('WaniKani is busy. Waiting briefly before retrying…')
      await sleep(Math.min(60_000, Math.max(1000, waitMs)))
      continue
    }
    if (!res.ok) {
      throw createError({
        statusCode: res.status,
        statusMessage: `WaniKani API error: ${res.status} ${res.statusText}`
      })
    }
    return res.json() as Promise<T>
  }
  throw createError({
    statusCode: 502,
    statusMessage: 'WaniKani could not complete the request. Please sync again.'
  })
}

async function fetchAllPages<T>(
  firstPath: string,
  apiKey: string,
  onStatus?: StatusFn,
  label?: string
): Promise<WkResource<T>[]> {
  const items: WkResource<T>[] = []
  let next: string | null = firstPath.startsWith('http') ? firstPath : `${WK_BASE}${firstPath}`
  while (next) {
    const page: WkCollection<T> = await wkFetch<WkCollection<T>>(next, apiKey, onStatus)
    items.push(...page.data)
    if (label) {
      const total = page.total_count
      onStatus?.(total != null
        ? `${label} · ${items.length.toLocaleString()} of ${total.toLocaleString()}`
        : `${label} · ${items.length.toLocaleString()}`)
    }
    next = page.pages.next_url
  }
  return items
}

async function fetchResourcesByIds<T>(
  collectionPath: 'assignments' | 'review_statistics',
  ids: number[],
  apiKey: string,
  onStatus: StatusFn | undefined,
  label: string
): Promise<WkResource<T>[]> {
  const unique = [...new Set(ids.filter(id => id > 0))]
  const items: WkResource<T>[] = []
  const batches = chunkIds(unique, ID_BATCH)
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index]!
    onStatus?.(`${label} · ${items.length.toLocaleString()} of ${unique.length.toLocaleString()}`)
    const page = await fetchAllPages<T>(
      `/${collectionPath}?subject_ids=${batch.join(',')}`,
      apiKey,
      onStatus
    )
    items.push(...page)
    onStatus?.(`${label} · ${Math.min(unique.length, (index + 1) * ID_BATCH).toLocaleString()} of ${unique.length.toLocaleString()}`)
  }
  return items
}

type KanjiSubjectMeaningData = {
  characters: string | null
  meanings?: Array<{ meaning: string, primary?: boolean }>
}

let kanjiPrimaryMeaningLookupCache: Map<string, string> | null = null
let kanjiPrimaryMeaningLookupKey: string | null = null

/** Map normalized primary meaning → kanji character for mnemonic `<kanji>` tags. */
export async function fetchWanikaniKanjiPrimaryMeaningLookup(
  apiKey: string
): Promise<Map<string, string>> {
  if (!apiKey) return new Map()
  if (kanjiPrimaryMeaningLookupCache && kanjiPrimaryMeaningLookupKey === apiKey) {
    return kanjiPrimaryMeaningLookupCache
  }

  const subjects = await fetchAllPages<KanjiSubjectMeaningData>('/subjects?types=kanji', apiKey)
  const map = new Map<string, string>()
  for (const subject of subjects) {
    const character = subject.data.characters
    if (!character) continue
    const meanings = subject.data.meanings ?? []
    const primary = meanings.find(m => m.primary) ?? meanings[0]
    if (!primary?.meaning) continue
    const key = primary.meaning.toLowerCase()
    if (!map.has(key)) {
      map.set(key, character)
    }
  }

  kanjiPrimaryMeaningLookupCache = map
  kanjiPrimaryMeaningLookupKey = apiKey
  return map
}

type SubjectData = {
  characters: string | null
  level: number
  readings?: Array<{ reading: string, type?: string }>
}

type AssignmentData = {
  subject_id: number
  srs_stage: number
  subject_type: string
  available_at?: string | null
}

type ReviewStatData = {
  subject_id: number
  meaning_correct: number
  meaning_incorrect: number
  reading_correct: number
  reading_incorrect: number
  percentage_correct: number
}

function readUserLevel(level: unknown): number {
  const value = typeof level === 'number' ? level : Number(level)
  if (!Number.isFinite(value)) {
    throw createError({
      statusCode: 502,
      statusMessage: 'WaniKani did not return an account level'
    })
  }
  return Math.min(60, Math.max(1, Math.trunc(value)))
}

function subjectReadings(data: SubjectData): { readings: string[], onKunReadings: string[] } {
  const readings = (data.readings ?? []).map(reading => reading.reading).filter(Boolean)
  const onKunReadings = (data.readings ?? [])
    .filter(reading => reading.type !== 'nanori')
    .map(reading => reading.reading)
    .filter(Boolean)
  return { readings, onKunReadings }
}

function progressFromStats(
  character: string,
  subjectId: number,
  level: number | null,
  apiOrder: number | null,
  hasSubject: boolean,
  srsStage: number,
  availableAt: string | null,
  assignmentUpdatedAt: string | null,
  readings: string[],
  onKunReadings: string[],
  stats: ReviewStatData | undefined
): WanikaniKanjiProgress {
  const meaningCorrect = stats?.meaning_correct ?? 0
  const meaningIncorrect = stats?.meaning_incorrect ?? 0
  const readingCorrect = stats?.reading_correct ?? 0
  const readingIncorrect = stats?.reading_incorrect ?? 0
  const accuracyPct = stats
    ? (stats.percentage_correct
      ?? accuracyFromCounts(
        meaningCorrect + readingCorrect,
        meaningIncorrect + readingIncorrect
      ))
    : null
  return {
    character,
    subjectId,
    level: level ?? 0,
    apiOrder: apiOrder ?? 0,
    hasSubject,
    srsStage,
    accuracyPct,
    meaningCorrect,
    meaningIncorrect,
    readingCorrect,
    readingIncorrect,
    readings,
    onKunReadings,
    availableAt,
    assignmentUpdatedAt
  }
}

export async function fetchWanikaniKanjiProgress(
  apiKey: string,
  options: WanikaniSyncOptions = {}
): Promise<WanikaniSyncResult> {
  const empty: WanikaniSyncResult = { userLevel: 0, subjectsThroughLevel: 0, rows: [] }
  if (!apiKey) return empty

  const onStatus = options.onStatus
  const now = options.now ?? Date.now()
  onStatus?.('Checking your WaniKani account…')
  const account = await wkFetch<{ data: { level: number } }>('/user', apiKey, onStatus)
  const userLevel = readUserLevel(account.data.level)
  const storedThrough = Math.max(0, options.subjectsThroughLevel ?? 0)
  const scoped = snapshotsAtOrBelowLevel(options.snapshots ?? [], userLevel)
  const plan = planKanjiPolls(scoped, now)
  const levels = wanikaniLevelList(1, userLevel).join(',')
  const fetchSubjects = plan.full || userLevel > storedThrough
  const subjectFrom = plan.full ? 1 : storedThrough + 1

  let subjects: WkResource<SubjectData>[] = []
  if (fetchSubjects) {
    const subjectLevels = wanikaniLevelList(subjectFrom, userLevel).join(',')
    subjects = await fetchAllPages<SubjectData>(
      `/subjects?types=kanji&levels=${subjectLevels}`,
      apiKey,
      onStatus,
      `Loading kanji through level ${userLevel}`
    )
  } else {
    onStatus?.(`Kanji catalog is current through level ${userLevel}`)
  }

  const assignments: WkResource<AssignmentData>[] = []
  const seenAssignments = new Set<number>()
  const pushAssignments = (rows: WkResource<AssignmentData>[]) => {
    for (const row of rows) {
      const subjectId = row.data.subject_id
      if (seenAssignments.has(subjectId)) continue
      seenAssignments.add(subjectId)
      assignments.push(row)
    }
  }

  if (plan.full) {
    pushAssignments(await fetchAllPages<AssignmentData>(
      `/assignments?subject_types=kanji&levels=${levels}`,
      apiKey,
      onStatus,
      'Reading kanji progress'
    ))
  } else {
    const skipNote = [
      plan.skippedBurned > 0 ? `skipping ${plan.skippedBurned.toLocaleString()} burned` : '',
      plan.skippedUpcoming > 0 ? `skipping ${plan.skippedUpcoming.toLocaleString()} not yet due` : ''
    ].filter(Boolean).join(' · ')
    const cursor = latestAssignmentUpdate(scoped)
    if (cursor) {
      onStatus?.(skipNote ? `Checking for kanji updates · ${skipNote}` : 'Checking for kanji updates…')
      pushAssignments(await fetchAllPages<AssignmentData>(
        `/assignments?subject_types=kanji&levels=${levels}&updated_after=${encodeURIComponent(cursor)}`,
        apiKey,
        onStatus,
        'Checking for kanji updates'
      ))
    } else if (skipNote) {
      onStatus?.(skipNote.charAt(0).toUpperCase() + skipNote.slice(1))
    }

    const pollIds = [
      ...plan.pollSubjectIds.filter(id => !seenAssignments.has(id)),
      ...subjects.map(subject => subject.id).filter(id => !seenAssignments.has(id))
    ]
    if (pollIds.length > 0) {
      pushAssignments(await fetchResourcesByIds<AssignmentData>(
        'assignments',
        pollIds,
        apiKey,
        onStatus,
        'Reading kanji with reviews due'
      ))
    } else if (assignments.length === 0) {
      onStatus?.('WaniKani progress is unchanged')
    }
  }

  const snapshotBySubject = new Map(scoped.map(row => [row.subjectId, row]))
  const missingSubjectIds = [...new Set(assignments
    .map(row => row.data.subject_id)
    .filter(id => !subjects.some(subject => subject.id === id) && !snapshotBySubject.has(id)))]
  if (missingSubjectIds.length > 0) {
    subjects.push(...await fetchAllPages<SubjectData>(
      `/subjects?ids=${missingSubjectIds.join(',')}`,
      apiKey,
      onStatus,
      'Loading updated kanji'
    ))
  }

  const statIds = plan.full
    ? subjects.map(subject => subject.id)
    : [
        ...assignments.map(row => row.data.subject_id),
        ...subjects.map(subject => subject.id)
      ]
  const stats = statIds.length > 0
    ? await fetchResourcesByIds<ReviewStatData>(
        'review_statistics',
        statIds,
        apiKey,
        onStatus,
        'Reading WaniKani accuracy'
      )
    : []
  if (statIds.length === 0) onStatus?.('WaniKani accuracy is unchanged')

  const statsBySubject = new Map<number, ReviewStatData>()
  for (const stat of stats) statsBySubject.set(stat.data.subject_id, stat.data)

  const assignmentBySubject = new Map<number, WkResource<AssignmentData>>()
  for (const assignment of assignments) {
    assignmentBySubject.set(assignment.data.subject_id, assignment)
  }

  const subjectById = new Map(subjects.map(subject => [subject.id, subject]))
  const results: WanikaniKanjiProgress[] = []
  const written = new Set<number>()

  let apiOrder = 0
  for (const subject of subjects) {
    if (!subject.data.characters) continue
    if (subject.data.level > userLevel) continue
    const assignment = assignmentBySubject.get(subject.id)
    const readingFields = subjectReadings(subject.data)
    results.push(progressFromStats(
      subject.data.characters,
      subject.id,
      subject.data.level,
      apiOrder,
      true,
      assignment?.data.srs_stage ?? snapshotBySubject.get(subject.id)?.srsStage ?? 0,
      assignment?.data.available_at ?? null,
      assignment?.data_updated_at ?? null,
      readingFields.readings,
      readingFields.onKunReadings,
      statsBySubject.get(subject.id)
    ))
    written.add(subject.id)
    apiOrder++
  }

  for (const assignment of assignments) {
    const subjectId = assignment.data.subject_id
    if (written.has(subjectId)) continue
    const subject = subjectById.get(subjectId)
    const snapshot = snapshotBySubject.get(subjectId)
    const character = subject?.data.characters ?? snapshot?.character
    if (!character) continue
    const readingFields = subject ? subjectReadings(subject.data) : { readings: [], onKunReadings: [] }
    results.push(progressFromStats(
      character,
      subjectId,
      subject?.data.level ?? snapshot?.wkLevel ?? null,
      null,
      Boolean(subject),
      assignment.data.srs_stage,
      assignment.data.available_at ?? null,
      assignment.data_updated_at ?? snapshot?.updatedAt ?? null,
      readingFields.readings,
      readingFields.onKunReadings,
      statsBySubject.get(subjectId)
    ))
    written.add(subjectId)
  }

  return {
    userLevel,
    subjectsThroughLevel: fetchSubjects ? userLevel : storedThrough,
    rows: results
  }
}

export interface WanikaniReviewStats {
  meaningCorrect: number
  meaningIncorrect: number
  readingCorrect: number
  readingIncorrect: number
  accuracyPct: number | null
}

/** Live review counts for one subject (used when local DB rows predate correct-count columns). */
export async function fetchWanikaniReviewStatsForSubject(
  apiKey: string,
  subjectId: number
): Promise<WanikaniReviewStats | null> {
  if (!apiKey || subjectId <= 0) return null

  type ReviewStatData = {
    meaning_correct: number
    meaning_incorrect: number
    reading_correct: number
    reading_incorrect: number
    percentage_correct: number
  }

  try {
    const page = await wkFetch<WkCollection<ReviewStatData>>(
      `/review_statistics?subject_ids=${subjectId}`,
      apiKey
    )
    const row = page.data[0]?.data
    if (!row) return null

    const meaningCorrect = row.meaning_correct ?? 0
    const meaningIncorrect = row.meaning_incorrect ?? 0
    const readingCorrect = row.reading_correct ?? 0
    const readingIncorrect = row.reading_incorrect ?? 0

    return {
      meaningCorrect,
      meaningIncorrect,
      readingCorrect,
      readingIncorrect,
      accuracyPct: row.percentage_correct
        ?? accuracyFromCounts(
          meaningCorrect + readingCorrect,
          meaningIncorrect + readingIncorrect
        )
    }
  } catch {
    return null
  }
}

export interface WanikaniKanjiSubjectDetail {
  subjectId: number
  characters: string
  level: number
  documentUrl: string
  meanings: Array<{ meaning: string, primary: boolean }>
  readings: Array<{ reading: string, type: 'onyomi' | 'kunyomi' | 'nanori' | 'other', primary: boolean }>
  meaningMnemonic: string | null
  readingMnemonic: string | null
  componentSubjectIds: number[]
  amalgamationSubjectIds: number[]
  visuallySimilarSubjectIds: number[]
}

export interface WanikaniRelatedSubject {
  subjectId: number
  object: string
  characters: string | null
  meanings: string[]
  readings: string[]
}

type WkSubjectPayload = {
  characters: string | null
  level: number
  document_url?: string
  meanings?: Array<{ meaning: string, primary?: boolean }>
  readings?: Array<{ reading: string, type?: string, primary?: boolean }>
  meaning_mnemonic?: string | null
  reading_mnemonic?: string | null
  component_subject_ids?: number[]
  amalgamation_subject_ids?: number[]
  visually_similar_subject_ids?: number[]
}

function mapReadingType(raw: string | undefined): 'onyomi' | 'kunyomi' | 'nanori' | 'other' {
  if (raw === 'onyomi' || raw === 'kunyomi' || raw === 'nanori') return raw
  return 'other'
}

function parseKanjiSubject(
  id: number,
  data: WkSubjectPayload
): WanikaniKanjiSubjectDetail | null {
  if (!data.characters) return null
  return {
    subjectId: id,
    characters: data.characters,
    level: data.level,
    documentUrl: data.document_url
      ?? `https://www.wanikani.com/kanji/${encodeURIComponent(data.characters)}`,
    meanings: (data.meanings ?? []).map(m => ({
      meaning: m.meaning,
      primary: Boolean(m.primary)
    })),
    readings: (data.readings ?? []).map(r => ({
      reading: r.reading,
      type: mapReadingType(r.type),
      primary: Boolean(r.primary)
    })),
    meaningMnemonic: data.meaning_mnemonic ?? null,
    readingMnemonic: data.reading_mnemonic ?? null,
    componentSubjectIds: data.component_subject_ids ?? [],
    amalgamationSubjectIds: data.amalgamation_subject_ids ?? [],
    visuallySimilarSubjectIds: data.visually_similar_subject_ids ?? []
  }
}

/** Fetch one kanji subject by id, or by slug (= character) when id unknown. */
export async function fetchWanikaniKanjiSubject(
  apiKey: string,
  options: { subjectId?: number | null, character: string }
): Promise<WanikaniKanjiSubjectDetail | null> {
  if (!apiKey) return null

  if (options.subjectId != null && options.subjectId > 0) {
    try {
      const single = await wkFetch<{ id: number, data: WkSubjectPayload }>(
        `/subjects/${options.subjectId}`,
        apiKey
      )
      return parseKanjiSubject(single.id, single.data)
    } catch {
      // fall through to slug lookup
    }
  }

  const slug = encodeURIComponent(options.character)
  const page = await wkFetch<WkCollection<WkSubjectPayload>>(
    `/subjects?types=kanji&slugs=${slug}`,
    apiKey
  )
  const first = page.data[0]
  if (!first) return null
  return parseKanjiSubject(first.id, first.data)
}

/** Resolve related radical / vocab subjects by id (capped). */
export async function fetchWanikaniSubjectsByIds(
  apiKey: string,
  ids: number[],
  limit = 12
): Promise<WanikaniRelatedSubject[]> {
  if (!apiKey || ids.length === 0) return []
  const capped = [...new Set(ids)].filter(id => id > 0).slice(0, limit)
  if (capped.length === 0) return []

  const page = await wkFetch<WkCollection<WkSubjectPayload & { readings?: Array<{ reading: string }> }>>(
    `/subjects?ids=${capped.join(',')}`,
    apiKey
  )

  return page.data.map((row) => {
    const item = row as { id: number, object?: string, data: WkSubjectPayload }
    const meanings = (item.data.meanings ?? [])
      .map(m => m.meaning)
      .filter(Boolean)
    const readings = (item.data.readings ?? [])
      .map(r => r.reading)
      .filter(Boolean)
    return {
      subjectId: item.id,
      object: item.object ?? 'unknown',
      characters: item.data.characters,
      meanings,
      readings
    }
  })
}
