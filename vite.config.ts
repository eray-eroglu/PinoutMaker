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
    rollupOptions: {
      output: {
        // Vendor code needed at start goes in its own chunks: they keep their hash (and the
        // browser cache) across deploys that only change app code. Only list packages the start
        // page needs; lazily imported libraries (jspdf, supabase-js) keep their on-demand chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/](konva|react-konva|react-reconciler|its-fine)[\\/]/.test(id)) return 'vendor-konva';
        },
      },
    },
  },
}))
