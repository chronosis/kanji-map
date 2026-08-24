/**
 * Builds data/kanji-union.json:
 * - Jōyō = KANJIDIC grades 1–8 (2,136)
 * - School grades from MEXT 2020 list (Wikipedia Kyōiku kanji tables) — elementary 1–6 only
 * - JLPT from OpenJLPT (preferred) then KANJIDIC jlpt_new
 * - freqRank / strokes for alternate grid orderings
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { JlptLevel, KanjiUnionEntry, SchoolGrade } from '../shared/types/kanji'
import { assignGridIndices, isJlptLevel, isSchoolGrade } from '../shared/utils/kanji-order'

interface SourceKanji {
  grade?: number | null
  jlpt_old?: number | null
  jlpt_new?: number | null
  freq?: number | null
  strokes?: number | null
}

function jlptFromNumber(n: number | null | undefined): JlptLevel | null {
  if (n == null) return null
  const map: Record<number, JlptLevel> = {
    5: 'N5',
    4: 'N4',
    3: 'N3',
    2: 'N2',
    1: 'N1'
  }
  return map[n] ?? null
}

function isJoyooGrade(grade: number | null | undefined): boolean {
  return grade === 1 || grade === 2 || grade === 3 || grade === 4 || grade === 5 || grade === 6 || grade === 8
}

function parseWikiSchoolGrades(html: string): Map<string, SchoolGrade> {
  const expected: Array<[string, SchoolGrade, number]> = [
    ['First_grade_(80_kanji)', 1, 80],
    ['Second_grade_(160_kanji)', 2, 160],
    ['Third_grade_(200_kanji)', 3, 200],
    ['Fourth_grade_(202_kanji)', 4, 202],
    ['Fifth_grade_(193_kanji)', 5, 193],
    ['Sixth_grade_(191_kanji)', 6, 191]
  ]

  const grades = new Map<string, SchoolGrade>()
  for (let i = 0; i < expected.length; i++) {
    const [id, grade, count] = expected[i]
    const start = html.indexOf(`id="${id}"`)
    if (start < 0) throw new Error(`Missing Wikipedia heading id=${id}`)
    const nextId = expected[i + 1]?.[0]
    const endMarker = nextId ? `id="${nextId}"` : 'id="See_also"'
    const end = html.indexOf(endMarker, start + 1)
    const section = html.slice(start, end > start ? end : undefined)
    const fromLinks = [...section.matchAll(/wiktionary\.org\/wiki\/([\u4e00-\u9fff])#Japanese/g)]
      .map(m => m[1])
    const unique = [...new Set(fromLinks)]
    if (unique.length < count * 0.9) {
      throw new Error(`Grade ${grade}: expected ~${count}, got ${unique.length}`)
    }
    for (const ch of unique) grades.set(ch, grade)
    console.log(`wiki grade ${grade}: ${unique.length}`)
  }
  return grades
}

function loadOpenJlpt(): Map<string, JlptLevel> {
  const map = new Map<string, JlptLevel>()
  for (const level of ['n5', 'n4', 'n3', 'n2', 'n1'] as const) {
    const path = resolve('data/raw', `jlpt-${level}.json`)
    const rows = JSON.parse(readFileSync(path, 'utf8')) as Array<{ character: string, level?: string }>
    for (const row of rows) {
      const raw = (row.level ?? level).toUpperCase()
      const jlpt = (raw.startsWith('N') ? raw : `N${raw}`) as JlptLevel
      if (isJlptLevel(jlpt) && row.character && !map.has(row.character)) {
        map.set(row.character, jlpt)
      }
    }
  }
  return map
}

function main() {
  const source = JSON.parse(readFileSync(resolve('data/raw/joyo.json'), 'utf8')) as Record<string, SourceKanji>
  const wikiHtml = readFileSync(resolve('data/raw/kyoiku-wiki.html'), 'utf8')
  const schoolGrades = parseWikiSchoolGrades(wikiHtml)
  const openJlpt = loadOpenJlpt()

  const byChar = new Map<string, KanjiUnionEntry>()

  for (const [character, info] of Object.entries(source)) {
    if (!/\p{Script=Han}/u.test(character)) continue
    const joyoo = isJoyooGrade(info.grade)
    const jlpt
      = openJlpt.get(character)
        ?? jlptFromNumber(info.jlpt_new)
        ?? jlptFromNumber(info.jlpt_old)
        ?? null

    if (!joyoo && !jlpt) continue

    const wikiGrade = schoolGrades.get(character)
    const fallbackGrade = info.grade != null && isSchoolGrade(info.grade) ? info.grade : null

    byChar.set(character, {
      character,
      schoolGrade: wikiGrade ?? (joyoo ? fallbackGrade : null),
      jlptLevel: jlpt,
      inJoyoo: joyoo,
      freqRank: typeof info.freq === 'number' ? info.freq : null,
      strokes: typeof info.strokes === 'number' ? info.strokes : null
    })
  }

  for (const [character, grade] of schoolGrades) {
    const info = source[character]
    const existing = byChar.get(character)
    if (existing) {
      existing.schoolGrade = grade
      existing.inJoyoo = true
    } else {
      byChar.set(character, {
        character,
        schoolGrade: grade,
        jlptLevel: openJlpt.get(character) ?? null,
        inJoyoo: true,
        freqRank: typeof info?.freq === 'number' ? info.freq : null,
        strokes: typeof info?.strokes === 'number' ? info.strokes : null
      })
    }
  }

  for (const [character, jlpt] of openJlpt) {
    if (byChar.has(character)) {
      const existing = byChar.get(character)!
      if (!existing.jlptLevel) existing.jlptLevel = jlpt
      continue
    }
    const info = source[character]
    byChar.set(character, {
      character,
      schoolGrade: schoolGrades.get(character) ?? null,
      jlptLevel: jlpt,
      inJoyoo: false,
      freqRank: typeof info?.freq === 'number' ? info.freq : null,
      strokes: typeof info?.strokes === 'number' ? info.strokes : null
    })
  }

  const ordered = assignGridIndices([...byChar.values()], 'grade')
  mkdirSync(resolve('data'), { recursive: true })
  const outPath = resolve('data/kanji-union.json')
  writeFileSync(outPath, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8')

  console.log(`Wrote ${ordered.length} characters to ${outPath}`)
  console.log(`  inJoyoo: ${ordered.filter(e => e.inJoyoo).length}`)
  console.log(`  school grades: ${[1, 2, 3, 4, 5, 6].map(g => `${g}=${ordered.filter(e => e.schoolGrade === g).length}`).join(' ')}`)
  console.log(`  with freq: ${ordered.filter(e => e.freqRank != null).length}`)
  console.log(`  with JLPT: ${ordered.filter(e => e.jlptLevel).length}`)
}

main()
