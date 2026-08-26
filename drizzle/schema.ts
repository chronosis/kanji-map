import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const kanjiRef = sqliteTable('kanji_ref', {
  character: text('character').primaryKey(),
  schoolGrade: integer('school_grade'),
  jlptLevel: text('jlpt_level'),
  inJoyoo: integer('in_joyo', { mode: 'boolean' }).notNull().default(false),
  freqRank: integer('freq_rank'),
  strokes: integer('strokes'),
  gridIndex: integer('grid_index').notNull(),
  /** True when character is in the WaniKani kanji subject catalog (set by sync). */
  inWanikani: integer('in_wanikani', { mode: 'boolean' }).notNull().default(false),
  wkLevel: integer('wk_level'),
  wkApiOrder: integer('wk_api_order'),
  /** Kangxi radical symbol (Jisho / Kanjidic2) */
  radicalSymbol: text('radical_symbol'),
  /** JSON array of alternate radical forms, e.g. ["訁"] */
  radicalFormsJson: text('radical_forms_json'),
  /** JSON array of Jisho component parts, e.g. ["口","五","言"] */
  partsJson: text('parts_json'),
  /** JSON array of searchable hiragana readings (on/kun/nanori stems) */
  readingsJson: text('readings_json'),
  /** Distinct on/kun reading-stem count (okurigana collapsed; nanori excluded) */
  readingCount: integer('reading_count').notNull().default(0),
  /** JSON array of nanori (name readings) from kanjiapi.dev / Kanjidic */
  nanoriJson: text('nanori_json')
})

export const progressWanikani = sqliteTable('progress_wanikani', {
  character: text('character').primaryKey(),
  subjectId: integer('subject_id'),
  wkLevel: integer('wk_level'),
  /** Index in WK `/subjects?types=kanji` response order */
  apiOrder: integer('api_order'),
  srsStage: integer('srs_stage').notNull(),
  accuracyPct: real('accuracy_pct'),
  meaningCorrect: integer('meaning_correct').notNull().default(0),
  meaningIncorrect: integer('meaning_incorrect').notNull().default(0),
  readingCorrect: integer('reading_correct').notNull().default(0),
  readingIncorrect: integer('reading_incorrect').notNull().default(0),
  rawJson: text('raw_json'),
  syncedAt: text('synced_at').notNull()
})

export const progressBunpro = sqliteTable('progress_bunpro', {
  character: text('character').primaryKey(),
  srsStageNormalized: real('srs_stage_normalized').notNull(),
  accuracyPct: real('accuracy_pct'),
  rawJson: text('raw_json'),
  syncedAt: text('synced_at').notNull()
})

export const progressMerged = sqliteTable('progress_merged', {
  character: text('character').primaryKey(),
  srsAvg: real('srs_avg'),
  accuracyAvg: real('accuracy_avg'),
  /** Bitmask: 1 = WaniKani, 2 = BunPro */
  sources: integer('sources').notNull().default(0),
  syncedAt: text('synced_at').notNull()
})

export type KanjiRef = typeof kanjiRef.$inferSelect
export type ProgressMerged = typeof progressMerged.$inferSelect
