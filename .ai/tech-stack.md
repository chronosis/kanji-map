# Tech Stack

| Layer | Choice |
|-------|--------|
| App | Nuxt 4, Nuxt UI 4, Vue 3, Tailwind 4 |
| Package manager | pnpm 10.34.x, Node ≥ 24 |
| DB | SQLite via Drizzle + `@libsql/client` (local file) |
| Validation | Zod |
| Tests | Vitest |
| Containers | Docker + compose (local); `build/Dockerfile` for Cloud Run |

## External APIs

- **WaniKani**: official Bearer token (`WANIKANI_API_KEY`)
- **BunPro**: unofficial frontend API (`BUNPRO_FRONTEND_JWT` = `frontend_api_token` cookie; often hex, not JWT). Auth: `Token token=…` with Bearer fallback. Settings-page API key does not authorize `/api/frontend`.
