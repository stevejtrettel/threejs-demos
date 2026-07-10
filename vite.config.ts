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

// Dev-only middleware: lets the translation-surface-relax demo POST a relaxed
// genus-2 embedding to /__save-lsurface, written to the demo folder for reuse.
function lsurfaceConfigWriter(): PluginOption {
  return {
    name: 'lsurface-config-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-lsurface', (req, res, next) => {
        if (req.method !== 'POST') return next();
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            const parsed = JSON.parse(body);
            // Optional savePath (validated to demos/**.json) lets each demo
            // write its own config; defaults to the relax demo's file.
            let rel = 'demos/translation-surface-relax/relaxed-config.json';
            if (typeof parsed.savePath === 'string') {
              const p = parsed.savePath;
              if (!/^demos\/[\w./-]+\.json$/.test(p) || p.includes('..')) throw new Error(`bad savePath: ${p}`);
              rel = p;
            }
            const out = path.resolve(__dirname, rel);
            writeFileSync(out, body);
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: rel }));
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
  plugins: [viewPresetWriter(), lsurfaceConfigWriter()],
});
