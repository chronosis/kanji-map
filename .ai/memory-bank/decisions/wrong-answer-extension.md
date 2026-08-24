# Decision: Wrong-answer extension (future)

## Problem

Goal 3 wants incorrect-answer **text** and frequency analysis. Neither WaniKani nor BunPro APIs store/expose typed answers. WK `GET /reviews` history is empty since 2023; review statistics only expose counts.

## Planned approach

Ship a small **Chrome + Firefox** WebExtension that:

1. Runs on `wanikani.com` / `bunpro.jp` review pages
2. Observes submitted answers (DOM or XHR hooks)
3. POSTs `{ character|subject, promptType, answerText, correct, at }` to this app’s local API (e.g. `POST /api/answers`)

Until then, the app stores incorrect **counts** from WK review statistics only. Do not claim typed-answer logging in the UI.
