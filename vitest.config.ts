import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts', 'server/**/*.spec.ts', 'shared/**/*.spec.ts']
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '~~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.'),
      '#shared': resolve(__dirname, 'shared')
    }
  }
})
