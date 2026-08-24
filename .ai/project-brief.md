# Kanji Map — Project Brief

Personal / self-hosted Nuxt app that maps a learner’s kanji mastery onto the Japanese school literacy corpus (常用漢字 + 教育漢字 grades) combined with community JLPT kanji tags.

## Goals

1. Bootstrap a Nuxt UI app with Docker, pnpm, SQLite, and AI tooling.
2. Show a 40-column pannable grid of kanji colored by SRS stage with accuracy %; click opens Jisho.
3. Sync progress from WaniKani (official API) and BunPro (frontend JWT).
4. Document future browser-extension capture of typed wrong answers (not available from APIs).

## Non-goals (v1)

- Multi-user auth
- Full Cloud Run persistence / deploy pipelines
- Typed wrong-answer logging
