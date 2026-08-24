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
  meaningIncorrect: number
  readingIncorrect: number
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

export async function fetchWanikaniKanjiProgress(apiKey: string): Promise<WanikaniKanjiProgress[]> {
  if (!apiKey) return []

  type SubjectData = { characters: string | null, level: number }
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
    const meaningIncorrect = st?.meaning_incorrect ?? 0
    const readingIncorrect = st?.reading_incorrect ?? 0
    const accuracyPct = st
      ? (st.percentage_correct
        ?? accuracyFromCounts(
          st.meaning_correct + st.reading_correct,
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
      meaningIncorrect,
      readingIncorrect
    })
    apiOrder++
  }

  return results
}
