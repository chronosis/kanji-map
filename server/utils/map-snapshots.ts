import { desc, eq } from 'drizzle-orm'
import { mapSnapshots, progressMerged } from '../../drizzle/schema'
import type { MapCell } from '../../shared/types/kanji'
import {
  mapSnapshotSignature,
  nextSnapshotAction,
  parseMapSnapshotState,
  toSnapshotCells,
  type MapSnapshotCell,
  type MapSnapshotSummary
} from '../../shared/utils/map-snapshot'
import { getDb } from './db'

async function latestProgressTime(): Promise<string> {
  const db = getDb()
  const [row] = await db.select({ syncedAt: progressMerged.syncedAt })
    .from(progressMerged)
    .orderBy(desc(progressMerged.syncedAt))
    .limit(1)
  return row?.syncedAt || new Date().toISOString()
}

/** The current map is the first snapshot, so the history controls are present before the next sync. */
export async function ensureOpeningSnapshot(cells: readonly MapCell[]): Promise<MapSnapshotSummary[]> {
  const existing = await listMapSnapshots()
  if (existing.length > 0) return existing
  await recordMapSnapshot(cells, await latestProgressTime())
  return listMapSnapshots()
}

/** Keep the newest copy when consecutive snapshots show the same colors and order. */
export async function collapseIdenticalSnapshots() {
  const db = getDb()
  const rows = await db.select({
    id: mapSnapshots.id,
    stateJson: mapSnapshots.stateJson
  }).from(mapSnapshots).orderBy(mapSnapshots.id)

  let previousSignature: string | null = null
  let previousId: number | null = null
  for (const row of rows) {
    const cells = parseMapSnapshotState(row.stateJson)
    const signature = cells ? mapSnapshotSignature(cells) : null
    if (signature && signature === previousSignature && previousId != null) {
      await db.delete(mapSnapshots).where(eq(mapSnapshots.id, previousId))
    }
    if (signature) {
      previousSignature = signature
      previousId = row.id
    }
  }
}

export async function listMapSnapshots(): Promise<MapSnapshotSummary[]> {
  await collapseIdenticalSnapshots()
  const db = getDb()
  return db.select({
    id: mapSnapshots.id,
    capturedAt: mapSnapshots.capturedAt
  }).from(mapSnapshots).orderBy(mapSnapshots.id)
}

export async function readMapSnapshot(id: number): Promise<{
  id: number
  capturedAt: string
  cells: MapSnapshotCell[]
} | null> {
  const db = getDb()
  const [row] = await db.select().from(mapSnapshots).where(eq(mapSnapshots.id, id)).limit(1)
  if (!row) return null
  const cells = parseMapSnapshotState(row.stateJson)
  if (!cells) return null
  return { id: row.id, capturedAt: row.capturedAt, cells }
}

/** Insert a map view, or move the latest snapshot's timestamp forward when nothing changed. */
export async function recordMapSnapshot(cells: readonly MapCell[], capturedAt: string) {
  const db = getDb()
  const next = toSnapshotCells(cells)
  const [last] = await db.select({
    id: mapSnapshots.id,
    stateJson: mapSnapshots.stateJson
  }).from(mapSnapshots).orderBy(desc(mapSnapshots.id)).limit(1)

  const previous = last ? parseMapSnapshotState(last.stateJson) : null
  if (last && nextSnapshotAction(previous, next) === 'touch') {
    await db.update(mapSnapshots).set({ capturedAt }).where(eq(mapSnapshots.id, last.id))
    return
  }

  await db.insert(mapSnapshots).values({
    capturedAt,
    stateJson: JSON.stringify(next)
  })
}
