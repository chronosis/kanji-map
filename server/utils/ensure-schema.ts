import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as schema from '../../drizzle/schema'

/** Ensure SQLite tables exist (idempotent). */
export async function ensureSchema(databasePath = process.env.DATABASE_PATH || './data/kanji-map.sqlite') {
  const absolute = databasePath.startsWith('file:')
    ? databasePath.replace(/^file:/, '')
    : resolve(process.cwd(), databasePath)
  mkdirSync(dirname(absolute), { recursive: true })
  const client = createClient({ url: `file:${absolute}` })
  const db = drizzle(client, { schema })

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS kanji_ref (
      character TEXT PRIMARY KEY NOT NULL,
      school_grade INTEGER,
      jlpt_level TEXT,
      in_joyo INTEGER NOT NULL DEFAULT 0,
      freq_rank INTEGER,
      strokes INTEGER,
      grid_index INTEGER NOT NULL,
      in_wanikani INTEGER NOT NULL DEFAULT 0,
      wk_level INTEGER,
      wk_api_order INTEGER
    );
    CREATE TABLE IF NOT EXISTS progress_wanikani (
      character TEXT PRIMARY KEY NOT NULL,
      subject_id INTEGER,
      wk_level INTEGER,
      api_order INTEGER,
      srs_stage INTEGER NOT NULL,
      accuracy_pct REAL,
      meaning_correct INTEGER NOT NULL DEFAULT 0,
      meaning_incorrect INTEGER NOT NULL DEFAULT 0,
      reading_correct INTEGER NOT NULL DEFAULT 0,
      reading_incorrect INTEGER NOT NULL DEFAULT 0,
      raw_json TEXT,
      synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress_bunpro (
      character TEXT PRIMARY KEY NOT NULL,
      srs_stage_normalized REAL NOT NULL,
      accuracy_pct REAL,
      raw_json TEXT,
      synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress_merged (
      character TEXT PRIMARY KEY NOT NULL,
      srs_avg REAL,
      accuracy_avg REAL,
      sources INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL
    );
  `)

  // Migrate older DBs that lack ordering / catalog columns.
  for (const col of [
    'freq_rank INTEGER',
    'strokes INTEGER',
    'in_wanikani INTEGER NOT NULL DEFAULT 0',
    'wk_level INTEGER',
    'wk_api_order INTEGER',
    'radical_symbol TEXT',
    'radical_forms_json TEXT',
    'parts_json TEXT'
  ]) {
    try {
      await client.execute(`ALTER TABLE kanji_ref ADD COLUMN ${col}`)
    } catch {
      // column already exists
    }
  }

  for (const col of ['subject_id INTEGER', 'wk_level INTEGER', 'api_order INTEGER']) {
    try {
      await client.execute(`ALTER TABLE progress_wanikani ADD COLUMN ${col}`)
    } catch {
      // column already exists
    }
  }

  for (const col of [
    'meaning_correct INTEGER NOT NULL DEFAULT 0',
    'reading_correct INTEGER NOT NULL DEFAULT 0'
  ]) {
    try {
      await client.execute(`ALTER TABLE progress_wanikani ADD COLUMN ${col}`)
    } catch {
      // column already exists
    }
  }

  return { client, db }
}
