/**
 * Installs the GitHub Pages setup into another demo repo.
 *
 * Copies build-all.mjs, adds the `build:all` npm script, writes a workflow that
 * calls the shared reusable workflow in this repo, and extends .gitignore.
 * Nothing is committed — inspect with `git status` in the target and commit the
 * listed paths yourself.
 *
 *   node scripts/add-pages.mjs ../limit-sets ../homogeneous-spaces
 *
 * Re-running is safe: every step is idempotent and skips work already done.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_REPO = 'stevejtrettel/threejs-demos';

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('Usage: node scripts/add-pages.mjs <repo-path> [<repo-path>...]');
  process.exit(1);
}

// The caller workflow: everything real lives in the shared reusable workflow, so
// version bumps happen once, in the source repo.
const CALLER_WORKFLOW = `name: Deploy demos

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    uses: ${SOURCE_REPO}/.github/workflows/pages.yml@main
`;

const GITIGNORE_BLOCK = `
# GitHub Pages build (scripts/build-all.mjs)
dist-pages
demos/*/index.html
demos/__pages
`;

let failures = 0;

for (const rel of targets) {
  const repo = path.resolve(rel);
  const name = path.basename(repo);
  console.log(`\n─── ${name}`);

  const problems = [];
  if (!existsSync(path.join(repo, '.git'))) problems.push('not a git repo');
  if (!existsSync(path.join(repo, 'demos'))) problems.push('no demos/ directory');
  if (!existsSync(path.join(repo, 'package.json'))) problems.push('no package.json');
  if (problems.length) {
    console.log(`  ✗ skipped: ${problems.join(', ')}`);
    failures++;
    continue;
  }

  const changed = [];

  // 1. build-all.mjs — always refresh, so fixes propagate on re-run.
  mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  const dest = path.join(repo, 'scripts', 'build-all.mjs');
  const src = path.join(here, 'scripts', 'build-all.mjs');
  const before = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
  copyFileSync(src, dest);
  if (before !== readFileSync(dest, 'utf8')) changed.push('scripts/build-all.mjs');

  // 2. npm script. Inserted textually rather than via JSON.stringify so the
  //    file's existing formatting survives untouched.
  const pkgPath = path.join(repo, 'package.json');
  const pkgRaw = readFileSync(pkgPath, 'utf8');
  if (!/"build:all"\s*:/.test(pkgRaw)) {
    const m = pkgRaw.match(/"scripts"\s*:\s*\{\n(\s*)/);
    if (m) {
      const indent = m[1];
      writeFileSync(
        pkgPath,
        pkgRaw.replace(m[0], `${m[0]}"build:all": "node scripts/build-all.mjs",\n${indent}`)
      );
      changed.push('package.json');
    } else {
      console.log('  ! could not find a "scripts" block — add manually:');
      console.log('      "build:all": "node scripts/build-all.mjs"');
    }
  }

  // 3. Caller workflow.
  const wfDir = path.join(repo, '.github', 'workflows');
  mkdirSync(wfDir, { recursive: true });
  const wfPath = path.join(wfDir, 'pages.yml');
  if (!existsSync(wfPath) || readFileSync(wfPath, 'utf8') !== CALLER_WORKFLOW) {
    writeFileSync(wfPath, CALLER_WORKFLOW);
    changed.push('.github/workflows/pages.yml');
  }

  // 4. .gitignore.
  const giPath = path.join(repo, '.gitignore');
  const gi = existsSync(giPath) ? readFileSync(giPath, 'utf8') : '';
  if (!gi.includes('dist-pages')) {
    writeFileSync(giPath, gi.replace(/\n*$/, '\n') + GITIGNORE_BLOCK);
    changed.push('.gitignore');
  }

  console.log(changed.length ? `  ✓ ${changed.join(', ')}` : '  ✓ already up to date');
}

console.log(
  `\n${targets.length - failures}/${targets.length} repos prepared.` +
    (failures ? ` ${failures} skipped.` : '')
);
process.exit(failures ? 1 : 0);
