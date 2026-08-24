// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: process.env.NUXT_DEVTOOLS === 'true'
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'light',
    fallback: 'light',
    classSuffix: '',
    // Fresh key so older `nuxt-color-mode` / system prefs do not override the default.
    storageKey: 'kanji-map-color-mode'
  },

  runtimeConfig: {
    wanikaniApiKey: process.env.WANIKANI_API_KEY || '',
    bunproFrontendJwt: process.env.BUNPRO_FRONTEND_JWT || '',
    databasePath: process.env.DATABASE_PATH || './data/kanji-map.sqlite'
  },

  ignore: [
    'data/**',
    'test/**',
    '.ai/**',
    'coverage/**',
    'drizzle/migrations/**',
    'scripts/**'
  ],

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
