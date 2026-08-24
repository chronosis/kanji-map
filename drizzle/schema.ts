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
  wkApiOrder: integer('wk_api_order')
})

export const progressWanikani = sqliteTable('progress_wanikani', {
  character: text('character').primaryKey(),
  subjectId: integer('subject_id'),
  wkLevel: integer('wk_level'),
  /** Index in WK `/subjects?types=kanji` response order */
  apiOrder: integer('api_order'),
  srsStage: integer('srs_stage').notNull(),
  accuracyPct: real('accuracy_pct'),
  meaningIncorrect: integer('meaning_incorrect').notNull().default(0),
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
