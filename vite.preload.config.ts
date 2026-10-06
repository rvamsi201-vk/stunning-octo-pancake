import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  build: {
    outDir: 'dist-electron/preload',
    emptyOutDir: false,
    lib: { entry: 'electron/preload/preload.ts', formats: ['cjs'], fileName: () => 'preload.cjs' },
    rollupOptions: { external: ['electron'] },
    minify: false,
  },
});
