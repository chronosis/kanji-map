import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH?.startsWith('file:')
      ? process.env.DATABASE_PATH
      : `file:${process.env.DATABASE_PATH || './data/kanji-map.sqlite'}`
  }
})
