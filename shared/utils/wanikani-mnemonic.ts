export interface MnemonicTextSegment {
  type: 'text'
  content: string
}

export interface MnemonicLinkSegment {
  type: 'link'
  content: string
  href: string
}

export interface MnemonicReadingSegment {
  type: 'reading'
  content: string
}

export type MnemonicSegment = MnemonicTextSegment | MnemonicLinkSegment | MnemonicReadingSegment

const MNEMONIC_TAG_RE = /<(radical|kanji|reading)>([\s\S]*?)<\/\1>/gi

/** WK radical pages use a lowercase English slug (spaces → hyphens). */
export function wanikaniRadicalUrl(slug: string): string {
  const normalized = slug.trim().toLowerCase().replace(/\s+/g, '-')
  return `https://www.wanikani.com/radicals/${encodeURIComponent(normalized)}`
}

export function wanikaniKanjiUrl(character: string): string {
  return `https://www.wanikani.com/kanji/${encodeURIComponent(character)}`
}

/**
 * Split WK mnemonic prose into plain text, styled readings, and WaniKani links for
 * `<radical>…</radical>`, `<kanji>…</kanji>`, and `<reading>…</reading>` tags.
 */
export function parseWanikaniMnemonic(
  text: string | null | undefined,
  kanjiByPrimaryMeaning: ReadonlyMap<string, string> | Record<string, string>
): MnemonicSegment[] {
  if (!text) return []

  const lookup = kanjiByPrimaryMeaning instanceof Map
    ? kanjiByPrimaryMeaning
    : new Map(Object.entries(kanjiByPrimaryMeaning))

  const segments: MnemonicSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(MNEMONIC_TAG_RE)) {
    const full = match[0]
    const tag = match[1]
    const inner = match[2]
    const index = match.index ?? 0
    if (!full || !tag || inner == null) continue

    if (index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, index) })
    }

    const label = inner.trim()
    const tagName = tag.toLowerCase()

    if (tagName === 'radical') {
      segments.push({
        type: 'link',
        content: label,
        href: wanikaniRadicalUrl(label)
      })
    } else if (tagName === 'reading') {
      segments.push({
        type: 'reading',
        content: label
      })
    } else {
      const character = lookup.get(label.toLowerCase())
      if (character) {
        segments.push({
          type: 'link',
          content: label,
          href: wanikaniKanjiUrl(character)
        })
      } else {
        segments.push({ type: 'text', content: label })
      }
    }

    lastIndex = index + full.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return segments
}
