import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [, , mode, demo] = process.argv;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!demo) {
  console.error(`Usage: npm run ${mode ?? '<dev|build|preview>'} <demo-name>`);
  process.exit(1);
}

const demoEntry = path.join(root, 'demos', demo, 'main.ts');
if (!existsSync(demoEntry)) {
  console.error(`Demo not found: demos/${demo}/main.ts`);
  process.exit(1);
}

// Rewrite the script-tag line in index.html on disk, then run vite.
// Vite reads the file fresh, so this behaves identically to editing it by hand.
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
const child = spawn('npx', ['vite', ...viteArgs], { stdio: 'inherit', cwd: root });
child.on('exit', (code) => process.exit(code ?? 0));
