import { defineConfig } from 'vite';
import path from 'path';

// Get the entry from env variable, default to index (gallery)
const entry = process.env.VITE_ENTRY || 'index';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: `${entry}.html`,
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: '[name].js',
        assetFileNames: 'index.[ext]'
      }
    }
  },
  assetsInclude: ['**/*.hdr', '**/*.exr']
});