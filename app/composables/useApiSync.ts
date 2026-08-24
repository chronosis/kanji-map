/**
 * Shared Sync APIs action for the header + page status line.
 */
export function useApiSync() {
  const syncing = useState('kanji-api-syncing', () => false)
  const syncMessage = useState('kanji-api-sync-message', () => '')

  async function runSync() {
    syncing.value = true
    syncMessage.value = ''
    try {
      const result = await $fetch<{
        wanikani: number
        bunpro: number
        merged: number
        warnings?: string[]
      }>('/api/sync', {
        method: 'POST'
      })
      const warn = result.warnings?.length ? ` · ${result.warnings.join(' · ')}` : ''
      syncMessage.value = `Synced WK ${result.wanikani}, BunPro ${result.bunpro}, merged ${result.merged}${warn}`
      await refreshNuxtData()
    } catch (err) {
      syncMessage.value = err instanceof Error ? err.message : 'Sync failed'
    } finally {
      syncing.value = false
    }
  }

  return { syncing, syncMessage, runSync }
}
