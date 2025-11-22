import * as THREE from 'three';

/**
 * Uniform-spacing Catmull-Rom interpolation for Vector2/Vector3
 * Ported from reference/geodesic-boards/interpolators/catmullRomVector.js
 *
 * @param xs - Increasing parameter values
 * @param ys - Corresponding Vector2 or Vector3 values
 * @returns Interpolation function that takes x and returns interpolated vector
 *
 * @example
 *   const xs = [0, 1, 2, 3];
 *   const ys = [new Vector2(0,0), new Vector2(1,1), new Vector2(2,0), new Vector2(3,1)];
 *   const interp = createCatmullRomVec(xs, ys);
 *   const v = interp(1.5); // Smooth interpolation
 */
export function createCatmullRomVec<T extends THREE.Vector2 | THREE.Vector3>(
  xs: number[],
  ys: T[]
): (x: number) => T {
  const n = xs.length;
  if (n !== ys.length || n < 2) {
    throw new Error('xs and ys must be same length ≥ 2');
  }

  function findInterval(x: number): number {
    let lo = 0,
      hi = n - 1;
    if (x <= xs[0]) return 0;
    if (x >= xs[hi]) return hi - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (xs[mid] > x) hi = mid;
      else lo = mid;
    }
    return lo;
  }

  return function interp(x: number): T {
    // Clamp to endpoints
    if (x <= xs[0]) return ys[0].clone() as T;
    if (x >= xs[n - 1]) return ys[n - 1].clone() as T;

    const i1 = findInterval(x);
    const i0 = Math.max(i1 - 1, 0);
    const i2 = Math.min(i1 + 1, n - 1);
    const i3 = Math.min(i1 + 2, n - 1);

    const x1 = xs[i1],
      x2 = xs[i2];
    const t = (x - x1) / (x2 - x1);
    const t2 = t * t,
      t3 = t2 * t;

    const p0 = ys[i0],
      p1 = ys[i1],
      p2 = ys[i2],
      p3 = ys[i3];

    // Build each term as a new vector
    const term0 = p1.clone().multiplyScalar(2);
    const term1 = p2.clone().sub(p0).multiplyScalar(t);
    const term2 = p0
      .clone()
      .multiplyScalar(2)
      .sub(p1.clone().multiplyScalar(5))
      .add(p2.clone().multiplyScalar(4))
      .sub(p3)
      .multiplyScalar(t2);
    const term3 = p3
      .clone()
      .sub(p2.clone().multiplyScalar(3))
      .add(p1.clone().multiplyScalar(3))
      .sub(p0)
      .multiplyScalar(t3);

    return term0.add(term1).add(term2).add(term3).multiplyScalar(0.5) as T;
  };
}

/**
 * Centripetal Catmull-Rom interpolation for Vector2/Vector3
 * Better for unevenly-spaced data
 * Ported from reference/geodesic-boards/interpolators/catmullRomVector.js
 *
 * @param xs - Increasing parameter values
 * @param ys - Corresponding Vector2 or Vector3 values
 * @param alpha - Parameterization: 0.5 = centripetal (default), 1 = chordal, 0 = uniform
 * @returns Interpolation function that takes x and returns interpolated vector
 */
export function createCentripetalCatmullRomVec<T extends THREE.Vector2 | THREE.Vector3>(
  xs: number[],
  ys: T[],
  alpha: number = 0.5
): (x: number) => T {
  const n = xs.length;
  if (n !== ys.length || n < 2) {
    throw new Error('xs and ys must be same length ≥ 2');
  }

  // Build chord-length params
  const ts = new Array(n);
  ts[0] = 0;
  for (let i = 1; i < n; ++i) {
    ts[i] = ts[i - 1] + Math.pow(Math.abs(xs[i] - xs[i - 1]), alpha);
  }

  function findInterval(x: number): number {
    let lo = 0,
      hi = n - 1;
    if (x <= xs[0]) return 0;
    if (x >= xs[hi]) return hi - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (xs[mid] > x) hi = mid;
      else lo = mid;
    }
    return lo;
  }

  return function interp(x: number): T {
    // Handle endpoints
    if (x <= xs[0]) return ys[0].clone() as T;
    if (x >= xs[n - 1]) return ys[n - 1].clone() as T;

    const i1 = findInterval(x);
    const i0 = Math.max(i1 - 1, 0);
    const i2 = Math.min(i1 + 1, n - 1);
    const i3 = Math.min(i1 + 2, n - 1);

    // Map x -> t linearly on [i1,i2]
    const t1 = ts[i1],
      t2 = ts[i2];
    const x1 = xs[i1],
      x2 = xs[i2];
    const t = t1 + (t2 - t1) * ((x - x1) / (x2 - x1));

    const p0 = ys[i0],
      p1 = ys[i1],
      p2 = ys[i2],
      p3 = ys[i3];

    // Local lerp helper (Vector.lerp mutates, so we clone)
    const lerp = (A: T, B: T, alpha: number) => A.clone().lerp(B, alpha) as T;

    // First level
    const A1 = lerp(p0, p1, (t - ts[i0]) / (t1 - ts[i0]));
    const A2 = lerp(p1, p2, (t - t1) / (t2 - t1));
    const A3 = lerp(p2, p3, (t - t2) / (ts[i3] - t2));
    // Second level
    const B1 = lerp(A1, A2, (t - ts[i0]) / (t2 - ts[i0]));
    const B2 = lerp(A2, A3, (t - t1) / (ts[i3] - t1));
    // Final blend
    return lerp(B1, B2, (t - t1) / (t2 - t1));
  };
}
