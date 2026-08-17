import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [, , mode, demo] = process.argv;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const runVite = (args, env) => {
  const child = spawn('npx', ['vite', ...args], { stdio: 'inherit', cwd: root, env: { ...process.env, ...env } });
  child.on('exit', (code) => process.exit(code ?? 0));
};

// `npm run dev` with no demo name serves a gallery linking to every demo — see
// the demo-gallery plugin in vite.config.ts. index.html is left untouched, so
// whichever demo it points at stays selected for a bare `npx vite`.
if (!demo && mode === 'dev') {
  runVite([], { DEMO_GALLERY: '1' });
} else {
  runOneDemo();
}

function runOneDemo() {
  if (!demo) {
    console.error(`Usage: npm run ${mode ?? '<dev|build|preview>'} <demo-name>`);
    process.exit(1);
  }

  const demoEntry = path.join(root, 'demos', demo, 'main.ts');
  if (!existsSync(demoEntry)) {
    console.error(`Demo not found: demos/${demo}/main.ts`);
    process.exit(1);
  }

  // Rewrite the script-tag line in index.html on disk, then run vite. Vite reads
  // the file fresh, so this behaves identically to editing it by hand.
  const indexPath = path.join(root, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  const scriptTagRe = /<script\s+type="module"\s+src="\/demos\/[^"]+"><\/script>/;
  if (!scriptTagRe.test(html)) {
    console.error('Could not find <script type="module" src="/demos/..."> in index.html');
    process.exit(1);
  }
  writeFileSync(
    indexPath,
    html.replace(scriptTagRe, `<script type="module" src="/demos/${demo}/main.ts"></script>`)
  );

  const viteArgs =
    mode === 'build' ? ['build', '--outDir', `dist/${demo}`]
    : mode === 'preview' ? ['preview', '--outDir', `dist/${demo}`]
    : [];
  runVite(viteArgs);
}
