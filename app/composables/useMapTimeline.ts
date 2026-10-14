import type { MapCell } from '../../shared/types/kanji'
import {
  applyMapSnapshot,
  type MapSnapshotCell,
  type MapSnapshotSummary
} from '../../shared/utils/map-snapshot'
import { alertFromSyncError, type MapAlert } from '../../shared/utils/map-alerts'

interface MapResponse {
  cells: MapCell[]
  columns: number
  snapshots?: MapSnapshotSummary[]
  sourcesConfigured?: { wanikani: boolean, bunpro: boolean }
}

/**
 * Live map data plus back/forward snapshot stepping.
 * The newest snapshot is the live map. Older ones overlay stored progress.
 */
export async function useMapTimeline() {
  const pendingFetch = useFetch<MapResponse>('/api/map')
  const { data, pending, error, refresh } = pendingFetch
  const { colorTransitionId, syncing } = useApiSync()
  const alerts = useState<MapAlert[]>('kanji-map-alerts', () => [])

  const snapshotIndex = useState<number | null>('kanji-map-snapshot-index', () => null)
  const browsingHistory = useState('kanji-map-browsing-history', () => false)
  const overlays = useState<Record<number, MapSnapshotCell[]>>('kanji-map-snapshot-overlays', () => ({}))
  const stepping = useState('kanji-map-snapshot-stepping', () => false)

  const snapshots = computed(() => data.value?.snapshots ?? [])

  const activeIndex = computed(() => {
    const list = snapshots.value
    if (list.length === 0) return -1
    if (!browsingHistory.value || snapshotIndex.value == null) return list.length - 1
    return Math.min(Math.max(snapshotIndex.value, 0), list.length - 1)
  })

  const activeSnapshot = computed(() => snapshots.value[activeIndex.value] ?? null)
  const atOldest = computed(() => snapshots.value.length === 0 || activeIndex.value <= 0)
  const atNewest = computed(() => {
    const list = snapshots.value
    return list.length === 0 || activeIndex.value >= list.length - 1
  })

  const viewCells = computed(() => {
    const cells = data.value?.cells ?? []
    if (!browsingHistory.value) return cells
    const snap = snapshots.value[activeIndex.value]
    const overlay = snap ? overlays.value[snap.id] : undefined
    if (!overlay) return cells
    return applyMapSnapshot(cells, overlay)
  })

  function rememberOverlay(id: number, cells: MapSnapshotCell[]) {
    overlays.value = { ...overlays.value, [id]: cells }
  }

  async function stepSnapshot(direction: -1 | 1) {
    const list = snapshots.value
    if (list.length === 0 || stepping.value || syncing.value) return
    const next = activeIndex.value + direction
    if (next < 0 || next >= list.length) return
    const target = list[next]
    if (!target) return

    stepping.value = true
    try {
      if (next < list.length - 1 && !overlays.value[target.id]) {
        const payload = await $fetch<{ cells: MapSnapshotCell[] }>(`/api/snapshots/${target.id}`)
        rememberOverlay(target.id, payload.cells)
      }
      colorTransitionId.value += 1
      snapshotIndex.value = next
      browsingHistory.value = next < list.length - 1
    } catch (err) {
      alerts.value = [
        alertFromSyncError(err instanceof Error ? err.message : 'Could not open that snapshot'),
        ...alerts.value
      ]
    } finally {
      stepping.value = false
    }
  }

  await pendingFetch

  return {
    data,
    pending,
    error,
    refresh,
    viewCells,
    snapshots,
    activeSnapshot,
    atOldest,
    atNewest,
    stepping,
    stepSnapshot
  }
}
