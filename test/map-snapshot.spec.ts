import { describe, expect, it } from 'vitest'
import type { MapCell } from '../shared/types/kanji'
import {
  applyMapSnapshot,
  formatSnapshotTimestamp,
  mapSnapshotSignature,
  nextSnapshotAction,
  parseMapSnapshotState,
  toSnapshotCells
} from '../shared/utils/map-snapshot'

function cell(partial: Partial<MapCell> & Pick<MapCell, 'character'>): MapCell {
  return {
    character: partial.character,
    schoolGrade: partial.schoolGrade ?? 1,
    jlptLevel: partial.jlptLevel ?? 'N5',
    inJoyoo: partial.inJoyoo ?? true,
    freqRank: partial.freqRank ?? 1,
    strokes: partial.strokes ?? 4,
    gridIndex: partial.gridIndex ?? 0,
    joyoIndex: partial.joyoIndex ?? 0,
    srsAvg: partial.srsAvg ?? 1,
    accuracyAvg: partial.accuracyAvg ?? 50,
    sources: partial.sources ?? 1,
    inWanikani: partial.inWanikani ?? true,
    wkLevel: partial.wkLevel ?? 1,
    wkSubjectId: partial.wkSubjectId ?? 10,
    wkApiOrder: partial.wkApiOrder ?? 0,
    radicalSymbol: null,
    radicalForms: [],
    parts: [],
    readings: [],
    readingCount: partial.readingCount ?? 2,
    meaningCorrect: partial.meaningCorrect ?? 1,
    meaningIncorrect: partial.meaningIncorrect ?? 0,
    readingCorrect: partial.readingCorrect ?? 1,
    readingIncorrect: partial.readingIncorrect ?? 0
  }
}

describe('map snapshots', () => {
  it('treats an identical progress view as a date touch', () => {
    const first = toSnapshotCells([cell({ character: '月', srsAvg: 4 }), cell({ character: '日', srsAvg: 8 })])
    const second = toSnapshotCells([cell({ character: '日', srsAvg: 8 }), cell({ character: '月', srsAvg: 4 })])
    expect(mapSnapshotSignature(first)).toBe(mapSnapshotSignature(second))
    expect(nextSnapshotAction(first, second)).toBe('touch')
  })

  it('treats a WaniKani index renumber as the same view', () => {
    const earlier = toSnapshotCells([
      cell({ character: '日', wkLevel: 1, wkApiOrder: 10, wkSubjectId: 1 }),
      cell({ character: '月', wkLevel: 1, wkApiOrder: 11, wkSubjectId: 2 })
    ])
    const renumbered = toSnapshotCells([
      cell({ character: '日', wkLevel: 1, wkApiOrder: 0, wkSubjectId: 9 }),
      cell({ character: '月', wkLevel: 1, wkApiOrder: 1, wkSubjectId: 8 })
    ])
    expect(nextSnapshotAction(earlier, renumbered)).toBe('touch')
  })

  it('inserts a snapshot when WaniKani lesson order changes', () => {
    const earlier = toSnapshotCells([
      cell({ character: '日', wkLevel: 1, wkApiOrder: 0 }),
      cell({ character: '月', wkLevel: 1, wkApiOrder: 1 })
    ])
    const swapped = toSnapshotCells([
      cell({ character: '日', wkLevel: 1, wkApiOrder: 1 }),
      cell({ character: '月', wkLevel: 1, wkApiOrder: 0 })
    ])
    expect(nextSnapshotAction(earlier, swapped)).toBe('insert')
  })

  it('inserts a snapshot when SRS changes', () => {
    const previous = toSnapshotCells([cell({ character: '日', srsAvg: 4 })])
    const next = toSnapshotCells([cell({ character: '日', srsAvg: 5 })])
    expect(nextSnapshotAction(previous, next)).toBe('insert')
    expect(nextSnapshotAction(null, next)).toBe('insert')
  })

  it('round-trips snapshot json and overlays historical progress', () => {
    const stored = toSnapshotCells([cell({ character: '日', srsAvg: 2, accuracyAvg: 40, inWanikani: true })])
    const parsed = parseMapSnapshotState(JSON.stringify(stored))
    expect(parsed).toEqual(stored)

    const live = [
      cell({ character: '日', srsAvg: 9, accuracyAvg: 99, schoolGrade: 1 }),
      cell({ character: '月', srsAvg: 3, inWanikani: true })
    ]
    const viewed = applyMapSnapshot(live, parsed ?? [])
    expect(viewed.find(row => row.character === '日')).toMatchObject({
      srsAvg: 2,
      accuracyAvg: 40,
      schoolGrade: 1
    })
    expect(viewed.find(row => row.character === '月')).toMatchObject({
      srsAvg: null,
      inWanikani: false,
      sources: 0
    })
  })

  it('formats a snapshot timestamp', () => {
    expect(formatSnapshotTimestamp('2026-01-02T15:04:00.000Z', 'en-US', 'UTC')).toBe('Jan 2, 2026, 3:04 PM')
  })
})
