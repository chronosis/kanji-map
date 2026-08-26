import { describe, expect, it } from 'vitest'
import {
  coerceMapUiSettingsForSources,
  colorModeItemsForSources,
  normalizeMapUiSettings,
  orderModeItemsForSources,
  DEFAULT_MAP_UI_SETTINGS
} from '../shared/utils/map-settings'

describe('map-settings', () => {
  it('normalizes missing or invalid cookie payloads', () => {
    expect(normalizeMapUiSettings(null)).toEqual(DEFAULT_MAP_UI_SETTINGS)
    expect(normalizeMapUiSettings({
      kanjiFont: 'mincho',
      defaultOrder: 'strokes',
      defaultColorMode: 'year'
    })).toEqual({
      kanjiFont: 'mincho',
      defaultOrder: 'strokes',
      defaultColorMode: 'year'
    })
    expect(normalizeMapUiSettings({
      kanjiFont: 'comic-sans',
      defaultOrder: 'nope',
      defaultColorMode: 'nope'
    })).toEqual(DEFAULT_MAP_UI_SETTINGS)
  })

  it('coerces WK-gated defaults when WaniKani is unavailable', () => {
    expect(coerceMapUiSettingsForSources({
      kanjiFont: 'gothic',
      defaultOrder: 'srs',
      defaultColorMode: 'accuracy'
    }, false)).toEqual({
      kanjiFont: 'gothic',
      defaultOrder: 'joyo',
      defaultColorMode: 'strokes'
    })

    expect(coerceMapUiSettingsForSources({
      kanjiFont: 'calligraphic',
      defaultOrder: 'wk',
      defaultColorMode: 'wk'
    }, true)).toEqual({
      kanjiFont: 'calligraphic',
      defaultOrder: 'wk',
      defaultColorMode: 'wk'
    })
  })

  it('filters order and color menu items by WK configuration', () => {
    expect(orderModeItemsForSources(false).some(i => i.value === 'srs')).toBe(false)
    expect(orderModeItemsForSources(true).some(i => i.value === 'srs')).toBe(true)
    expect(colorModeItemsForSources(false).some(i => i.value === 'wk')).toBe(false)
    expect(colorModeItemsForSources(true).some(i => i.value === 'wk')).toBe(true)
  })
})
