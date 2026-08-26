import { describe, expect, it } from 'vitest'
import {
  KANJIVG_RELEASE,
  kanjiVgCodepoint,
  kanjiVgSvgUrl,
  prepareKanjiVgSvgMarkup
} from '../shared/utils/kanjivg'

describe('kanjivg', () => {
  it('maps characters to five-digit hex codepoints', () => {
    expect(kanjiVgCodepoint('一')).toBe('04e00')
    expect(kanjiVgCodepoint('語')).toBe('08a9e')
  })

  it('rejects empty or multi-character input', () => {
    expect(kanjiVgCodepoint('')).toBeNull()
    expect(kanjiVgCodepoint('  ')).toBeNull()
    expect(kanjiVgCodepoint('語学')).toBeNull()
  })

  it('builds a pinned jsDelivr SVG URL', () => {
    expect(kanjiVgSvgUrl('語')).toBe(
      `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@${KANJIVG_RELEASE}/kanji/08a9e.svg`
    )
  })

  it('strips XML declaration, DOCTYPE, scripts, and unbound kvg attributes', () => {
    const raw = `<?xml version="1.0"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd" [
<!ATTLIST g xmlns:kvg CDATA #FIXED "http://kanjivg.tagaini.net" kvg:element CDATA #IMPLIED>
]>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="http://kanjivg.tagaini.net">
  <script>alert(1)</script>
  <g id="kvg:04e00" kvg:element="一" kvg:radical="general">
    <path id="kvg:04e00-s1" kvg:type="㇐" d="M0 0"/>
  </g>
</svg>`
    const prepared = prepareKanjiVgSvgMarkup(raw)
    expect(prepared).not.toContain('<?xml')
    expect(prepared).not.toContain('<!DOCTYPE')
    expect(prepared).not.toContain('<script')
    expect(prepared).not.toContain('kvg:element')
    expect(prepared).not.toContain('xmlns:kvg')
    expect(prepared).toContain('id="kvg:04e00"')
    expect(prepared).toContain('id="kvg:04e00-s1"')
    expect(prepared).toContain('<svg')
    expect(prepared).toContain('d="M0 0"')
  })
})
