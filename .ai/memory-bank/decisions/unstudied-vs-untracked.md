# Unstudied vs untracked

These names are **exclusive** for greys with no positive SRS. Do not confuse “no progress row” with “not in WaniKani.”

| Term | Predicate | Meaning | Visual |
|------|-----------|---------|--------|
| **Unstudied** | `inWanikani && !hasPositiveSrs` | Character is in WaniKani’s **kanji subject catalog**, but the learner has no positive SRS yet (SRS 0 / locked / not started). | Neutral-400, **no** blue outline, `--` |
| **Untracked** | `!inWanikani` | Character is on the map (jōyō / school **or** JLPT-only extra) but **absent from WaniKani’s catalog**, so it will never get a WK SRS. | Neutral-500, **light blue** outline, `--` |

## Critical: catalog ≠ assignment

`inWanikani` is stamped onto `kanji_ref` during **Sync APIs** from WaniKani kanji subjects at the user’s current level and below (including subjects the user has not started). Higher levels are not downloaded until the account reaches them.

It is **wrong** to treat “missing `progress_merged` / SRS null” as untracked. That is usually **unstudied** once the catalog has been synced.

After a correct WK sync you should see WaniKani kanji from level 1 through the account level in `progress_wanikani`, and `kanji_ref.in_wanikani = 1` for those that appear on the map.

## Rules

1. Blue outline = **untracked only** (`km-untracked`).
2. Positive SRS (WK and/or BunPro) always wins — normal SRS / accuracy colors.
3. Classification reads `MapCell.inWanikani` from `kanji_ref` (with a progress-row fallback only for pre-migration DBs).

## CSS classes

- `.km-unstudied` — unstudied (and other non-untracked greys)
- `.km-untracked` — untracked

## WK order mode

Sort key: **WaniKani level** → **`wkApiOrder` (API response appearance)** → code point.

Untracked cells sort last; their `gridIndex` starts at **9000**.
