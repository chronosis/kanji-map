# Future: wrong-answer capture extension

## Why

- WaniKani API never stores typed wrong answers — only incorrect counts.
- `GET /v2/reviews` history has been empty since April 2023.
- BunPro frontend API does not reliably expose typed wrong answers.

## Planned approach

1. Browser extension (Chrome MV3 + Firefox) with content scripts on `wanikani.com` and `bunpro.jp`.
2. On review submit / answer-check events, capture: character or vocab, prompt type (meaning/reading), typed answer, correct/incorrect, timestamp.
3. POST to local Kanji Map `POST /api/review-events` (to be added) when the app is running.
4. Optional SQLite table `review_events` for leech / confusion analysis.

## Non-goals for v1

No extension ships in this milestone — documentation only.
