/**
 * Builds every demo into one static site for GitHub Pages.
 *
 * Unlike `npm run build <demo>` — which produces a standalone, fully self-contained
 * bundle per demo (the right thing for dropping a single demo into a blog iframe) —
 * this does ONE multi-page vite build over all demos at once. Rollup then hoists
 * everything they share (three.js above all) into common chunks, so the site ships
 * one copy of three instead of ~140, and a visitor clicking between demos downloads
 * it once.
 *
 * That sharing is also why this uses an absolute `base` rather than the './' in
 * vite.config.ts: the pages all sit at different depths under demos/ before being
 * flattened, and absolute URLs survive the move.
 *
 *   node scripts/build-all.mjs            → dist-pages/, base /threejs-demos/
 *   BASE=/ node scripts/build-all.mjs     → for a root-hosted deploy
 */

import { build } from 'vite';
import { readdirSync, existsSync, writeFileSync, rmSync, renameSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'dist-pages';
const BASE = process.env.BASE ?? '/threejs-demos/';

// --- Discover demos ---------------------------------------------------------

const demos = readdirSync(path.join(root, 'demos'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name)
  .filter((name) => existsSync(path.join(root, 'demos', name, 'main.ts')))
  .sort();

if (!demos.length) {
  console.error('No demos found under demos/*/main.ts');
  process.exit(1);
}
console.log(`Building ${demos.length} demos → ${OUT}/ (base ${BASE})\n`);

// --- Generate one index.html per demo ---------------------------------------
// Vite needs a real HTML file per entry to treat this as a multi-page app. These
// are throwaway: gitignored, and removed again in the finally block below.

const pageHtml = (demo) => `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${demo}</title>
  <style>
    body {
      margin: 0;
      overflow: hidden;
    }
  </style>
</head>

<body>
  <script type="module" src="./main.ts"></script>
</body>

</html>
`;

const generated = demos.map((d) => path.join(root, 'demos', d, 'index.html'));
for (const [i, d] of demos.entries()) writeFileSync(generated[i], pageHtml(d));

// --- Build ------------------------------------------------------------------

try {
  await build({
    root,
    base: BASE,
    configFile: path.join(root, 'vite.config.ts'),
    build: {
      outDir: OUT,
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        input: Object.fromEntries(demos.map((d, i) => [d, generated[i]])),
        // Override the single-demo config's fixed 'main.js' names — 138 entries
        // cannot all be main.js, and hashes let the shared chunks cache forever.
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  });
} catch (err) {
  // Rollup names the offending module in the error; surface it prominently
  // rather than burying it in a stack trace.
  console.error('\n─────────────────────────────────────────────');
  console.error('BUILD FAILED');
  if (err?.id) console.error(`  in: ${path.relative(root, err.id)}`);
  if (err?.loc?.file) console.error(`  at: ${path.relative(root, err.loc.file)}:${err.loc.line}`);
  console.error(`  ${err?.message ?? err}`);
  console.error('─────────────────────────────────────────────\n');
  process.exitCode = 1;
} finally {
  for (const f of generated) rmSync(f, { force: true });
}
if (process.exitCode) process.exit(process.exitCode);

// --- Flatten demos/<name>/ → <name>/ ----------------------------------------
// HTML entries land at a path mirroring their source location. Absolute base
// means the asset URLs inside don't care that we move the directory.

const outDir = path.join(root, OUT);
const nested = path.join(outDir, 'demos');
for (const d of demos) {
  const from = path.join(nested, d);
  if (existsSync(from)) renameSync(from, path.join(outDir, d));
}
rmSync(nested, { recursive: true, force: true });

// --- Gallery index ----------------------------------------------------------

writeFileSync(path.join(outDir, '.nojekyll'), '');
writeFileSync(path.join(outDir, 'index.html'), gallery(demos, BASE));

console.log(`\n✓ ${demos.length} demos → ${OUT}/`);
console.log(`  gallery: ${BASE}`);
console.log(`  a demo:  ${BASE}${demos[0]}/`);

function gallery(list, base) {
  const items = list
    .map((d) => `      <a class="demo" href="${base}${d}/">${d}</a>`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>math demos</title>
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
    <h1>math demos</h1>
    <div class="count">${list.length} demos</div>
    <input id="filter" type="search" placeholder="filter…" autocomplete="off" />
  </header>
  <div class="grid" id="grid">
${items}
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
}
