import { defineConfig, type PluginOption } from 'vite';
import path from 'path';
import { writeFileSync, readdirSync, existsSync } from 'node:fs';

// Dev-only: `npm run dev` with no demo name (which sets DEMO_GALLERY=1) serves
// an index of every demo at /, and synthesizes a page for each demo at
// /demos/<name>/ so those links work. The pages are synthesized in memory
// rather than written to disk, so no index.html is left in any demo directory
// — build-all.mjs generates and removes its own, and would clobber them.
function demoGallery(): PluginOption {
  const DEMOS = path.resolve(__dirname, 'demos');

  // Re-read per request so a demo added while the server runs shows up.
  const listDemos = () =>
    readdirSync(DEMOS, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
      .filter((e) => existsSync(path.join(DEMOS, e.name, 'main.ts')))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

  const demoPage = (name: string) => `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <style>
    body {
      margin: 0;
      overflow: hidden;
    }
  </style>
</head>

<body>
  <script type="module" src="/demos/${name}/main.ts"></script>
</body>

</html>
`;

  const galleryPage = (list: string[]) => `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>demos</title>
  <style>
    :root { --bg:#f7f5f0; --ink:#2c2c2c; --teal:#3e938f; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 40px 32px 64px;
      background: var(--bg); color: var(--ink);
      font: 14px/1.6 ui-monospace, monospace;
    }
    header { max-width: 1100px; margin: 0 auto 28px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 6px; }
    .count { opacity: 0.5; font-size: 12px; }
    #filter {
      display: block; width: 100%; max-width: 340px; margin-top: 18px;
      padding: 8px 11px; font: inherit; color: inherit;
      background: #fff; border: 1px solid rgba(0,0,0,0.15); border-radius: 6px;
    }
    #filter:focus { outline: none; border-color: var(--teal); }
    .grid {
      max-width: 1100px; margin: 0 auto;
      display: grid; gap: 7px;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }
    .demo {
      display: block; padding: 9px 12px;
      background: #fff; border: 1px solid rgba(0,0,0,0.10); border-radius: 6px;
      color: inherit; text-decoration: none;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .demo:hover { border-color: var(--teal); color: var(--teal); }
    .demo[hidden] { display: none; }
    @media (prefers-color-scheme: dark) {
      :root { --bg:#1c1c1a; --ink:#e8e6e0; }
      #filter, .demo { background: #262624; border-color: rgba(255,255,255,0.12); }
    }
  </style>
</head>

<body>
  <header>
    <h1>demos</h1>
    <div class="count">${list.length} demos</div>
    <input id="filter" type="search" placeholder="filter…" autocomplete="off" autofocus />
  </header>
  <div class="grid" id="grid">
${list.map((d) => `      <a class="demo" href="/demos/${d}/">${d}</a>`).join('\n')}
  </div>
  <script>
    const input = document.getElementById('filter');
    const items = [...document.querySelectorAll('.demo')];
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      for (const el of items) el.hidden = !el.textContent.toLowerCase().includes(q);
    });
  </script>
</body>

</html>
`;

  return {
    name: 'demo-gallery',
    apply: 'serve',
    configureServer(server) {
      const send = async (res: import('node:http').ServerResponse, url: string, html: string) => {
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html');
        res.end(await server.transformIndexHtml(url, html));
      };

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '/').split('?')[0];

        const demo = /^\/demos\/([^/]+)\/?$/.exec(url)?.[1];
        if (demo && existsSync(path.join(DEMOS, demo, 'main.ts'))) {
          // A demo with its own index.html keeps it — let vite serve the file.
          if (existsSync(path.join(DEMOS, demo, 'index.html'))) return next();
          if (!url.endsWith('/')) {
            res.statusCode = 302;
            res.setHeader('location', `${url}/`);
            return res.end();
          }
          return send(res, url, demoPage(demo));
        }

        // Only take over / when no demo was named; otherwise index.html (which
        // run-demo.mjs just pointed at that demo) should win.
        if (process.env.DEMO_GALLERY && (url === '/' || url === '/index.html')) {
          return send(res, '/index.html', galleryPage(listDemos()));
        }

        next();
      });
    },
  };
}

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
  plugins: [viewPresetWriter(), lsurfaceConfigWriter(), demoGallery()],
});
