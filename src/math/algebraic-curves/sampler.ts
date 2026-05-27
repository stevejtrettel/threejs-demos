import type { HomoPoly } from './homopoly';
import { restrictToLine } from './homopoly';
import type { CP2Point } from '../cp2/point';
import { cp2Norm, randomCP2Direction, lineAt } from '../cp2/point';
import { findRoots } from './rootfind';

export type SamplerOptions = {
  steps: number;
  /** If true, every step adds all d-1 new intersections to the cloud. Default true. */
  branching?: boolean;
};

/**
 * Random walk on the variety F=0 in CP^2.
 *
 * At each step, picks a random direction q, restricts F to the line through the
 * current point p with direction q to get f(t) = F(p + t q), a degree-d
 * polynomial in t with f(0) ≈ 0. Deflates by t (drops the constant term, which
 * is the residual F(p) ≈ 0) and finds the d-1 other roots. Walks to one of them.
 */
export function walkSample(
  F: HomoPoly,
  startPoint: CP2Point,
  opts: SamplerOptions,
): CP2Point[] {
  const branching = opts.branching ?? true;
  const out: CP2Point[] = [];
  let current = cp2Norm(startPoint);
  out.push(current);

  for (let step = 0; step < opts.steps; step++) {
    const q = randomCP2Direction();
    const f = restrictToLine(F, current, q);
    if (f.length <= 1) continue;

    // Deflate by t: f(t) = t * g(t) + (residual). Drop f[0] (the residual) and
    // root-find on f[1] + f[2] t + ... + f[d] t^(d-1).
    const deflated = f.slice(1);
    const roots = findRoots(deflated);
    if (roots.length === 0) continue;

    const newPoints: CP2Point[] = roots.map((t) => cp2Norm(lineAt(current, q, t)));

    if (branching) {
      for (const np of newPoints) out.push(np);
      current = newPoints[Math.floor(Math.random() * newPoints.length)];
    } else {
      const np = newPoints[Math.floor(Math.random() * newPoints.length)];
      out.push(np);
      current = np;
    }
  }
  return out;
}
