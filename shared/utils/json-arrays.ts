/** Parse a JSON string column into a string array; returns [] on empty/invalid input. */
export function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

/** Serialize a string array for SQLite JSON text columns. */
export function stringifyJsonStringArray(values: string[]): string {
  return JSON.stringify(values)
}
