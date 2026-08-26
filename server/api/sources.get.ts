/**
 * Which external APIs have credentials configured (never exposes secrets).
 */
export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return {
    wanikani: Boolean(String(config.wanikaniApiKey || '').trim()),
    bunpro: Boolean(String(config.bunproFrontendJwt || '').trim())
  }
})
