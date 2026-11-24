import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : './',
  // Claude Code keeps agent worktrees (full repo copies with their own index.html, tsconfig and
  // node_modules) under .claude/. Watching or scanning them invalidates the dependency cache and
  // leaves the dev page blank with "504 Outdated Optimize Dep".
  server: {
    watch: { ignored: ['**/.claude/**'] },
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}))
