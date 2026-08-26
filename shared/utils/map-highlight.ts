import type { MapCell } from '../types/kanji'
import { hasApiSrs } from './colors'
import { isKanaOnlyQuery, readingsMatchQuery } from './readings'

export interface MapHighlightFilters {
  highlightGrade: number | 'jh' | null
  highlightSrsMin: number | null
  highlightSrsMax: number | null
  /** Trimmed search query (radical, kanji, or kana reading). */
  searchQuery: string
}

export function normalizeKanjiSearchQuery(raw: string): string {
  return raw.trim()
}

/** Fields used for radical / component / reading search. */
export interface KanjiSearchTarget {
  character: string
  radicalSymbol: string | null
  radicalForms: string[]
  parts: string[]
  readings: string[]
}

export function kanjiSearchTargetFromCell(cell: MapCell): KanjiSearchTarget {
  return {
    character: cell.character,
    radicalSymbol: cell.radicalSymbol ?? null,
    radicalForms: cell.radicalForms ?? [],
    parts: cell.parts ?? [],
    readings: cell.readings ?? []
  }
}

/** @deprecated Prefer KanjiSearchTarget / kanjiSearchTargetFromCell */
export type KanjiComposition = Omit<KanjiSearchTarget, 'readings'>

/** @deprecated Prefer kanjiSearchTargetFromCell */
export function kanjiCompositionFromCell(cell: MapCell): KanjiComposition {
  return {
    character: cell.character,
    radicalSymbol: cell.radicalSymbol ?? null,
    radicalForms: cell.radicalForms ?? [],
    parts: cell.parts ?? []
  }
}

/**
 * Whether the query matches this kanji:
 * - kana-only → any on/kun/nanori reading form
 * - otherwise → character, radical, or Jisho component part
 */
export function matchesKanjiSearchQuery(query: string, target: KanjiSearchTarget | KanjiComposition): boolean {
  const q = normalizeKanjiSearchQuery(query)
  if (!q) return true

  if (isKanaOnlyQuery(q)) {
    const readings = 'readings' in target ? target.readings : []
    return readingsMatchQuery(q, readings ?? [])
  }

  if (target.character === q || target.character.includes(q)) return true

  const radicalHits = [target.radicalSymbol, ...target.radicalForms].filter(Boolean) as string[]
  if (radicalHits.some(r => r === q || r.includes(q))) return true

  if (target.parts.some(p => p === q || p.includes(q))) return true

  return false
}

export function hasActiveMapHighlight(filters: MapHighlightFilters): boolean {
  return filters.highlightGrade != null
    || filters.highlightSrsMin != null
    || filters.highlightSrsMax != null
    || normalizeKanjiSearchQuery(filters.searchQuery).length > 0
}

export function isMapCellHighlighted(cell: MapCell, filters: MapHighlightFilters): boolean {
  if (filters.highlightGrade === 'jh') {
    if (!(cell.inJoyoo && cell.schoolGrade == null)) return false
  } else if (filters.highlightGrade != null && cell.schoolGrade !== filters.highlightGrade) {
    return false
  }

  if (filters.highlightSrsMin === -1 && filters.highlightSrsMax === -1) {
    if (hasApiSrs(cell.sources, cell.srsAvg)) return false
  } else if (filters.highlightSrsMin != null || filters.highlightSrsMax != null) {
    if (!hasApiSrs(cell.sources, cell.srsAvg)) return false
    if (filters.highlightSrsMin != null && (cell.srsAvg ?? 0) < filters.highlightSrsMin) return false
    if (filters.highlightSrsMax != null && (cell.srsAvg ?? 0) > filters.highlightSrsMax) return false
  }

  const q = normalizeKanjiSearchQuery(filters.searchQuery)
  if (q && !matchesKanjiSearchQuery(q, kanjiSearchTargetFromCell(cell))) {
    return false
  }

  return true
}

export function isMapCellDimmed(cell: MapCell, filters: MapHighlightFilters): boolean {
  return hasActiveMapHighlight(filters) && !isMapCellHighlighted(cell, filters)
}
