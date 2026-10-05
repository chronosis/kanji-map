import type { ColorMode, OrderMode } from '../types/kanji'

/** Kanji glyph typeface for the map / detail modal. */
export type KanjiFontStyle = 'gothic' | 'mincho' | 'calligraphic'

export interface MapUiSettings {
  kanjiFont: KanjiFontStyle
  defaultOrder: OrderMode
  defaultColorMode: ColorMode
}

export const MAP_SETTINGS_COOKIE = 'kanji-map-settings'

export const DEFAULT_MAP_UI_SETTINGS: Readonly<MapUiSettings> = {
  kanjiFont: 'gothic',
  defaultOrder: 'joyo',
  defaultColorMode: 'none'
}

export const KANJI_FONT_STYLE_ITEMS: ReadonlyArray<{ label: string, value: KanjiFontStyle }> = [
  { label: 'Gothic', value: 'gothic' },
  { label: 'Mincho', value: 'mincho' },
  { label: 'Calligraphic', value: 'calligraphic' }
]

export const ALL_ORDER_MODE_ITEMS: ReadonlyArray<{ label: string, value: OrderMode }> = [
  { label: 'Jōyō appearance', value: 'joyo' },
  { label: 'JLPT level', value: 'jlpt' },
  { label: 'WaniKani order', value: 'wk' },
  { label: 'SRS stage', value: 'srs' },
  { label: 'Usage (frequency)', value: 'usage' },
  { label: 'Accuracy', value: 'accuracy' },
  { label: 'WK total attempts (meaning)', value: 'wk-meaning-attempts' },
  { label: 'WK total attempts (reading)', value: 'wk-reading-attempts' },
  { label: 'Number of readings', value: 'readings' },
  { label: 'Stroke count', value: 'strokes' }
]

export const ALL_COLOR_MODE_ITEMS: ReadonlyArray<{ label: string, value: ColorMode }> = [
  { label: '--', value: 'none' },
  { label: 'School year', value: 'year' },
  { label: 'JLPT level', value: 'jlpt' },
  { label: 'SRS stage', value: 'srs' },
  { label: 'Accuracy (Overall)', value: 'accuracy' },
  { label: 'Accuracy (Meaning)', value: 'accuracy-meaning' },
  { label: 'Accuracy (Reading)', value: 'accuracy-reading' },
  { label: 'WaniKani level', value: 'wk' },
  { label: 'WaniKani level groups', value: 'wk-group' },
  { label: 'Stroke count', value: 'strokes' },
  { label: 'Reading count', value: 'readings' }
]

export const WK_GATED_COLOR_MODES: ReadonlySet<ColorMode> = new Set([
  'srs',
  'accuracy',
  'accuracy-meaning',
  'accuracy-reading',
  'wk',
  'wk-group'
])
export const WK_GATED_ORDER_MODES: ReadonlySet<OrderMode> = new Set([
  'srs',
  'accuracy',
  'wk-meaning-attempts',
  'wk-reading-attempts'
])

const KANJI_FONT_STYLES: ReadonlySet<string> = new Set(['gothic', 'mincho', 'calligraphic'])
const ORDER_MODES: ReadonlySet<string> = new Set(ALL_ORDER_MODE_ITEMS.map(i => i.value))
const COLOR_MODES: ReadonlySet<string> = new Set(ALL_COLOR_MODE_ITEMS.map(i => i.value))

export function isKanjiFontStyle(value: unknown): value is KanjiFontStyle {
  return typeof value === 'string' && KANJI_FONT_STYLES.has(value)
}

export function isOrderMode(value: unknown): value is OrderMode {
  return typeof value === 'string' && ORDER_MODES.has(value)
}

export function isColorMode(value: unknown): value is ColorMode {
  return typeof value === 'string' && COLOR_MODES.has(value)
}

/** Normalize partial / stale cookie payloads into a full settings object. */
export function normalizeMapUiSettings(raw: unknown): MapUiSettings {
  const input = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  return {
    kanjiFont: isKanjiFontStyle(input.kanjiFont)
      ? input.kanjiFont
      : DEFAULT_MAP_UI_SETTINGS.kanjiFont,
    defaultOrder: isOrderMode(input.defaultOrder)
      ? input.defaultOrder
      : DEFAULT_MAP_UI_SETTINGS.defaultOrder,
    defaultColorMode: isColorMode(input.defaultColorMode)
      ? input.defaultColorMode
      : DEFAULT_MAP_UI_SETTINGS.defaultColorMode
  }
}

/** Drop WK-gated defaults when no API key is configured. */
export function coerceMapUiSettingsForSources(
  settings: MapUiSettings,
  wanikaniConfigured: boolean
): MapUiSettings {
  if (wanikaniConfigured) return settings
  return {
    ...settings,
    defaultOrder: WK_GATED_ORDER_MODES.has(settings.defaultOrder)
      ? DEFAULT_MAP_UI_SETTINGS.defaultOrder
      : settings.defaultOrder,
    defaultColorMode: WK_GATED_COLOR_MODES.has(settings.defaultColorMode)
      ? 'strokes'
      : settings.defaultColorMode
  }
}

export function orderModeItemsForSources(wanikaniConfigured: boolean) {
  if (wanikaniConfigured) return [...ALL_ORDER_MODE_ITEMS]
  return ALL_ORDER_MODE_ITEMS.filter(item => !WK_GATED_ORDER_MODES.has(item.value))
}

export function colorModeItemsForSources(wanikaniConfigured: boolean) {
  if (wanikaniConfigured) return [...ALL_COLOR_MODE_ITEMS]
  return ALL_COLOR_MODE_ITEMS.filter(item => !WK_GATED_COLOR_MODES.has(item.value))
}
