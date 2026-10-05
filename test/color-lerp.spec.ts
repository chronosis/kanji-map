import { describe, expect, it } from 'vitest'
import {
  createCellColorBuffers,
  ensureCellColorBuffers,
  lerpRgb,
  packChangedColorSlots,
  parseCssRgb,
  readCssRgbChannels,
  rgbChannelsEqual
} from '../shared/utils/color-lerp'

describe('color-lerp', () => {
  it('parses computed rgb colors', () => {
    expect(parseCssRgb('rgb(163, 163, 163)')).toEqual([163, 163, 163])
    expect(parseCssRgb('rgba(252, 165, 165, 1)')).toEqual([252, 165, 165])
    expect(parseCssRgb('red')).toBeNull()
  })

  it('linearly interpolates RGB over t', () => {
    const from = [0, 0, 0] as const
    const to = [100, 50, 0] as const
    expect(lerpRgb(from, to, 0)).toBe('rgb(0, 0, 0)')
    expect(lerpRgb(from, to, 0.5)).toBe('rgb(50, 25, 0)')
    expect(lerpRgb(from, to, 1)).toBe('rgb(100, 50, 0)')
    expect(lerpRgb(from, to, 2)).toBe('rgb(100, 50, 0)')
  })

  it('reuses color buffers and packs only slots whose channels changed', () => {
    const first = createCellColorBuffers(2)
    first.fromR[0] = 10
    expect(ensureCellColorBuffers(first, 2)).toBe(first)

    const grown = ensureCellColorBuffers(first, 3)
    expect(grown.capacity).toBe(4)
    expect(grown.fromR[0]).toBe(10)

    const buffers = createCellColorBuffers(3)
    expect(readCssRgbChannels('rgb(1, 2, 3)', 0, buffers.fromR, buffers.fromG, buffers.fromB)).toBe(true)
    buffers.toR[0] = 9
    buffers.toG[0] = 2
    buffers.toB[0] = 3
    buffers.active[0] = 1
    buffers.fromR[1] = 4
    buffers.toR[1] = 4.2
    buffers.active[1] = 1
    buffers.fromR[2] = 1
    buffers.toR[2] = 8
    buffers.active[2] = 0

    expect(packChangedColorSlots(buffers, 3)).toBe(1)
    expect(buffers.jobSlot[0]).toBe(0)
    expect(readCssRgbChannels('red', 0, buffers.fromR, buffers.fromG, buffers.fromB)).toBe(false)
  })

  it('treats rounded channels as equal', () => {
    expect(rgbChannelsEqual([1.2, 2.4, 3.6], [1, 2, 4])).toBe(true)
    expect(rgbChannelsEqual([1, 2, 3], [2, 2, 3])).toBe(false)
  })
})
