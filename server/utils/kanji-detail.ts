/**
 * Assemble kanji detail modal payload from local DB + WK / Jisho / BunPro.
 */
import { eq } from 'drizzle-orm'
import type { KanjiDetailMeaning, KanjiDetailResponse, KanjiDetailVocabExample } from '../../shared/types/kanji-detail'
import { jishoKanjiUrl } from '../../shared/utils/kanji'
import { fetchJishoWordsForKanji } from '../adapters/jisho'
import { fetchJishoKanjiMeanings } from '../adapters/jisho-kanji'
import { fetchKanjiapiNanori } from '../adapters/kanjiapi'
import { searchBunproVocabForKanji } from '../adapters/bunpro'
import {
  fetchWanikaniKanjiPrimaryMeaningLookup,
  fetchWanikaniKanjiSubject,
  fetchWanikaniReviewStatsForSubject,
  fetchWanikaniSubjectsByIds
} from '../adapters/wanikani'
import { kanjiRef, progressMerged, progressWanikani } from '../../drizzle/schema'
import { parseWanikaniMnemonic } from '../../shared/utils/wanikani-mnemonic'
import { wanikaniReviewStatsLookStale } from '../../shared/utils/wanikani-review-stats'
import { parseJsonStringArray } from '../../shared/utils/json-arrays'
import { getDb } from './db'
import { ensureSchema } from './ensure-schema'

export async function getKanjiDetail(character: string): Promise<KanjiDetailResponse> {
  const config = useRuntimeConfig()
  await ensureSchema(String(config.databasePath || './data/kanji-map.sqlite'))
  const db = getDb()
  const warnings: string[] = []

  const [ref] = await db.select().from(kanjiRef).where(eq(kanjiRef.character, character)).limit(1)
  const [merged] = await db.select().from(progressMerged).where(eq(progressMerged.character, character)).limit(1)
  const [wkProgress] = await db
    .select()
    .from(progressWanikani)
    .where(eq(progressWanikani.character, character))
    .limit(1)

  const wkKey = String(config.wanikaniApiKey || '')
  let meaningCorrect = wkProgress?.meaningCorrect ?? null
  let meaningIncorrect = wkProgress?.meaningIncorrect ?? null
  let readingCorrect = wkProgress?.readingCorrect ?? null
  let readingIncorrect = wkProgress?.readingIncorrect ?? null

  if (
    wkKey
    && wkProgress?.subjectId
    && wanikaniReviewStatsLookStale({
      meaningCorrect,
      meaningIncorrect,
      readingCorrect,
      readingIncorrect,
      accuracyPct: wkProgress.accuracyPct
    })
  ) {
    const fresh = await fetchWanikaniReviewStatsForSubject(wkKey, wkProgress.subjectId)
    if (fresh) {
      meaningCorrect = fresh.meaningCorrect
      meaningIncorrect = fresh.meaningIncorrect
      readingCorrect = fresh.readingCorrect
      readingIncorrect = fresh.readingIncorrect
      const syncedAt = new Date().toISOString()
      await db.update(progressWanikani).set({
        meaningCorrect: fresh.meaningCorrect,
        meaningIncorrect: fresh.meaningIncorrect,
        readingCorrect: fresh.readingCorrect,
        readingIncorrect: fresh.readingIncorrect,
        accuracyPct: fresh.accuracyPct ?? wkProgress.accuracyPct,
        syncedAt
      }).where(eq(progressWanikani.character, character))
    }
  }

  const local = ref
    ? {
        character: ref.character,
        schoolGrade: ref.schoolGrade,
        jlptLevel: ref.jlptLevel,
        inJoyoo: ref.inJoyoo,
        freqRank: ref.freqRank,
        strokes: ref.strokes,
        inWanikani: ref.inWanikani,
        wkLevel: ref.wkLevel ?? wkProgress?.wkLevel ?? null,
        wkSubjectId: wkProgress?.subjectId ?? null,
        srsAvg: merged?.srsAvg ?? null,
        accuracyAvg: merged?.accuracyAvg ?? null,
        sources: merged?.sources ?? 0,
        meaningCorrect,
        meaningIncorrect,
        readingCorrect,
        readingIncorrect
      }
    : null

  let wanikani: KanjiDetailResponse['wanikani'] = null

  if (wkKey && (local?.inWanikani || local?.wkSubjectId)) {
    try {
      const subject = await fetchWanikaniKanjiSubject(wkKey, {
        subjectId: local?.wkSubjectId,
        character
      })
      if (subject) {
        const relatedIds = [
          ...subject.componentSubjectIds,
          ...subject.amalgamationSubjectIds.slice(0, 10),
          ...subject.visuallySimilarSubjectIds.slice(0, 6)
        ]
        const related = await fetchWanikaniSubjectsByIds(wkKey, relatedIds, 24)
        const byId = new Map(related.map(r => [r.subjectId, r]))

        const components = subject.componentSubjectIds
          .map((id) => {
            const r = byId.get(id)
            if (!r) return null
            return {
              subjectId: id,
              characters: r.characters,
              meaning: r.meanings[0] ?? null
            }
          })
          .filter((c): c is NonNullable<typeof c> => c != null)

        const vocabulary = subject.amalgamationSubjectIds
          .slice(0, 10)
          .map((id): KanjiDetailVocabExample | null => {
            const r = byId.get(id)
            if (!r?.characters) return null
            return {
              characters: r.characters,
              reading: r.readings[0] ?? null,
              meanings: r.meanings.slice(0, 3),
              source: 'wanikani',
              url: `https://www.wanikani.com/vocabulary/${encodeURIComponent(r.characters)}`
            }
          })
          .filter((v): v is KanjiDetailVocabExample => v != null)

        const visuallySimilar = subject.visuallySimilarSubjectIds
          .map(id => byId.get(id)?.characters)
          .filter((c): c is string => Boolean(c))

        const kanjiByPrimaryMeaning = await fetchWanikaniKanjiPrimaryMeaningLookup(wkKey)

        wanikani = {
          subjectId: subject.subjectId,
          level: subject.level,
          documentUrl: subject.documentUrl,
          meanings: subject.meanings,
          readings: subject.readings,
          meaningMnemonic: subject.meaningMnemonic,
          readingMnemonic: subject.readingMnemonic,
          meaningMnemonicSegments: parseWanikaniMnemonic(subject.meaningMnemonic, kanjiByPrimaryMeaning),
          readingMnemonicSegments: parseWanikaniMnemonic(subject.readingMnemonic, kanjiByPrimaryMeaning),
          components,
          vocabulary,
          visuallySimilar
        }
      } else {
        warnings.push('WaniKani subject not found for this character')
      }
    } catch (err) {
      warnings.push(`WaniKani detail failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  } else if (!wkKey) {
    warnings.push('WANIKANI_API_KEY empty — skipped WaniKani detail')
  }

  let jishoMeanings: KanjiDetailMeaning[] = []
  if (!wanikani?.meanings?.length) {
    try {
      const meanings = await fetchJishoKanjiMeanings(character)
      jishoMeanings = meanings.map((meaning, index) => ({
        meaning,
        primary: index === 0
      }))
    } catch {
      warnings.push('Jisho kanji meanings failed')
    }
  }

  let nanoriReadings = parseJsonStringArray(ref?.nanoriJson)
  if (!nanoriReadings.length) {
    try {
      nanoriReadings = await fetchKanjiapiNanori(character)
    } catch {
      warnings.push('kanjiapi.dev nanori fetch failed')
    }
  }

  let jishoWords: KanjiDetailVocabExample[] = []
  try {
    jishoWords = await fetchJishoWordsForKanji(character, 8)
  } catch {
    warnings.push('Jisho word search failed')
  }

  let bunproWords: KanjiDetailVocabExample[] = []
  const bpToken = String(config.bunproFrontendJwt || '')
  if (bpToken) {
    try {
      const hits = await searchBunproVocabForKanji(bpToken, character, 6)
      bunproWords = hits.map(h => ({
        characters: h.characters,
        reading: h.reading,
        meanings: h.meanings,
        source: 'bunpro' as const,
        url: h.url
      }))
    } catch {
      warnings.push('BunPro search failed')
    }
  }

  return {
    character,
    jishoUrl: jishoKanjiUrl(character),
    local,
    wanikani,
    jishoMeanings,
    nanoriReadings,
    jishoWords,
    bunproWords,
    warnings
  }
}
