/**
 * Clamp pan translation (origin top-left) so scaled content cannot leave empty
 * gutters past the viewport edges.
 *
 * When content is larger than the viewport: left/top edges cannot move past 0,
 * and right/bottom edges cannot move inside the opposite viewport edge.
 * When content fits inside the viewport: lock that axis to 0 (flush top-left).
 */
export function clampPan(
  x: number,
  y: number,
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  scale: number
): { x: number, y: number } {
  if (viewportW <= 0 || viewportH <= 0 || scale <= 0) {
    return { x: 0, y: 0 }
  }

  const scaledW = contentW * scale
  const scaledH = contentH * scale

  let nextX: number
  let nextY: number

  if (scaledW <= viewportW) {
    nextX = 0
  } else {
    const minX = viewportW - scaledW
    nextX = Math.min(0, Math.max(minX, x))
  }

  if (scaledH <= viewportH) {
    nextY = 0
  } else {
    const minY = viewportH - scaledH
    nextY = Math.min(0, Math.max(minY, y))
  }

  return { x: nextX, y: nextY }
}
