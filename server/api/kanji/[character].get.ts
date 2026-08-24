import { getKanjiDetail } from '../../utils/kanji-detail'
import { z } from 'zod'

const CharacterParam = z.string().min(1).max(8)

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'character')
  const decoded = raw ? decodeURIComponent(raw) : ''
  const parsed = CharacterParam.safeParse(decoded)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid kanji character' })
  }

  // Single CJK ideograph expected for map cells
  const character = parsed.data
  if ([...character].length !== 1) {
    throw createError({ statusCode: 400, statusMessage: 'Provide a single character' })
  }

  return await getKanjiDetail(character)
})
