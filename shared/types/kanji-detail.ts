/**
 * Payload for the kanji detail modal (GET /api/kanji/:character).
 */

export interface KanjiDetailMeaning {
  meaning: string
  primary: boolean
}

export interface KanjiDetailReading {
  reading: string
  type: 'onyomi' | 'kunyomi' | 'nanori' | 'other'
  primary: boolean
}

export interface KanjiDetailVocabExample {
  characters: string
  reading: string | null
  meanings: string[]
  source: 'wanikani' | 'jisho' | 'bunpro'
  url?: string
}

export interface KanjiDetailComponent {
  characters: string | null
  meaning: string | null
  subjectId: number
}

export interface KanjiDetailMnemonicTextSegment {
  type: 'text'
  content: string
}

export interface KanjiDetailMnemonicLinkSegment {
  type: 'link'
  content: string
  href: string
}

export interface KanjiDetailMnemonicReadingSegment {
  type: 'reading'
  content: string
}

export type KanjiDetailMnemonicSegment
  = | KanjiDetailMnemonicTextSegment
    | KanjiDetailMnemonicLinkSegment
    | KanjiDetailMnemonicReadingSegment

export interface KanjiDetailLocal {
  character: string
  schoolGrade: number | null
  jlptLevel: string | null
  inJoyoo: boolean
  freqRank: number | null
  strokes: number | null
  inWanikani: boolean
  wkLevel: number | null
  wkSubjectId: number | null
  srsAvg: number | null
  accuracyAvg: number | null
  sources: number
  meaningCorrect: number | null
  meaningIncorrect: number | null
  readingCorrect: number | null
  readingIncorrect: number | null
}

export interface KanjiDetailWanikani {
  subjectId: number
  level: number
  documentUrl: string
  meanings: KanjiDetailMeaning[]
  readings: KanjiDetailReading[]
  meaningMnemonic: string | null
  readingMnemonic: string | null
  meaningMnemonicSegments: KanjiDetailMnemonicSegment[]
  readingMnemonicSegments: KanjiDetailMnemonicSegment[]
  components: KanjiDetailComponent[]
  vocabulary: KanjiDetailVocabExample[]
  visuallySimilar: string[]
}

export interface KanjiDetailResponse {
  character: string
  jishoUrl: string
  local: KanjiDetailLocal | null
  wanikani: KanjiDetailWanikani | null
  /**
   * Jisho English meanings when WaniKani meanings are unavailable
   * (no API key, untracked kanji, or WK subject missing).
   */
  jishoMeanings: KanjiDetailMeaning[]
  jishoWords: KanjiDetailVocabExample[]
  bunproWords: KanjiDetailVocabExample[]
  warnings: string[]
}
