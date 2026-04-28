import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Relative base so built HTML references ./main.js instead of /main.js —
  // required when each demo is hosted at a non-root subpath (e.g. inside an
  // iframe pointing at /blog-linkage-psi3-torus/index.html).
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './assets')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: '[name].js',
        assetFileNames: 'index.[ext]'
      }
    }
  },
  assetsInclude: ['**/*.hdr', '**/*.exr', '**/*.obj']
});
