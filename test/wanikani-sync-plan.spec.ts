import { describe, expect, it } from 'vitest'
import {
  WK_BURNED_QUIET_MS,
  WK_BURNED_STAGE,
  kanjiNeedsPoll,
  latestAssignmentUpdate,
  planKanjiPolls,
  snapshotsAtOrBelowLevel,
  wanikaniLevelList,
  type KanjiSrsSnapshot
} from '../shared/utils/wanikani-sync-plan'

const NOW = Date.parse('2026-06-01T00:00:00.000Z')

function snap(partial: Partial<KanjiSrsSnapshot> & Pick<KanjiSrsSnapshot, 'subjectId'>): KanjiSrsSnapshot {
  return {
    character: partial.character ?? '日',
    subjectId: partial.subjectId,
    wkLevel: partial.wkLevel ?? 1,
    srsStage: partial.srsStage ?? 5,
    availableAt: partial.availableAt ?? null,
    updatedAt: partial.updatedAt ?? null
  }
}

describe('wanikani sync plan', () => {
  it('lists inclusive levels clamped to 1–60', () => {
    expect(wanikaniLevelList(0, 3)).toEqual([1, 2, 3])
    expect(wanikaniLevelList(59, 80)).toEqual([59, 60])
    expect(wanikaniLevelList(8, 7)).toEqual([])
  })

  it('polls everything when no snapshot has a date', () => {
    const plan = planKanjiPolls([
      snap({ subjectId: 1, srsStage: 4 }),
      snap({ subjectId: 2, srsStage: WK_BURNED_STAGE })
    ], NOW)
    expect(plan.full).toBe(true)
    expect(plan.pollSubjectIds).toEqual([])
  })

  it('skips future reviews and quiet burned kanji', () => {
    const future = new Date(NOW + 86_400_000).toISOString()
    const due = new Date(NOW - 60_000).toISOString()
    const recentBurn = new Date(NOW - 2 * 86_400_000).toISOString()
    const oldBurn = new Date(NOW - WK_BURNED_QUIET_MS - 86_400_000).toISOString()

    const plan = planKanjiPolls([
      snap({ subjectId: 1, availableAt: future, updatedAt: future }),
      snap({ subjectId: 2, srsStage: WK_BURNED_STAGE, updatedAt: oldBurn }),
      snap({ subjectId: 3, srsStage: WK_BURNED_STAGE, updatedAt: recentBurn }),
      snap({ subjectId: 4, availableAt: due, updatedAt: due }),
      snap({ subjectId: 5 })
    ], NOW)

    expect(plan.full).toBe(false)
    expect(plan.pollSubjectIds).toEqual([3, 4, 5])
    expect(plan.skippedBurned).toBe(1)
    expect(plan.skippedUpcoming).toBe(1)
    expect(kanjiNeedsPoll(snap({ subjectId: 1, availableAt: future, updatedAt: future }), NOW)).toBe(false)
  })

  it('drops snapshots above the user level and keeps the newest update cursor', () => {
    const rows = [
      snap({ subjectId: 1, wkLevel: 3, updatedAt: '2026-01-01T00:00:00.000Z' }),
      snap({ subjectId: 2, wkLevel: 9, updatedAt: '2026-05-01T00:00:00.000Z' }),
      snap({ subjectId: 3, wkLevel: null, updatedAt: '2026-03-01T00:00:00.000Z' })
    ]
    expect(snapshotsAtOrBelowLevel(rows, 4).map(row => row.subjectId)).toEqual([1, 3])
    expect(latestAssignmentUpdate(rows)).toBe('2026-05-01T00:00:00.000Z')
  })
})
