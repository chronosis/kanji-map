import { syncAllProgress } from '../utils/sync'

export default defineEventHandler(async () => {
  try {
    return await syncAllProgress()
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    console.error(err)
    throw createError({
      statusCode: 502,
      statusMessage: err instanceof Error ? err.message : 'Sync failed'
    })
  }
})
