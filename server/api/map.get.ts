import { getMapCells, ensureSeeded } from '../utils/sync'
import { DEFAULT_GRID_COLUMNS } from '../../shared/utils/grid-columns'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  await ensureSeeded(String(config.databasePath || './data/kanji-map.sqlite'))
  const cells = await getMapCells()
  return {
    columns: DEFAULT_GRID_COLUMNS,
    total: cells.length,
    cells,
    /** Which external APIs have credentials configured (never exposes the secrets). */
    sourcesConfigured: {
      wanikani: Boolean(String(config.wanikaniApiKey || '').trim()),
      bunpro: Boolean(String(config.bunproFrontendJwt || '').trim())
    }
  }
})
