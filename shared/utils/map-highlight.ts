import type { MapCell } from '../types/kanji'
import { hasApiSrs } from './colors'

export interface MapHighlightFilters {
  highlightGrade: number | 'jh' | null
  highlightSrsMin: number | null
  highlightSrsMax: number | null
  /** Trimmed search query (single radical or kanji, or longer for exact character match). */
  searchQuery: string
}

export function normalizeKanjiSearchQuery(raw: string): string {
  return raw.trim()
}

/** Radical symbols/forms and Jisho parts used for component search. */
export interface KanjiComposition {
  character: string
  radicalSymbol: string | null
  radicalForms: string[]
  parts: string[]
}

export function kanjiCompositionFromCell(cell: MapCell): KanjiComposition {
  return {
    character: cell.character,
    radicalSymbol: cell.radicalSymbol ?? null,
    radicalForms: cell.radicalForms ?? [],
    parts: cell.parts ?? []
  }
}

/** Whether the query matches this kanji directly or as radical/component. */
export function matchesKanjiSearchQuery(query: string, comp: KanjiComposition): boolean {
  const q = normalizeKanjiSearchQuery(query)
  if (!q) return true

  if (comp.character === q || comp.character.includes(q)) return true

  const radicalHits = [comp.radicalSymbol, ...comp.radicalForms].filter(Boolean) as string[]
  if (radicalHits.some(r => r === q || r.includes(q))) return true

  if (comp.parts.some(p => p === q || p.includes(q))) return true

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
  if (q && !matchesKanjiSearchQuery(q, kanjiCompositionFromCell(cell))) {
    return false
  }

  return true
}

export function isMapCellDimmed(cell: MapCell, filters: MapHighlightFilters): boolean {
  return hasActiveMapHighlight(filters) && !isMapCellHighlighted(cell, filters)
}
