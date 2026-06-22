// ESM resolver hook: map the `@/` path alias to ./src and resolve
// extension/index so Node can run the TypeScript math core directly.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const SRC = path.resolve(process.cwd(), 'src');

function resolveFsPath(base) {
  const candidates = [
    base,
    base + '.ts',
    base + '.js',
    path.join(base, 'index.ts'),
    path.join(base, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return base;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const p = resolveFsPath(path.join(SRC, specifier.slice(2)));
    return { url: pathToFileURL(p).href, shortCircuit: true };
  }
  // Resolve extensionless relative imports (./foo → ./foo.ts, ./dir → ./dir/index.ts).
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const p = resolveFsPath(base);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return { url: pathToFileURL(p).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
