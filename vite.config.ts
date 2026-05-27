import { defineConfig, type PluginOption } from 'vite';
import path from 'path';
import { writeFileSync } from 'node:fs';

// Dev-only middleware: lets the sp6-limit-sets-render demo POST a JSON view
// preset to /__save-view, which we write to scripts/view-preset.json. The
// offline render script reads that file on startup.
function viewPresetWriter(): PluginOption {
  return {
    name: 'sp6-view-preset-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-view', (req, res, next) => {
        if (req.method !== 'POST') return next();
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            JSON.parse(body);
            const out = path.resolve(__dirname, 'scripts/view-preset.json');
            writeFileSync(out, body);
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: 'scripts/view-preset.json' }));
          } catch (e) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

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
  assetsInclude: ['**/*.hdr', '**/*.exr', '**/*.obj'],
  plugins: [viewPresetWriter()],
});
