import type { Complex } from './complex';

/**
 * Lifting paths from the x-plane to the elliptic curve y² = w(x).
 *
 * The projection (x, y) → x is a 2-to-1 branched cover; over each x there are
 * two preimages y = ±√w(x). Naive use of the principal complex square root
 * has branch cuts that flip y between sheets, so a lifted path discontinuously
 * teleports. We resolve this by analytic continuation: at each step pick the
 * root of y² = w(x) closest to the previous y.
 */

/** Principal complex square root with Re(√z) ≥ 0. */
export function csqrt(z: Complex): Complex {
  const r = Math.hypot(z.re, z.im);
  const sgn = z.im >= 0 ? 1 : -1;
  return {
    re: Math.sqrt(Math.max(0, (r + z.re) * 0.5)),
    im: sgn * Math.sqrt(Math.max(0, (r - z.re) * 0.5)),
  };
}

function clerp(a: Complex, b: Complex, t: number): Complex {
  return {
    re: a.re + (b.re - a.re) * t,
    im: a.im + (b.im - a.im) * t,
  };
}

export type AffinePoint = { x: Complex; y: Complex };

/**
 * Lift the straight segment from a to b in the x-plane to a closed loop on
 * y² = w(x), assuming both endpoints are branch points (w(a) = w(b) = 0).
 *
 * Method: analytic continuation of √w along the segment from t = eps to
 * t = 1 - eps (avoiding 0/0 at the endpoints), then prepend (a, 0), append
 * (b, 0), and walk back along the negated branch. The result is a closed
 * loop in the affine chart {Z = 1} of CP².
 *
 * Caveat: if w(γ(t)) vanishes for some interior t, the nearest-neighbor
 * branch choice can flip — the caller should pick segments that don't pass
 * through other branch points.
 */
export function liftSegmentLoop(
  a: Complex,
  b: Complex,
  polyEval: (x: Complex) => Complex,
  N = 200,
): AffinePoint[] {
  const eps = 1e-4;
  const dt = (1 - 2 * eps) / (N - 1);

  // Forward: pick the principal branch at t = eps; from then on, choose
  // whichever root sits closer to the previous y.
  const upper: AffinePoint[] = [];
  const x0 = clerp(a, b, eps);
  let yPrev = csqrt(polyEval(x0));
  upper.push({ x: x0, y: yPrev });

  for (let k = 1; k < N; k++) {
    const t = eps + k * dt;
    const x = clerp(a, b, t);
    const y0 = csqrt(polyEval(x));
    const dPos =
      (y0.re - yPrev.re) * (y0.re - yPrev.re) +
      (y0.im - yPrev.im) * (y0.im - yPrev.im);
    const dNeg =
      (y0.re + yPrev.re) * (y0.re + yPrev.re) +
      (y0.im + yPrev.im) * (y0.im + yPrev.im);
    const y = dPos <= dNeg ? y0 : { re: -y0.re, im: -y0.im };
    upper.push({ x, y });
    yPrev = y;
  }

  const zero: Complex = { re: 0, im: 0 };
  const loop: AffinePoint[] = [{ x: a, y: zero }];
  for (const p of upper) loop.push(p);
  loop.push({ x: b, y: zero });
  for (let i = upper.length - 1; i >= 0; i--) {
    loop.push({
      x: upper[i].x,
      y: { re: -upper[i].y.re, im: -upper[i].y.im },
    });
  }
  return loop;
}
