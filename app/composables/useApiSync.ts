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
    try {
      const result = await $fetch<{
        wanikani: number
        bunpro: number
        merged: number
        warnings?: string[]
      }>('/api/sync', {
        method: 'POST'
      })
      pushAlerts(alertsFromSyncResult(result))
      const token = colorTransitionId.value + 1
      colorTransitionId.value = token
      try {
        await refreshNuxtData()
      } catch (refreshErr) {
        if (colorTransitionId.value === token) colorTransitionId.value = 0
        throw refreshErr
      }
    } catch (err) {
      pushAlerts([
        alertFromSyncError(err instanceof Error ? err.message : 'Sync failed')
      ])
    } finally {
      syncing.value = false
    }
  }

  return {
    syncing,
    alerts,
    alertsOpen,
    selectedAlertId,
    selectedAlert,
    unreadCount,
    colorTransitionId,
    runSync
  }
}
