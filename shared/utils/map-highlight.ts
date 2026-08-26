import type { JlptLevel, MapCell } from '../types/kanji'
import { hasApiSrs, WANIKANI_MAX_LEVEL } from './colors'
import { isJlptLevel } from './kanji-order'
import { isKanaOnlyQuery, readingsMatchQuery } from './readings'

/** Inclusive SRS band; unstudied is encoded as min=max=-1. */
export interface HighlightSrsBand {
  min: number
  max: number
}

export type HighlightGrade = number | 'jh'

export interface MapHighlightFilters {
  /** Empty = no school-year highlight. Match is OR within the list. */
  highlightGrades: HighlightGrade[]
  /** Empty = no JLPT highlight. Match is OR within the list. */
  highlightJlptLevels: JlptLevel[]
  /** Empty = no SRS highlight. Match is OR within the list. */
  highlightSrsBands: HighlightSrsBand[]
  /** Empty = no WK-level highlight. Match is OR within the list. */
  highlightWkLevels: number[]
  /** Trimmed search query (radical, kanji, or kana reading). */
  searchQuery: string
}

/** Prefixed option values used by the Highlight multi-select. */
export type HighlightOptionValue
  = | `year:${1 | 2 | 3 | 4 | 5 | 6 | 'jh'}`
    | `jlpt:${JlptLevel}`
    | `srs:unstudied`
    | `srs:1-4`
    | `srs:5-9`
    | `srs:9-9`
    | `wk:${number}`

export interface HighlightMenuItem {
  label: string
  value: HighlightOptionValue
}

export interface HighlightMenuGroup {
  type: 'label'
  label: string
}

export type HighlightCategoryId = 'year' | 'jlpt' | 'srs' | 'wk'

export const HIGHLIGHT_CATEGORY_LABELS: Readonly<Record<HighlightCategoryId, string>> = {
  year: 'School year',
  jlpt: 'JLPT level',
  srs: 'SRS stage',
  wk: 'WaniKani level'
}

export type HighlightCollapsedCategories = Record<HighlightCategoryId, boolean>

export function defaultHighlightCollapsedCategories(): HighlightCollapsedCategories {
  return { year: false, jlpt: false, srs: false, wk: true }
}

/** Clickable category header inside the Highlight select menu. */
export interface HighlightCategoryHeaderItem {
  label: string
  value: `__header:${HighlightCategoryId}`
  icon: string
  category: HighlightCategoryId
  isCategoryHeader: true
}

/** Nuxt UI SelectMenu nested group: header / label row + options. */
export type HighlightMenuSection = Array<
  HighlightMenuGroup | HighlightMenuItem | HighlightCategoryHeaderItem
>

export function isHighlightCategoryHeaderValue(
  value: string
): value is HighlightCategoryHeaderItem['value'] {
  return value === '__header:year'
    || value === '__header:jlpt'
    || value === '__header:srs'
    || value === '__header:wk'
}

export function parseHighlightCategoryHeaderValue(value: string): HighlightCategoryId | null {
  if (!isHighlightCategoryHeaderValue(value)) return null
  return value.slice('__header:'.length) as HighlightCategoryId
}

export function highlightCategoryHeaderItem(
  category: HighlightCategoryId,
  collapsed: boolean
): HighlightCategoryHeaderItem {
  return {
    label: HIGHLIGHT_CATEGORY_LABELS[category],
    value: `__header:${category}`,
    icon: collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down',
    category,
    isCategoryHeader: true
  }
}

export const HIGHLIGHT_YEAR_OPTIONS: readonly HighlightMenuItem[] = [
  { label: '小1', value: 'year:1' },
  { label: '小2', value: 'year:2' },
  { label: '小3', value: 'year:3' },
  { label: '小4', value: 'year:4' },
  { label: '小5', value: 'year:5' },
  { label: '小6', value: 'year:6' },
  { label: '中学+ (jōyō)', value: 'year:jh' }
] as const

export const HIGHLIGHT_JLPT_OPTIONS: readonly HighlightMenuItem[] = [
  { label: 'N5', value: 'jlpt:N5' },
  { label: 'N4', value: 'jlpt:N4' },
  { label: 'N3', value: 'jlpt:N3' },
  { label: 'N2', value: 'jlpt:N2' },
  { label: 'N1', value: 'jlpt:N1' }
] as const

export const HIGHLIGHT_SRS_OPTIONS: readonly HighlightMenuItem[] = [
  { label: 'Unstudied', value: 'srs:unstudied' },
  { label: 'Apprentice (1–4)', value: 'srs:1-4' },
  { label: 'Guru+ (5–9)', value: 'srs:5-9' },
  { label: 'Burned (9)', value: 'srs:9-9' }
] as const

export const HIGHLIGHT_WK_LEVEL_OPTIONS: readonly HighlightMenuItem[] = Array.from(
  { length: WANIKANI_MAX_LEVEL },
  (_, i) => {
    const level = i + 1
    return {
      label: `Level ${level}`,
      value: `wk:${level}` as HighlightOptionValue
    }
  }
)

/** Grouped items for USelectMenu (array-of-arrays with label headings). */
export function buildHighlightMenuItems(options?: {
  includeSrs?: boolean
  includeWkLevels?: boolean
}): HighlightMenuSection[] {
  return buildCollapsibleHighlightMenuItems({
    ...options,
    collapsed: { year: false, jlpt: false, srs: false, wk: false }
  }).map(section => section.map((item) => {
    if ('isCategoryHeader' in item && item.isCategoryHeader) {
      return { type: 'label' as const, label: item.label }
    }
    return item
  })) as HighlightMenuSection[]
}

/** Grouped items with collapsible category headers (used by HighlightSelectMenu). */
export function buildCollapsibleHighlightMenuItems(options: {
  includeSrs?: boolean
  includeWkLevels?: boolean
  collapsed: HighlightCollapsedCategories
}): HighlightMenuSection[] {
  const sections: HighlightMenuSection[] = [
    [
      highlightCategoryHeaderItem('year', options.collapsed.year),
      ...(options.collapsed.year ? [] : HIGHLIGHT_YEAR_OPTIONS)
    ],
    [
      highlightCategoryHeaderItem('jlpt', options.collapsed.jlpt),
      ...(options.collapsed.jlpt ? [] : HIGHLIGHT_JLPT_OPTIONS)
    ]
  ]
  if (options.includeSrs === true) {
    sections.push([
      highlightCategoryHeaderItem('srs', options.collapsed.srs),
      ...(options.collapsed.srs ? [] : HIGHLIGHT_SRS_OPTIONS)
    ])
  }
  if (options.includeWkLevels === true) {
    sections.push([
      highlightCategoryHeaderItem('wk', options.collapsed.wk),
      ...(options.collapsed.wk ? [] : HIGHLIGHT_WK_LEVEL_OPTIONS)
    ])
  }
  return sections
}

export function parseHighlightGradeValue(value: string): HighlightGrade | null {
  if (!value.startsWith('year:')) return null
  const raw = value.slice('year:'.length)
  if (raw === 'jh') return 'jh'
  const n = Number(raw)
  if (n >= 1 && n <= 6) return n
  return null
}

export function parseHighlightJlptValue(value: string): JlptLevel | null {
  if (!value.startsWith('jlpt:')) return null
  const raw = value.slice('jlpt:'.length)
  return isJlptLevel(raw) ? raw : null
}

export function parseHighlightSrsValue(value: string): HighlightSrsBand | null {
  if (!value.startsWith('srs:')) return null
  const raw = value.slice('srs:'.length)
  if (raw === 'unstudied') return { min: -1, max: -1 }
  const [minRaw, maxRaw] = raw.split('-')
  const min = Number(minRaw)
  const max = Number(maxRaw)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { min, max }
}

export function parseHighlightWkLevelValue(value: string): number | null {
  if (!value.startsWith('wk:')) return null
  const level = Number(value.slice('wk:'.length))
  if (!Number.isInteger(level) || level < 1 || level > WANIKANI_MAX_LEVEL) return null
  return level
}

function isKnownHighlightOptionValue(value: string): value is HighlightOptionValue {
  return parseHighlightGradeValue(value) != null
    || parseHighlightJlptValue(value) != null
    || parseHighlightSrsValue(value) != null
    || parseHighlightWkLevelValue(value) != null
}

/** Derive typed highlight filters from multi-select option values. */
export function highlightFiltersFromSelection(
  selected: readonly string[],
  searchQuery: string
): MapHighlightFilters {
  const highlightGrades: HighlightGrade[] = []
  const highlightJlptLevels: JlptLevel[] = []
  const highlightSrsBands: HighlightSrsBand[] = []
  const highlightWkLevels: number[] = []
  const seenGrades = new Set<string>()
  const seenJlpt = new Set<string>()
  const seenSrs = new Set<string>()
  const seenWk = new Set<number>()

  for (const value of selected) {
    const grade = parseHighlightGradeValue(value)
    if (grade != null) {
      const key = String(grade)
      if (!seenGrades.has(key)) {
        seenGrades.add(key)
        highlightGrades.push(grade)
      }
      continue
    }
    const jlpt = parseHighlightJlptValue(value)
    if (jlpt != null) {
      if (!seenJlpt.has(jlpt)) {
        seenJlpt.add(jlpt)
        highlightJlptLevels.push(jlpt)
      }
      continue
    }
    const srs = parseHighlightSrsValue(value)
    if (srs != null) {
      const key = `${srs.min}-${srs.max}`
      if (!seenSrs.has(key)) {
        seenSrs.add(key)
        highlightSrsBands.push(srs)
      }
      continue
    }
    const wkLevel = parseHighlightWkLevelValue(value)
    if (wkLevel != null && !seenWk.has(wkLevel)) {
      seenWk.add(wkLevel)
      highlightWkLevels.push(wkLevel)
    }
  }

  return {
    highlightGrades,
    highlightJlptLevels,
    highlightSrsBands,
    highlightWkLevels,
    searchQuery
  }
}

/** Drop WK-gated option values when WaniKani is not configured. */
export function filterHighlightSelectionForSources(
  selected: readonly string[],
  wanikaniConfigured: boolean
): HighlightOptionValue[] {
  return selected.filter((value): value is HighlightOptionValue => {
    if (isHighlightCategoryHeaderValue(value)) return false
    if (!wanikaniConfigured && (value.startsWith('srs:') || value.startsWith('wk:'))) {
      return false
    }
    return isKnownHighlightOptionValue(value)
  })
}

function matchesHighlightGrade(cell: MapCell, grade: HighlightGrade): boolean {
  if (grade === 'jh') return cell.inJoyoo && cell.schoolGrade == null
  return cell.schoolGrade === grade
}

function matchesHighlightJlpt(cell: MapCell, level: JlptLevel): boolean {
  return cell.jlptLevel === level
}

function matchesHighlightSrsBand(cell: MapCell, band: HighlightSrsBand): boolean {
  if (band.min === -1 && band.max === -1) {
    return !hasApiSrs(cell.sources, cell.srsAvg)
  }
  if (!hasApiSrs(cell.sources, cell.srsAvg)) return false
  const srs = cell.srsAvg ?? 0
  return srs >= band.min && srs <= band.max
}

function matchesHighlightWkLevel(cell: MapCell, level: number): boolean {
  return cell.wkLevel === level
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
  return filters.highlightGrades.length > 0
    || filters.highlightJlptLevels.length > 0
    || filters.highlightSrsBands.length > 0
    || filters.highlightWkLevels.length > 0
    || normalizeKanjiSearchQuery(filters.searchQuery).length > 0
}

export function isMapCellHighlighted(cell: MapCell, filters: MapHighlightFilters): boolean {
  if (filters.highlightGrades.length > 0) {
    if (!filters.highlightGrades.some(grade => matchesHighlightGrade(cell, grade))) {
      return false
    }
  }

  if (filters.highlightJlptLevels.length > 0) {
    if (!filters.highlightJlptLevels.some(level => matchesHighlightJlpt(cell, level))) {
      return false
    }
  }

  if (filters.highlightSrsBands.length > 0) {
    if (!filters.highlightSrsBands.some(band => matchesHighlightSrsBand(cell, band))) {
      return false
    }
  }

  if (filters.highlightWkLevels.length > 0) {
    if (!filters.highlightWkLevels.some(level => matchesHighlightWkLevel(cell, level))) {
      return false
    }
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
