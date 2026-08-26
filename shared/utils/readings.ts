/**
 * Kana / reading helpers for map search (onyomi, kunyomi, nanori).
 */

const KANA_ONLY_RE = /^[\u3040-\u309F\u30A0-\u30FFーゝゞヽヾ]+$/u

/** True when the query is only hiragana/katakana (no kanji or latin). */
export function isKanaOnlyQuery(query: string): boolean {
  const q = query.trim().replace(/[!！.]/g, '')
  return q.length > 0 && KANA_ONLY_RE.test(q)
}

/** Map katakana code points to hiragana; leave other characters unchanged. */
export function toHiragana(input: string): string {
  let out = ''
  for (const ch of input) {
    const cp = ch.codePointAt(0)
    if (cp != null && cp >= 0x30A1 && cp <= 0x30F6) {
      out += String.fromCodePoint(cp - 0x60)
    } else {
      out += ch
    }
  }
  return out
}

/**
 * Expand a raw Kanjidic/WK reading into searchable forms:
 * full reading without `.` / `!`, plus the stem before the first `.`.
 */
export function expandReadingVariants(raw: string): string[] {
  const cleaned = raw.replace(/[!！]/g, '').trim()
  if (!cleaned) return []

  const hira = toHiragana(cleaned)
  const forms = new Set<string>()
  const full = hira.replace(/\./g, '')
  if (full) forms.add(full)

  const stem = hira.split('.')[0]
  if (stem) {
    const stemNorm = stem.replace(/\./g, '')
    if (stemNorm) forms.add(stemNorm)
  }

  return [...forms]
}

/** Dedupe and normalize a list of raw readings for storage / search. */
export function normalizeReadingsList(raws: readonly string[]): string[] {
  const out = new Set<string>()
  for (const raw of raws) {
    for (const variant of expandReadingVariants(raw)) {
      out.add(variant)
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b, 'ja'))
}

/** Normalize a kana search needle the same way stored readings are normalized. */
export function normalizeReadingQuery(query: string): string {
  return toHiragana(query.trim()).replace(/[!！.]/g, '')
}

/** Exact match against any stored reading form (after kana normalization). */
export function readingsMatchQuery(query: string, readings: readonly string[]): boolean {
  if (!isKanaOnlyQuery(query)) return false
  const needle = normalizeReadingQuery(query)
  if (!needle) return false
  return readings.some(r => r === needle)
}

/**
 * Collapse a raw Kanjidic/WK reading to its count stem:
 * strip `!` emphasis, leading/trailing `-` markers, take kana before the first
 * okurigana `.` (e.g. `い.きる` → `い`, `なま-` → `なま`).
 */
export function readingStem(raw: string): string | null {
  let cleaned = raw.replace(/[!！]/g, '').trim()
  if (!cleaned) return null
  cleaned = toHiragana(cleaned)
  cleaned = cleaned.replace(/^-+/u, '').replace(/-+$/u, '')
  if (!cleaned) return null
  const beforeDot = cleaned.split('.')[0] ?? ''
  const stem = beforeDot.replace(/\./g, '').trim()
  return stem || null
}

/**
 * Full kana form with emphasis / boundary markers / okurigana dots removed.
 * Used to merge alternate okurigana splits (`おこ.なう` / `おこな.う`).
 */
export function readingFullForm(raw: string): string | null {
  let cleaned = raw.replace(/[!！]/g, '').trim()
  if (!cleaned) return null
  cleaned = toHiragana(cleaned)
  cleaned = cleaned.replace(/^-+/u, '').replace(/-+$/u, '').replace(/\./g, '')
  return cleaned || null
}

function isLeadingHyphenSuffixForm(raw: string): boolean {
  const trimmed = raw.replace(/[!！]/g, '').trim()
  return /^-+/u.test(trimmed) && !trimmed.includes('.')
}

/**
 * Build a deduped stem set from one or more data sources (Kanjidic, WK dump, live WK, …).
 * All sources feed the same Set so overlapping readings are counted once.
 */
export function readingStemSet(
  ...sources: Array<readonly string[] | null | undefined>
): Set<string> {
  /** fullForm → longest stem among alternate okurigana splits of that reading */
  const stemByFull = new Map<string, string>()
  const hyphenSuffixStems: string[] = []

  for (const source of sources) {
    if (!source) continue
    for (const raw of source) {
      const stem = readingStem(raw)
      if (!stem) continue

      if (isLeadingHyphenSuffixForm(raw)) {
        hyphenSuffixStems.push(stem)
        continue
      }

      const full = readingFullForm(raw)
      if (!full) continue
      const prev = stemByFull.get(full)
      if (!prev || stem.length > prev.length) {
        stemByFull.set(full, stem)
      }
    }
  }

  const set = new Set<string>(stemByFull.values())

  // `-いき` when `い.く` already contributed `い` — do not count as a second reading.
  for (const stem of hyphenSuffixStems) {
    const covered = [...set].some(primary => stem.startsWith(primary) && stem.length > primary.length)
    if (!covered) set.add(stem)
  }

  return set
}

/**
 * Count distinct on/kun reading stems across any number of sources.
 * Pass each source as its own array; they are merged into one Set.
 * Callers must omit nanori.
 */
export function countDistinctReadingStems(
  ...sources: Array<readonly string[] | null | undefined>
): number {
  return readingStemSet(...sources).size
}

/** @deprecated Prefer {@link countDistinctReadingStems}. */
export function countDistinctRawReadings(
  ...sources: Array<readonly string[] | null | undefined>
): number {
  return countDistinctReadingStems(...sources)
}
