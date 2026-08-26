/**
 * WaniKani API v2 client (server-side only).
 * Docs: https://docs.api.wanikani.com/
 */
import { accuracyFromCounts } from '../../shared/utils/merge-progress'

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
}

interface WkCollection<T> {
  pages: { next_url: string | null }
  data: Array<{ id: number, data: T }>
}

async function wkFetch<T>(pathOrUrl: string, apiKey: string): Promise<T> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${WK_BASE}${pathOrUrl}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Wanikani-Revision': REVISION
    }
  })
  if (!res.ok) {
    throw createError({
      statusCode: res.status,
      statusMessage: `WaniKani API error: ${res.status} ${res.statusText}`
    })
  }
  return res.json() as Promise<T>
}

async function fetchAllPages<T>(
  firstPath: string,
  apiKey: string
): Promise<Array<{ id: number, data: T }>> {
  const items: Array<{ id: number, data: T }> = []
  let next: string | null = firstPath.startsWith('http') ? firstPath : `${WK_BASE}${firstPath}`
  while (next) {
    const page: WkCollection<T> = await wkFetch<WkCollection<T>>(next, apiKey)
    items.push(...page.data)
    next = page.pages.next_url
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

export async function fetchWanikaniKanjiProgress(apiKey: string): Promise<WanikaniKanjiProgress[]> {
  if (!apiKey) return []

  type SubjectData = {
    characters: string | null
    level: number
    readings?: Array<{ reading: string, type?: string }>
  }
  type AssignmentData = { subject_id: number, srs_stage: number, subject_type: string }
  type ReviewStatData = {
    subject_id: number
    meaning_correct: number
    meaning_incorrect: number
    reading_correct: number
    reading_incorrect: number
    percentage_correct: number
  }

  const [subjects, assignments, stats] = await Promise.all([
    fetchAllPages<SubjectData>('/subjects?types=kanji', apiKey),
    fetchAllPages<AssignmentData>('/assignments?subject_types=kanji', apiKey),
    fetchAllPages<ReviewStatData>('/review_statistics?subject_types=kanji', apiKey)
  ])

  const assignmentBySubject = new Map<number, number>()
  for (const a of assignments) {
    assignmentBySubject.set(a.data.subject_id, a.data.srs_stage)
  }

  const statsBySubject = new Map<number, ReviewStatData>()
  for (const s of stats) {
    statsBySubject.set(s.data.subject_id, s.data)
  }

  // Preserve `/subjects` response order (paginated concatenation).
  const results: WanikaniKanjiProgress[] = []
  let apiOrder = 0
  for (const s of subjects) {
    if (!s.data.characters) continue
    const subjectId = s.id
    const srsStage = assignmentBySubject.get(subjectId) ?? 0
    const st = statsBySubject.get(subjectId)
    const meaningCorrect = st?.meaning_correct ?? 0
    const meaningIncorrect = st?.meaning_incorrect ?? 0
    const readingCorrect = st?.reading_correct ?? 0
    const readingIncorrect = st?.reading_incorrect ?? 0
    const accuracyPct = st
      ? (st.percentage_correct
        ?? accuracyFromCounts(
          meaningCorrect + readingCorrect,
          meaningIncorrect + readingIncorrect
        ))
      : null

    results.push({
      character: s.data.characters,
      subjectId,
      level: s.data.level,
      apiOrder,
      srsStage,
      accuracyPct,
      meaningCorrect,
      meaningIncorrect,
      readingCorrect,
      readingIncorrect,
      readings: (s.data.readings ?? []).map(r => r.reading).filter(Boolean),
      onKunReadings: (s.data.readings ?? [])
        .filter(r => r.type !== 'nanori')
        .map(r => r.reading)
        .filter(Boolean)
    })
    apiOrder++
  }

  return results
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
