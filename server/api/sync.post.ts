import { syncAllProgress, type SyncStatusReporter } from '../utils/sync'

type SyncEvent
  = { type: 'status', message: string }
    | { type: 'done', result: Awaited<ReturnType<typeof syncAllProgress>> }
    | { type: 'error', message: string }

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: SyncEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }
      const onStatus: SyncStatusReporter = (message) => {
        send({ type: 'status', message })
      }
      try {
        const result = await syncAllProgress(onStatus, {
          databasePath: String(config.databasePath || ''),
          wanikaniApiKey: String(config.wanikaniApiKey || ''),
          bunproFrontendJwt: String(config.bunproFrontendJwt || '')
        })
        send({ type: 'done', result })
      } catch (err) {
        console.error(err)
        const message = err instanceof Error ? err.message : 'Sync failed'
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    }
  })

  setResponseHeader(event, 'Content-Type', 'application/x-ndjson; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')
  return stream
})
