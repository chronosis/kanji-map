/** UI constants for the kanji grid (avoid re-exporting other shared modules). */

export const GRID_COLUMNS = 40

export function jishoKanjiUrl(character: string): string {
  return `https://jisho.org/search/${encodeURIComponent(character)}%23kanji`
}
