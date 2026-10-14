import { z } from 'zod'
import { ensureSeeded } from '../../utils/sync'
import { readMapSnapshot } from '../../utils/map-snapshots'

const SnapshotId = z.coerce.number().int().positive()

export default defineEventHandler(async (event) => {
  const parsed = SnapshotId.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid snapshot' })
  }

  const config = useRuntimeConfig()
  await ensureSeeded(String(config.databasePath || './data/kanji-map.sqlite'))
  const snapshot = await readMapSnapshot(parsed.data)
  if (!snapshot) {
    throw createError({ statusCode: 404, statusMessage: 'Snapshot not found' })
  }
  return snapshot
})
