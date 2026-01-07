import { defineConfig } from 'vitest/config'
import vue from "@vitejs/plugin-vue";
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['client/**/*.{test,spec}.{js,ts}', 'server/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['client/src/**/*.ts', 'client/src/**/*.vue', 'server/src/**/*.ts'],
      exclude: ['**/*.d.ts', 'client/src/main.ts'],
    },
  },
})

