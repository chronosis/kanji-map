# Architecture

```
.env → Nuxt server (runtimeConfig)
         ├─ adapters/wanikani.ts → WaniKani API v2
         ├─ adapters/bunpro.ts   → BunPro frontend API
         ├─ utils/db.ts          → SQLite (Drizzle)
         └─ api/map, api/sync    → JSON for the grid UI
data/kanji-union.json → seed → kanji_ref
```

- Client never holds API keys.
- Sync upserts per-source progress then materializes `progress_merged` (averages).
- Grid order: school grade → JLPT (N5→N1) → code point; 40 columns.
