/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
    // Agent worktrees live under .claude/ and contain their own copies of the tests
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})
