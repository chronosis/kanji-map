# Unstudied vs untracked

These names are **exclusive** for curriculum-related greys. Do not confuse “no progress row” with “not in WaniKani.”

| Term | Predicate | Meaning | Visual |
|------|-----------|---------|--------|
| **Unstudied** | `inWanikani && !hasPositiveSrs` | Character is in WaniKani’s **kanji subject catalog**, but the learner has no positive SRS yet (SRS 0 / locked / not started). | Neutral-400, **no** blue outline, `--` |
| **Untracked** | `isCurriculum && !inWanikani` | Character is on the MEXT / 常用漢字 list but **absent from WaniKani’s catalog**, so it will never get a WK SRS. | Neutral-500, **light blue** outline, `--` |

`isCurriculum` = `inJoyoo || schoolGrade != null`.

## Critical: catalog ≠ assignment

`inWanikani` is stamped onto `kanji_ref` during **Sync APIs** from the full `/subjects?types=kanji` list (including subjects the user has not unlocked).

It is **wrong** to treat “missing `progress_merged` / SRS null” as untracked. That is usually **unstudied** once the catalog has been synced.

After a correct WK sync you should see on the order of **~2000** WaniKani kanji subjects in `progress_wanikani`, and `kanji_ref.in_wanikani = 1` for those that appear on the map.

## Rules

1. Blue outline = **untracked only** (`km-untracked`).
2. Positive SRS (WK and/or BunPro) always wins — normal SRS / accuracy colors.
3. Classification reads `MapCell.inWanikani` from `kanji_ref` (with a progress-row fallback only for pre-migration DBs).

## CSS classes

- `.km-unstudied` — unstudied (and non-curriculum greys)
- `.km-untracked` — untracked

## WK order mode

Sort key: **WaniKani level** → **`wkApiOrder` (API response appearance)** → code point.

Untracked cells sort last; their `gridIndex` starts at **9000**.
