/** WaniKani burned stage. Burned items have no next review. */
export const WK_BURNED_STAGE = 9

/**
 * A burned kanji whose assignment has not changed within this window is not
 * polled again. Resurrections of older burns are still picked up by the
 * assignments `updated_after` query.
 */
export const WK_BURNED_QUIET_MS = 30 * 24 * 60 * 60 * 1000

export interface KanjiSrsSnapshot {
  character: string
  subjectId: number
  wkLevel: number | null
  srsStage: number
  /** Next review (`available_at`). Null when burned or not scheduled. */
  availableAt: string | null
  /** Assignment `data_updated_at`. Null until a sync has stored one. */
  updatedAt: string | null
}

export interface KanjiPollPlan {
  /**
   * No stored next-review or update date exists yet, so every kanji at the
   * user's level and below has to be fetched.
   */
  full: boolean
  /** Subject ids whose SRS snapshot says the assignment may have changed. */
  pollSubjectIds: number[]
  skippedBurned: number
  skippedUpcoming: number
}

export function wanikaniLevelList(fromLevel: number, throughLevel: number): number[] {
  const from = Math.max(1, Math.floor(fromLevel))
  const through = Math.min(60, Math.floor(throughLevel))
  if (through < from) return []
  const levels: number[] = []
  for (let level = from; level <= through; level++) levels.push(level)
  return levels
}

export function snapshotsAtOrBelowLevel(
  snapshots: readonly KanjiSrsSnapshot[],
  userLevel: number
): KanjiSrsSnapshot[] {
  return snapshots.filter(row => row.wkLevel == null || row.wkLevel <= userLevel)
}

/** True when this kanji's stored SRS snapshot is enough to skip an API read. */
export function kanjiNeedsPoll(snapshot: KanjiSrsSnapshot, now: number): boolean {
  const hasDate = Boolean(snapshot.availableAt) || Boolean(snapshot.updatedAt)
  if (!hasDate) return true

  if (snapshot.srsStage >= WK_BURNED_STAGE) {
    const updated = Date.parse(snapshot.updatedAt ?? '')
    if (!Number.isFinite(updated)) return true
    return now - updated < WK_BURNED_QUIET_MS
  }

  if (!snapshot.availableAt) return true
  const nextReview = Date.parse(snapshot.availableAt)
  if (!Number.isFinite(nextReview)) return true
  return nextReview <= now
}

/**
 * Decide which kanji to read.
 * With no dates at all, the caller fetches every subject through the user's level.
 */
export function planKanjiPolls(
  snapshots: readonly KanjiSrsSnapshot[],
  now: number
): KanjiPollPlan {
  const dated = snapshots.some(row => row.availableAt || row.updatedAt)
  if (!dated) {
    return { full: true, pollSubjectIds: [], skippedBurned: 0, skippedUpcoming: 0 }
  }

  const pollSubjectIds: number[] = []
  let skippedBurned = 0
  let skippedUpcoming = 0
  for (const row of snapshots) {
    if (row.subjectId <= 0) continue
    if (kanjiNeedsPoll(row, now)) {
      pollSubjectIds.push(row.subjectId)
      continue
    }
    if (row.srsStage >= WK_BURNED_STAGE) skippedBurned++
    else skippedUpcoming++
  }

  return { full: false, pollSubjectIds, skippedBurned, skippedUpcoming }
}

/** Newest stored assignment update, used as the `updated_after` cursor. */
export function latestAssignmentUpdate(snapshots: readonly KanjiSrsSnapshot[]): string | null {
  let latest: string | null = null
  let latestMs = Number.NEGATIVE_INFINITY
  for (const row of snapshots) {
    if (!row.updatedAt) continue
    const ms = Date.parse(row.updatedAt)
    if (Number.isFinite(ms) && ms > latestMs) {
      latestMs = ms
      latest = row.updatedAt
    }
  }
  return latest
}
