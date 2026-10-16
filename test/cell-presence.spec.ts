import { describe, expect, it } from 'vitest'
import { planCellPresence } from '../shared/utils/cell-presence'

const cell = (character: string) => ({ character })

describe('planCellPresence', () => {
  it('shows the first set of cards without fading them in', () => {
    const plan = planCellPresence([], [cell('日'), cell('月')], new Set())
    expect(plan.mounted.map(item => item.character)).toEqual(['日', '月'])
    expect(plan.exit).toEqual([])
    expect(plan.enter).toEqual([])
    expect(plan.restore).toEqual([])
  })

  it('keeps a card that a filter just dropped so it can fade out', () => {
    const previous = [cell('日'), cell('月'), cell('火')]
    const plan = planCellPresence(previous, [cell('日'), cell('火')], new Set())
    expect(plan.exit).toEqual(['月'])
    expect(plan.enter).toEqual([])
    expect(plan.mounted.map(item => item.character)).toEqual(['日', '火', '月'])
  })

  it('fades a card in when it is no longer filtered', () => {
    const plan = planCellPresence(
      [cell('日'), cell('火')],
      [cell('日'), cell('月'), cell('火')],
      new Set()
    )
    expect(plan.enter).toEqual(['月'])
    expect(plan.exit).toEqual([])
    expect(plan.mounted.map(item => item.character)).toEqual(['日', '月', '火'])
  })

  it('does not restart a fade that is already running', () => {
    const previous = [cell('日'), cell('月')]
    const plan = planCellPresence(previous, [cell('日')], new Set(['月']))
    expect(plan.exit).toEqual([])
    expect(plan.mounted.map(item => item.character)).toEqual(['日', '月'])
  })

  it('restores a card that matches the filter again before the fade finishes', () => {
    const plan = planCellPresence(
      [cell('日'), cell('月')],
      [cell('日'), cell('月')],
      new Set(['月'])
    )
    expect(plan.restore).toEqual(['月'])
    expect(plan.exit).toEqual([])
    expect(plan.enter).toEqual([])
    expect(plan.mounted.map(item => item.character)).toEqual(['日', '月'])
  })

  it('treats a reorder of the same cards as neither enter nor exit', () => {
    const plan = planCellPresence(
      [cell('月'), cell('日')],
      [cell('日'), cell('月')],
      new Set()
    )
    expect(plan.exit).toEqual([])
    expect(plan.enter).toEqual([])
  })
})
