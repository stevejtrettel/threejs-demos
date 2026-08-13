/**
 * Builds every demo in this repo into one static site for GitHub Pages.
 *
 * Unlike a per-demo build — which produces a standalone, fully self-contained
 * bundle (the right thing for dropping a single demo into a blog iframe) — this
 * does ONE multi-page vite build over all demos at once. Rollup then hoists
 * everything they share (three.js above all) into common chunks, so the site
 * ships one copy of three instead of one per demo, and a visitor clicking
 * between demos downloads it once.
 *
 * That sharing is also why this forces an absolute `base` rather than the './'
 * a per-demo build wants: the pages sit at different depths under demos/ before
 * being flattened, and absolute URLs survive the move.
 *
 *   node scripts/build-all.mjs            → dist-pages/, base from BASE or /<repo>/
 *   BASE=/ node scripts/build-all.mjs     → for a root-hosted deploy
 *
 * Layouts understood (first match wins):
 *   demos/<name>/main.{ts,js,tsx,jsx}   — a directory per demo
 *   demos/<name>/index.{ts,js}          — ditto
 *   demos/<name>.html                   — a flat hand-written page per demo
 *   demos/<name>.{ts,js}                — a flat source file per demo
 *
 * A demo directory that already contains its own index.html keeps it; that file
 * is used as the entry untouched, so demos needing custom markup still work.
 * Such a page is skipped (with a warning) if the script it references no longer
 * exists — one abandoned demo directory should not block the whole site.
 *
 * This script is repo-agnostic — it is copied verbatim between demo repos.
 */

import { build } from 'vite';
import { readdirSync, readFileSync, existsSync, writeFileSync, rmSync, renameSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'dist-pages';
const DEMOS = path.join(root, 'demos');

// Default the base to the repo's own name, matching how project Pages sites are
// served at /<repo>/. CI passes BASE explicitly.
const repoName = path.basename(root);
const BASE = process.env.BASE ?? `/${repoName}/`;

// Staging area for entry HTML of demos that are single files rather than
// directories — they have nowhere of their own to put an index.html.
const STAGE = path.join(DEMOS, '__pages');

if (!existsSync(DEMOS)) {
  console.error(`No demos/ directory in ${root}`);
  process.exit(1);
}

// --- Discover demos ---------------------------------------------------------

const NESTED_ENTRIES = ['main.ts', 'main.js', 'main.tsx', 'main.jsx', 'index.ts', 'index.js'];
const FLAT_EXTS = ['.ts', '.js', '.tsx', '.jsx'];
const skip = (name) => name.startsWith('_') || name.startsWith('.') || name === '__pages';

const entries = readdirSync(DEMOS, { withFileTypes: true });
const warnings = [];

// Resolve a script src the way vite would. A root-absolute src is relative to
// the vite root, which differs between repos (some set root: 'demos'), so try
// demos/ first and then the repo root rather than parsing the config.
function resolveSrc(src, htmlDir) {
  const clean = src.split('?')[0];
  if (!clean.startsWith('/')) return path.resolve(htmlDir, clean);
  const rel = clean.slice(1);
  const viaDemos = path.join(DEMOS, rel);
  return existsSync(viaDemos) ? viaDemos : path.join(root, rel);
}

// A hand-written page is only usable if the modules it references still exist —
// otherwise it is an abandoned demo whose source was deleted, and including it
// would fail the entire build.
function scriptSrcs(html) {
  return [...readFileSync(html, 'utf8').matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((s) => !/^(https?:)?\/\//.test(s));
}
function pageIsLive(html) {
  const dir = path.dirname(html);
  const dead = scriptSrcs(html).filter((s) => !existsSync(resolveSrc(s, dir)));
  return { ok: dead.length === 0, dead };
}

// Copy a hand-written page into the staging dir, rewriting its script srcs to
// paths relative to the new location. This keeps the page's own markup (which
// the demo may depend on) while giving every layout one uniform output shape.
function stagePage(html, name) {
  const dir = path.dirname(html);
  const staged = path.join(STAGE, name, 'index.html');
  let text = readFileSync(html, 'utf8');
  for (const src of scriptSrcs(html)) {
    const abs = resolveSrc(src, dir);
    let relPath = path.relative(path.dirname(staged), abs).split(path.sep).join('/');
    if (!relPath.startsWith('.')) relPath = `./${relPath}`;
    text = text.replaceAll(`"${src}"`, `"${relPath}"`).replaceAll(`'${src}'`, `'${relPath}'`);
  }
  mkdirSync(path.dirname(staged), { recursive: true });
  writeFileSync(staged, text);
  return staged;
}

// Preferred layout: a directory per demo.
let demos = entries
  .filter((e) => e.isDirectory() && !skip(e.name))
  .map((e) => {
    const dir = path.join(DEMOS, e.name);
    const own = path.join(dir, 'index.html');
    // A hand-written index.html wins — never clobber it, just use it.
    if (existsSync(own)) {
      const { ok, dead } = pageIsLive(own);
      if (!ok) {
        warnings.push(`skipped ${e.name}/ — index.html references missing ${dead.join(', ')}`);
        return null;
      }
      return { name: e.name, html: own, generated: false };
    }
    const entry = NESTED_ENTRIES.find((f) => existsSync(path.join(dir, f)));
    return entry ? { name: e.name, html: own, generated: true, src: `./${entry}` } : null;
  })
  .filter(Boolean);

// Fallback: hand-written pages sitting flat in demos/. These are real entries,
// so prefer them over the source files they pull in.
if (!demos.length) {
  demos = entries
    .filter((e) => e.isFile() && path.extname(e.name) === '.html' && !skip(e.name))
    .map((e) => {
      const html = path.join(DEMOS, e.name);
      const { ok, dead } = pageIsLive(html);
      if (!ok) {
        warnings.push(`skipped ${e.name} — references missing ${dead.join(', ')}`);
        return null;
      }
      const name = path.basename(e.name, '.html');
      return { name, html: stagePage(html, name), generated: true, staged: true };
    })
    .filter(Boolean);
}

// Last resort: a flat source file per demo. Entry HTML goes in the staging dir
// and points back up at the source.
if (!demos.length) {
  demos = entries
    .filter((e) => e.isFile() && FLAT_EXTS.includes(path.extname(e.name)) && !skip(e.name))
    .map((e) => {
      const name = path.basename(e.name, path.extname(e.name));
      return {
        name,
        html: path.join(STAGE, name, 'index.html'),
        generated: true,
        src: `../../${e.name}`,
      };
    });
}

for (const w of warnings) console.warn(`  ! ${w}`);

demos.sort((a, b) => a.name.localeCompare(b.name));

if (!demos.length) {
  console.error(`No demos found under ${path.relative(root, DEMOS)}/ (looked for ${NESTED_ENTRIES.join(', ')} and flat ${FLAT_EXTS.join('/')} files)`);
  process.exit(1);
}
console.log(`Building ${demos.length} demos → ${OUT}/ (base ${BASE})\n`);

// --- Generate entry HTML ----------------------------------------------------
// Vite needs a real HTML file per entry to treat this as a multi-page app. The
// generated ones are throwaway: gitignored, and removed in the finally block.

const pageHtml = (name, src) => `<!DOCTYPE html>
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
  <script type="module" src="${src}"></script>
</body>

</html>
`;

for (const d of demos) {
  if (!d.generated || d.staged) continue; // staged pages were written verbatim above
  mkdirSync(path.dirname(d.html), { recursive: true });
  writeFileSync(d.html, pageHtml(d.name, d.src));
}

const cleanup = () => {
  for (const d of demos) if (d.generated && !d.html.startsWith(STAGE)) rmSync(d.html, { force: true });
  rmSync(STAGE, { recursive: true, force: true });
};

// --- Build ------------------------------------------------------------------

const viteConfig = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']
  .map((f) => path.join(root, f))
  .find(existsSync);

try {
  await build({
    root,
    base: BASE,
    configFile: viteConfig ?? false,
    build: {
      outDir: OUT,
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        input: Object.fromEntries(demos.map((d) => [d.name, d.html])),
        // Override any single-demo config's fixed output names — many entries
        // cannot share one filename, and hashes let shared chunks cache forever.
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
  cleanup();
  process.exit(1);
}
cleanup();

// --- Flatten nested output to <name>/ ---------------------------------------
// HTML entries land at a path mirroring their source location. The absolute
// base means the asset URLs inside don't care that we move the directory.

const outDir = path.join(root, OUT);
for (const d of demos) {
  const rel = path.relative(root, path.dirname(d.html));
  const from = path.join(outDir, rel);
  const to = path.join(outDir, d.name);
  if (from !== to && existsSync(from)) {
    rmSync(to, { recursive: true, force: true });
    mkdirSync(path.dirname(to), { recursive: true });
    renameSync(from, to);
  }
}
rmSync(path.join(outDir, 'demos'), { recursive: true, force: true });

// --- Gallery index ----------------------------------------------------------

writeFileSync(path.join(outDir, '.nojekyll'), '');
writeFileSync(path.join(outDir, 'index.html'), gallery(demos.map((d) => d.name), BASE, repoName));

console.log(`\n✓ ${demos.length} demos → ${OUT}/`);
console.log(`  gallery: ${BASE}`);
console.log(`  a demo:  ${BASE}${demos[0].name}/`);

function gallery(list, base, title) {
  const items = list
    .map((d) => `      <a class="demo" href="${base}${d}/">${d}</a>`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
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
    <h1>${title}</h1>
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
