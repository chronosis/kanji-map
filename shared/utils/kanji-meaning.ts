/** Gloss lists from the local Kanjidic / WaniKani joyo dump. */
export interface KanjiMeaningSource {
  meanings?: readonly string[] | null
  wk_meanings?: readonly string[] | null
}

function firstGloss(values: readonly string[] | null | undefined, skipMarked: boolean): string | null {
  for (const raw of values ?? []) {
    const text = raw.trim()
    if (!text) continue
    if (skipMarked && (text.startsWith('^') || text.startsWith('!'))) continue
    const gloss = text.split(/[_/,]/, 1)[0]?.trim() ?? ''
    if (gloss) return gloss
  }
  return null
}

/**
 * One English gloss for a tooltip.
 * WaniKani’s primary meaning wins. A leading `^` marks an accepted alternate.
 */
export function primaryKanjiMeaning(source: KanjiMeaningSource | null | undefined): string | null {
  if (!source) return null
  return firstGloss(source.wk_meanings, true) ?? firstGloss(source.meanings, false)
}
