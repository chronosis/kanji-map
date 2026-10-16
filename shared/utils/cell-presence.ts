/**
 * Which cards stay mounted when a filter or snapshot changes who is on the grid.
 * Leaving cards stay in `mounted` so they can fade out before the node is removed.
 * An empty `previous` is the first paint: every card is shown, none fade in.
 */
export interface CellPresencePlan<T> {
  mounted: T[]
  exit: string[]
  enter: string[]
  restore: string[]
}

export function planCellPresence<T extends { character: string }>(
  previous: readonly T[],
  next: readonly T[],
  exiting: ReadonlySet<string>
): CellPresencePlan<T> {
  if (previous.length === 0) {
    return { mounted: next.slice(), exit: [], enter: [], restore: [] }
  }

  const nextByCharacter = new Map<string, T>()
  for (const cell of next) nextByCharacter.set(cell.character, cell)

  const previousCharacters = new Set<string>()
  for (const cell of previous) previousCharacters.add(cell.character)

  const mounted = next.slice()
  const exit: string[] = []
  const enter: string[] = []
  const restore: string[] = []

  for (const cell of previous) {
    if (nextByCharacter.has(cell.character)) continue
    mounted.push(cell)
    if (!exiting.has(cell.character)) exit.push(cell.character)
  }

  for (const cell of next) {
    if (exiting.has(cell.character)) {
      restore.push(cell.character)
      continue
    }
    if (!previousCharacters.has(cell.character)) enter.push(cell.character)
  }

  return { mounted, exit, enter, restore }
}
