# WaniKani sync only reads what can change

Sync asks `/user` for the account level and requests kanji subjects, assignments, and review stats at that level and below.

Each stored assignment keeps `available_at` (next review) and `data_updated_at`. The next sync:

- Fetches every kanji through the account level when no snapshot has either date yet.
- Skips a kanji whose next review is still in the future.
- Skips a burned kanji (SRS 9) whose assignment has not changed in 30 days.
- Still asks WaniKani for assignments updated after the newest stored `data_updated_at`, so a resurrected burn is not missed.
- Refetches subjects only when the account level moves past the level already catalogued.

Status text for each of those steps is streamed to the Sync button.
