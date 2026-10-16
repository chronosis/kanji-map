export type Rgb = readonly [number, number, number]

/** Duration for map cell background blends after a sync or color-mode change. */
export const CELL_COLOR_LERP_MS = 1000

/** Parse `rgb()` / `rgba()` from computed styles. */
export function parseCssRgb(color: string): Rgb | null {
  const match = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (!match) return null
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  ]
}

export function rgbChannelsEqual(a: Rgb, b: Rgb): boolean {
  return Math.round(a[0]) === Math.round(b[0])
    && Math.round(a[1]) === Math.round(b[1])
    && Math.round(a[2]) === Math.round(b[2])
}

const CSS_RGB = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i

/** Write one computed color into preallocated channel buffers. Returns false when the color is not rgb. */
export function readCssRgbChannels(
  color: string,
  slot: number,
  r: Float32Array,
  g: Float32Array,
  b: Float32Array
): boolean {
  const match = CSS_RGB.exec(color)
  if (!match) return false
  r[slot] = Number(match[1])
  g[slot] = Number(match[2])
  b[slot] = Number(match[3])
  return true
}

export function lerpRgbChannel(from: number, to: number, t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return Math.round(from + (to - from) * clamped)
}

export function rgbCss(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`
}

/** Parse `#rgb` / `#rrggbb` into 0–255 channels. */
export function parseHexRgb(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, '')
  if (raw.length === 3) {
    const r = raw[0]!
    const g = raw[1]!
    const b = raw[2]!
    return [
      Number.parseInt(r + r, 16),
      Number.parseInt(g + g, 16),
      Number.parseInt(b + b, 16)
    ]
  }
  if (raw.length !== 6) return null
  const value = Number.parseInt(raw, 16)
  if (Number.isNaN(value)) return null
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Write a hex color into preallocated channel buffers. */
export function readHexRgbChannels(
  hex: string,
  slot: number,
  r: Float32Array,
  g: Float32Array,
  b: Float32Array
): boolean {
  const rgb = parseHexRgb(hex)
  if (!rgb) return false
  r[slot] = rgb[0]
  g[slot] = rgb[1]
  b[slot] = rgb[2]
  return true
}

/** Linear interpolation of an RGB color. `t` is clamped to 0–1. */
export function lerpRgb(from: Rgb, to: Rgb, t: number): string {
  return rgbCss(
    lerpRgbChannel(from[0], to[0], t),
    lerpRgbChannel(from[1], to[1], t),
    lerpRgbChannel(from[2], to[2], t)
  )
}

/** CSS `linear-gradient` from two RGB stops. */
export function gradientBackgroundImage(
  angleDeg: number,
  fromR: number,
  fromG: number,
  fromB: number,
  toR: number,
  toG: number,
  toB: number
): string {
  return `linear-gradient(${angleDeg}deg, ${rgbCss(fromR, fromG, fromB)}, ${rgbCss(toR, toG, toB)})`
}

export interface CellColorBuffers {
  capacity: number
  fromR: Float32Array
  fromG: Float32Array
  fromB: Float32Array
  toR: Float32Array
  toG: Float32Array
  toB: Float32Array
  /** Secondary gradient stop (same as primary when the fill is solid). */
  fromSR: Float32Array
  fromSG: Float32Array
  fromSB: Float32Array
  toSR: Float32Array
  toSG: Float32Array
  toSB: Float32Array
  /** 1 when this slot had a readable color before the update. */
  active: Uint8Array
  /** Packed slots whose color actually changed. */
  jobSlot: Uint16Array
}

export function createCellColorBuffers(capacity: number): CellColorBuffers {
  const size = Math.max(0, capacity)
  return {
    capacity: size,
    fromR: new Float32Array(size),
    fromG: new Float32Array(size),
    fromB: new Float32Array(size),
    toR: new Float32Array(size),
    toG: new Float32Array(size),
    toB: new Float32Array(size),
    fromSR: new Float32Array(size),
    fromSG: new Float32Array(size),
    fromSB: new Float32Array(size),
    toSR: new Float32Array(size),
    toSG: new Float32Array(size),
    toSB: new Float32Array(size),
    active: new Uint8Array(size),
    jobSlot: new Uint16Array(size)
  }
}

/** Grow by doubling when the kanji count exceeds the current allocation. Copies filled channels. */
export function ensureCellColorBuffers(
  existing: CellColorBuffers | null,
  minCapacity: number
): CellColorBuffers {
  if (existing && existing.capacity >= minCapacity) return existing
  const capacity = existing
    ? Math.max(minCapacity, existing.capacity * 2)
    : Math.max(minCapacity, 1)
  const next = createCellColorBuffers(capacity)
  if (!existing) return next
  next.fromR.set(existing.fromR)
  next.fromG.set(existing.fromG)
  next.fromB.set(existing.fromB)
  next.toR.set(existing.toR)
  next.toG.set(existing.toG)
  next.toB.set(existing.toB)
  next.fromSR.set(existing.fromSR)
  next.fromSG.set(existing.fromSG)
  next.fromSB.set(existing.fromSB)
  next.toSR.set(existing.toSR)
  next.toSG.set(existing.toSG)
  next.toSB.set(existing.toSB)
  next.active.set(existing.active)
  return next
}

function primaryChannelsEqual(buffers: CellColorBuffers, slot: number): boolean {
  return Math.round(buffers.fromR[slot]!) === Math.round(buffers.toR[slot]!)
    && Math.round(buffers.fromG[slot]!) === Math.round(buffers.toG[slot]!)
    && Math.round(buffers.fromB[slot]!) === Math.round(buffers.toB[slot]!)
}

function secondaryChannelsEqual(buffers: CellColorBuffers, slot: number): boolean {
  return Math.round(buffers.fromSR[slot]!) === Math.round(buffers.toSR[slot]!)
    && Math.round(buffers.fromSG[slot]!) === Math.round(buffers.toSG[slot]!)
    && Math.round(buffers.fromSB[slot]!) === Math.round(buffers.toSB[slot]!)
}

/** Pack slots whose rounded primary channels differ. Returns how many colors changed. */
export function packChangedColorSlots(buffers: CellColorBuffers, slotCount: number): number {
  const limit = Math.min(slotCount, buffers.capacity)
  let jobs = 0
  for (let slot = 0; slot < limit; slot++) {
    if (buffers.active[slot] === 0) continue
    if (primaryChannelsEqual(buffers, slot)) continue
    buffers.jobSlot[jobs] = slot
    jobs++
  }
  return jobs
}

/** Pack slots whose primary or secondary gradient stops differ. */
export function packChangedGradientSlots(buffers: CellColorBuffers, slotCount: number): number {
  const limit = Math.min(slotCount, buffers.capacity)
  let jobs = 0
  for (let slot = 0; slot < limit; slot++) {
    if (buffers.active[slot] === 0) continue
    if (primaryChannelsEqual(buffers, slot) && secondaryChannelsEqual(buffers, slot)) continue
    buffers.jobSlot[jobs] = slot
    jobs++
  }
  return jobs
}
