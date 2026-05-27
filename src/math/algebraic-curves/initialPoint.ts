import type { HomoPoly } from './homopoly';
import { restrictToLine } from './homopoly';
import type { CP2Point } from '../cp2/point';
import { randomCP2Direction, lineAt, cp2Norm } from '../cp2/point';
import { findRoots } from './rootfind';

/**
 * Find any point on the variety F=0 by intersecting a random line in CP^2.
 * Returns the intersection nearest the seed point p (smallest |t|), to keep
 * coordinates from blowing up near infinity.
 */
export function findInitialPoint(F: HomoPoly, maxAttempts = 32): CP2Point {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const p = randomCP2Direction();
    const q = randomCP2Direction();
    const f = restrictToLine(F, p, q);
    const roots = findRoots(f);
    if (roots.length === 0) continue;
    let best = roots[0];
    let bestMag = best.re * best.re + best.im * best.im;
    for (let i = 1; i < roots.length; i++) {
      const m = roots[i].re * roots[i].re + roots[i].im * roots[i].im;
      if (m < bestMag) {
        best = roots[i];
        bestMag = m;
      }
    }
    return cp2Norm(lineAt(p, q, best));
  }
  throw new Error('findInitialPoint: failed to find a point on the variety');
}
