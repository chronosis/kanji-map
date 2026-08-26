import {
  MAP_SETTINGS_COOKIE,
  normalizeMapUiSettings,
  type KanjiFontStyle,
  type MapUiSettings
} from '../../shared/utils/map-settings'
import type { ColorMode, OrderMode } from '../../shared/types/kanji'

/**
 * Cookie-backed UI preferences (kanji font, default order, default color mode).
 */
export function useMapSettings() {
  const settingsCookie = useCookie<MapUiSettings>(MAP_SETTINGS_COOKIE, {
    default: () => normalizeMapUiSettings(null),
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    watch: true
  })

  const settings = computed({
    get: () => normalizeMapUiSettings(settingsCookie.value),
    set: (next: MapUiSettings) => {
      settingsCookie.value = normalizeMapUiSettings(next)
    }
  })

  const kanjiFont = computed({
    get: () => settings.value.kanjiFont,
    set: (kanjiFont: KanjiFontStyle) => {
      settings.value = { ...settings.value, kanjiFont }
    }
  })

  const defaultOrder = computed({
    get: () => settings.value.defaultOrder,
    set: (defaultOrder: OrderMode) => {
      settings.value = { ...settings.value, defaultOrder }
    }
  })

  const defaultColorMode = computed({
    get: () => settings.value.defaultColorMode,
    set: (defaultColorMode: ColorMode) => {
      settings.value = { ...settings.value, defaultColorMode }
    }
  })

  function applyKanjiFontToDocument(font: KanjiFontStyle = kanjiFont.value) {
    if (!import.meta.client) return
    document.documentElement.dataset.kanjiFont = font
  }

  watch(kanjiFont, (font) => {
    applyKanjiFontToDocument(font)
  }, { immediate: true })

  onMounted(() => {
    applyKanjiFontToDocument()
  })

  return {
    settings,
    kanjiFont,
    defaultOrder,
    defaultColorMode,
    applyKanjiFontToDocument
  }
}
