import { defineConfig } from 'vitest/config'
import vue from "@vitejs/plugin-vue";
import * as path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@services': path.resolve(__dirname, 'server/src/services'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{js,ts}', 'tests/quality/**/*.{test,spec}.{js,ts}'],
    exclude: ['tests/integration/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['client/src/**/*.ts', 'client/src/**/*.vue', 'server/src/**/*.ts'],
      exclude: ['**/*.d.ts', 'client/src/main.ts'],
    },
  },
})

