import {
  alertFromSyncError,
  alertsFromSyncResult,
  type MapAlert
} from '../../shared/utils/map-alerts'

/**
 * Shared Sync APIs action, alert inbox, and the signal that map cells
 * should blend background colors after the next data refresh.
 */
export function useApiSync() {
  const syncing = useState('kanji-api-syncing', () => false)
  const syncStatus = useState('kanji-api-sync-status', () => '')
  const browsingHistory = useState('kanji-map-browsing-history', () => false)
  const alerts = useState<MapAlert[]>('kanji-map-alerts', () => [])
  const alertsOpen = useState('kanji-map-alerts-open', () => false)
  const selectedAlertId = useState<string | null>('kanji-map-alert-selected', () => null)
  /**
   * Incremented immediately before map data refreshes so the grid can
   * snapshot current cell colors and lerp to the new ones.
   */
  const colorTransitionId = useState('kanji-map-color-transition', () => 0)

  const unreadCount = computed(() => alerts.value.filter(alert => !alert.read).length)

  const selectedAlert = computed(() =>
    alerts.value.find(alert => alert.id === selectedAlertId.value) ?? null
  )

  function pushAlerts(next: MapAlert[]) {
    if (next.length === 0) return
    alerts.value = [...next, ...alerts.value]
  }

  function markAllRead() {
    if (alerts.value.every(alert => alert.read)) return
    alerts.value = alerts.value.map(alert => alert.read ? alert : { ...alert, read: true })
  }

  watch(alertsOpen, (open) => {
    if (open) markAllRead()
  })

  async function runSync() {
    syncing.value = true
    syncStatus.value = 'Starting sync…'
    try {
      const response = await fetch('/api/sync', { method: 'POST' })
      if (!response.ok || !response.body) {
        const text = await response.text()
        throw new Error(text.trim() || 'Sync failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let result: {
        wanikani: number
        bunpro: number
        merged: number
        warnings?: string[]
      } | null = null

      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const event = JSON.parse(trimmed) as {
            type?: string
            message?: string
            result?: {
              wanikani: number
              bunpro: number
              merged: number
              warnings?: string[]
            }
          }
          if (event.type === 'status' && event.message) syncStatus.value = event.message
          if (event.type === 'done' && event.result) result = event.result
          if (event.type === 'error') throw new Error(event.message || 'Sync failed')
        }
      }

      if (!result) throw new Error('Sync ended before it finished')
      pushAlerts(alertsFromSyncResult(result))
      const wasBrowsing = browsingHistory.value
      if (wasBrowsing) await refreshNuxtData()
      const token = colorTransitionId.value + 1
      colorTransitionId.value = token
      browsingHistory.value = false
      if (!wasBrowsing) {
        try {
          await refreshNuxtData()
        } catch (refreshErr) {
          if (colorTransitionId.value === token) colorTransitionId.value = 0
          throw refreshErr
        }
      }
    } catch (err) {
      pushAlerts([
        alertFromSyncError(err instanceof Error ? err.message : 'Sync failed')
      ])
    } finally {
      syncing.value = false
      syncStatus.value = ''
    }
  }

  return {
    syncing,
    syncStatus,
    alerts,
    alertsOpen,
    selectedAlertId,
    selectedAlert,
    unreadCount,
    colorTransitionId,
    runSync
  }
}
