import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import * as schema from '../../drizzle/schema'

export type AppDatabase = LibSQLDatabase<typeof schema>

let client: Client | null = null
let db: AppDatabase | null = null

function resolveDatabasePath(configured: string): string {
  if (configured.startsWith('file:')) return configured
  const absolute = isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
  mkdirSync(dirname(absolute), { recursive: true })
  return `file:${absolute}`
}

export function getDatabasePath(): string {
  try {
    const config = useRuntimeConfig()
    return String(config.databasePath || './data/kanji-map.sqlite')
  } catch {
    return process.env.DATABASE_PATH || './data/kanji-map.sqlite'
  }
}

export function getDb(): AppDatabase {
  if (db) return db
  const url = resolveDatabasePath(getDatabasePath())
  client = createClient({ url })
  db = drizzle(client, { schema })
  return db
}

export function resetDbForTests(): void {
  db = null
  client = null
}

export { schema }
