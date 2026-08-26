/**
 * KanjiVG stroke-order SVG helpers.
 * Data © Ulrich Apel — CC BY-SA 3.0 — https://kanjivg.tagaini.net/
 */

/** Pinned KanjiVG release for stable CDN URLs. */
export const KANJIVG_RELEASE = 'r20250816'

export const KANJIVG_ATTRIBUTION_URL = 'https://kanjivg.tagaini.net/'
export const KANJIVG_ATTRIBUTION_TEXT = 'Stroke order © KanjiVG (CC BY-SA 3.0)'

/**
 * Five-digit lowercase hex Unicode code point used in KanjiVG filenames
 * (e.g. 語 → "08a9e"). Returns null for empty / non-BMP surrogate-only input.
 */
export function kanjiVgCodepoint(character: string): string | null {
  const trimmed = character.trim()
  if (!trimmed) return null
  const cp = trimmed.codePointAt(0)
  if (cp == null) return null
  // Reject if extra code points follow the first character
  if ([...trimmed].length !== 1) return null
  return cp.toString(16).padStart(5, '0')
}

/** jsDelivr URL for the KanjiVG SVG of a single kanji character. */
export function kanjiVgSvgUrl(character: string): string | null {
  const code = kanjiVgCodepoint(character)
  if (!code) return null
  return `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@${KANJIVG_RELEASE}/kanji/${code}.svg`
}

/** Strip XML/DOCTYPE/scripts/kvg attrs so KanjiVG markup can be inlined. */
export function prepareKanjiVgSvgMarkup(raw: string): string {
  return raw
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?\]>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // DOCTYPE normally binds xmlns:kvg; without it, kvg:* attrs break DOMParser.
    .replace(/\s+xmlns:kvg="[^"]*"/gi, '')
    .replace(/\s+kvg:[^\s=]+="[^"]*"/g, '')
    .trim()
}
