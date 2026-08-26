/**
 * Jisho.org kanji page metadata (scraped at build time; same fields shown on #kanji pages).
 * Source dictionaries: JMdict, Kanjidic2, Radkfile — see https://jisho.org/about
 */

export interface JishoKanjiMeta {
  radicalSymbol: string | null
  radicalForms: string[]
  parts: string[]
}

function between(html: string, start: string, end: string): string | null {
  const i = html.indexOf(start)
  if (i < 0) return null
  const j = html.indexOf(end, i + start.length)
  if (j < 0) return null
  return html.slice(i + start.length, j)
}

function parseAnchorTexts(section: string | null): string[] {
  if (!section) return []
  const out: string[] = []
  const re = /<a[^>]*>([^<]+)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(section)) !== null) {
    const text = m[1]?.trim()
    if (text) out.push(text)
  }
  return out
}

/** Parse Kangxi radical symbol + optional parenthetical forms from a Jisho kanji search page. */
export function parseJishoKanjiRadical(pageHtml: string): Pick<JishoKanjiMeta, 'radicalSymbol' | 'radicalForms'> {
  const radicalBlock = between(pageHtml, '<dt>Radical:</dt>', '</dd>')
  if (!radicalBlock) {
    return { radicalSymbol: null, radicalForms: [] }
  }

  const meaningEnd = radicalBlock.indexOf('</span>', radicalBlock.indexOf('radical_meaning'))
  if (meaningEnd < 0) {
    return { radicalSymbol: null, radicalForms: [] }
  }

  const symbolsRaw = radicalBlock
    .slice(meaningEnd + '</span>'.length)
    .replace(/<[^>]+>/g, '')
    .trim()

  if (!symbolsRaw) {
    return { radicalSymbol: null, radicalForms: [] }
  }

  const paren = symbolsRaw.match(/^(.+?)\s*\(([^)]+)\)$/)
  if (paren) {
    const symbol = paren[1]?.trim() ?? ''
    const forms = (paren[2] ?? '')
      .split(/[,、]/)
      .map(s => s.trim())
      .filter(Boolean)
    return { radicalSymbol: symbol || null, radicalForms: forms }
  }

  return { radicalSymbol: symbolsRaw, radicalForms: [] }
}

/** Component parts listed on the Jisho kanji page (used for radical/component search). */
export function parseJishoKanjiParts(pageHtml: string): string[] {
  const partsBlock = between(pageHtml, '<dt>Parts:</dt>', '</dd>')
  return parseAnchorTexts(partsBlock).sort()
}

export function parseJishoKanjiPage(pageHtml: string): JishoKanjiMeta {
  const { radicalSymbol, radicalForms } = parseJishoKanjiRadical(pageHtml)
  const parts = parseJishoKanjiParts(pageHtml)
  return { radicalSymbol, radicalForms, parts }
}

/** Fetch kanji metadata from Jisho (build-time script only — rate-limit requests). */
export async function fetchJishoKanjiMeta(character: string): Promise<JishoKanjiMeta | null> {
  if (!character) return null
  const url = `https://jisho.org/search/${encodeURIComponent(character)}%23kanji`
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'Accept': 'text/html', 'User-Agent': 'kanji-map-data-build/1.0' }
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  const html = await res.text()
  if (!html.includes('class="kanji details"')) return null
  return parseJishoKanjiPage(html)
}
