import { describe, expect, it } from 'vitest'
import { clampPan } from '../shared/utils/pan-clamp'

describe('clampPan', () => {
  it('locks axes when content fits inside the viewport', () => {
    expect(clampPan(40, -20, 400, 300, 200, 100, 1)).toEqual({ x: 0, y: 0 })
  })

  it('clamps horizontal pan when content is wider than viewport', () => {
    // content 800, viewport 400 → x in [-400, 0]
    expect(clampPan(50, 0, 400, 300, 800, 200, 1)).toEqual({ x: 0, y: 0 })
    expect(clampPan(-500, 0, 400, 300, 800, 200, 1)).toEqual({ x: -400, y: 0 })
    expect(clampPan(-100, 0, 400, 300, 800, 200, 1)).toEqual({ x: -100, y: 0 })
  })

  it('clamps vertical pan when content is taller than viewport', () => {
    expect(clampPan(0, 20, 400, 300, 200, 800, 1)).toEqual({ x: 0, y: 0 })
    expect(clampPan(0, -600, 400, 300, 200, 800, 1)).toEqual({ x: 0, y: -500 })
  })

  it('respects scale when computing bounds', () => {
    // content 400 * scale 2 = 800 vs viewport 400 → minX -400
    expect(clampPan(-450, 0, 400, 300, 400, 100, 2)).toEqual({ x: -400, y: 0 })
  })
})
