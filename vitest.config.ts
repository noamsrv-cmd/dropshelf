import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'dist-electron/**', 'release/**', 'work/**'],
  },
})
