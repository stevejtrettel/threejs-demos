// The OUTER estimate of the stable-norm unit ball: a circumscribed polygon.
//
// The inner estimate (stableNorm.ts) hulls the boundary samples ±(p,q)/ℓ, so
// its area underestimates V. For an upper bound we need supporting lines. At a
// rational direction the McShane–Rivin ball has a genuine corner, and its two
// one-sided supporting functionals are computable in closed form from three
// traces (Doan–Li–Nguyen, "McShane–Rivin Norm Balls…", Prop 3.1 / eq. (3.13)):
//
//   for Farey neighbours u, v (det = ±1) with gap mediant m = u + v,
//     x_m = (x_u x_v + √((x_u x_v)² − 4(x_u² + x_v²))) / 2      (larger Fricke root)
//     A   = (x_m − x_v·e^{−ℓ_u/2}) / √(x_u²−4),   ℓ_u = ‖u‖ = 2·arccosh(x_u/2)
//   then the one-sided functional λ_{u|v} at p_u (selected toward v) satisfies
//     λ_{u|v}(u) = ℓ_u,   λ_{u|v}(v) = 2·ln A,
//   and symmetrically λ_{v|u}(v) = ℓ_v, λ_{v|u}(u) = 2·ln B with the v-version of A.
//
// Each line {λ = 1} supports B_X, so B_X lies in their intersection. Over one
// gap the boundary arc sits inside the triangle (p_u, p_v, q_{uv}) where q_{uv}
// is where the two support lines meet. Gluing those caps onto the inner hull
// gives a circumscribed polygon whose area is ≥ V — for ANY cutoff R, with no
// contraction/tail argument. The more directions, the tighter.

import { traceToLength, generateCurves, type TraceTriple } from './markoff';
import { polygonArea, type Vec2 } from '@/math/geometry';

export interface Dir {
  p: number;
  q: number;
  trace: number;
  P: Vec2; // boundary sample (p, q)/ℓ
}

/**
 * All primitive boundary directions with p²+q² ≤ R², around the full circle,
 * each carrying its trace and boundary sample. generateCurves covers the upper
 * semicircle [0, π); central symmetry (−w shares the trace) fills the rest.
 * Sorted by angle, so consecutive entries (cyclically) are Farey neighbours.
 */
export function boundaryDirections(triple: TraceTriple, radius: number): Dir[] {
  const dirs: Dir[] = [];
  for (const c of generateCurves(triple, radius)) {
    const l = c.length;
    if (!Number.isFinite(l) || l <= 0) continue;
    const { p, q } = c.slope;
    const P: Vec2 = [p / l, q / l];
    dirs.push({ p, q, trace: c.trace, P });
    dirs.push({ p: -p, q: -q, trace: c.trace, P: [-P[0], -P[1]] });
  }
  dirs.sort((a, b) => Math.atan2(a.q, a.p) - Math.atan2(b.q, b.p));
  return dirs;
}

/** Covector (l1, l2) with λ(u) = cu, λ(v) = cv, given the basis u, v. */
function covector(u: Dir, v: Dir, cu: number, cv: number): [number, number] | null {
  const D = u.p * v.q - u.q * v.p; // det(u, v)
  if (Math.abs(D) < 1e-12) return null;
  return [(cu * v.q - cv * u.q) / D, (u.p * cv - v.p * cu) / D];
}

/**
 * The two one-sided supporting covectors of the gap between cyclically-consecutive
 * boundary directions u, v (closed form, Doan–Li–Nguyen): `atU` = λ_{u|v} (support
 * at P_u toward v), `atV` = λ_{v|u} (support at P_v toward u). Each line {λ·X = 1}
 * supports the ball. Null if the traces are degenerate.
 */
export function gapSupports(u: Dir, v: Dir): { atU: Vec2; atV: Vec2 } | null {
  // Orient so det(u, v) = +1 (mediant u+v lies in the gap between them).
  if (u.p * v.q - u.q * v.p < 0) [u, v] = [v, u];

  const xu = Math.abs(u.trace);
  const xv = Math.abs(v.trace);
  const su = Math.sqrt(xu * xu - 4); // e^{ℓ_u/2} − e^{−ℓ_u/2}
  const sv = Math.sqrt(xv * xv - 4);
  if (!(su > 0) || !(sv > 0)) return null;

  // Larger Fricke root from x_u, x_v alone.
  const disc = (xu * xv) ** 2 - 4 * (xu * xu + xv * xv);
  if (disc < 0) return null;
  const xm = (xu * xv + Math.sqrt(disc)) / 2;

  const A = (xm - xv * (xu - su) / 2) / su; // (x_m − x_v·e^{−ℓ_u/2})/√(x_u²−4)
  const B = (xm - xu * (xv - sv) / 2) / sv;
  if (!(A > 0) || !(B > 0)) return null;

  const lu = traceToLength(xu); // ‖u‖
  const lv = traceToLength(xv);
  const atU = covector(u, v, lu, 2 * Math.log(A));        // λ_{u|v}
  const atV = covector(u, v, 2 * Math.log(B), lv);        // λ_{v|u}
  if (!atU || !atV) return null;
  return { atU, atV };
}

/**
 * Apex q_{uv} where the two one-sided support lines of the gap (u, v) meet, or
 * null if the gap is too flat to give a well-conditioned outward apex (then the
 * chord already approximates the boundary to negligible error). u, v must be
 * cyclically-consecutive boundary directions with the mediant in their gap.
 */
function gapApex(u: Dir, v: Dir): Vec2 | null {
  if (u.p * v.q - u.q * v.p < 0) [u, v] = [v, u];
  const g = gapSupports(u, v);
  if (!g) return null;
  const { atU: lam, atV: mu } = g;

  // Intersect {lam·X = 1} and {mu·X = 1}.
  const D2 = lam[0] * mu[1] - lam[1] * mu[0];
  if (Math.abs(D2) < 1e-12) return null;
  const apex: Vec2 = [(mu[1] - lam[1]) / D2, (lam[0] - mu[0]) / D2];
  if (!Number.isFinite(apex[0]) || !Number.isFinite(apex[1])) return null;

  // Keep the apex only if it lies strictly outside the chord (farther from the
  // origin than the line through P_u, P_v). Otherwise drop to the chord.
  const ex = v.P[1] - u.P[1];
  const ey = -(v.P[0] - u.P[0]); // outward normal to chord (origin side is < 0)
  const base = ex * u.P[0] + ey * u.P[1];
  if (Math.sign(base) * (ex * apex[0] + ey * apex[1]) <= Math.sign(base) * base) return null;
  return apex;
}

/**
 * The circumscribed polygon: boundary samples interleaved with gap apexes,
 * around the full circle. Contains B_X, so its area is an upper bound for V.
 */
export function normBallUpperPolygon(triple: TraceTriple, radius: number): Vec2[] {
  const dirs = boundaryDirections(triple, radius);
  const out: Vec2[] = [];
  for (let i = 0; i < dirs.length; i++) {
    out.push(dirs[i]!.P);
    const apex = gapApex(dirs[i]!, dirs[(i + 1) % dirs.length]!);
    if (apex) out.push(apex);
  }
  return out;
}

/** The upper estimate V ≤ U_R: area of the circumscribed polygon. */
export function normBallUpperArea(triple: TraceTriple, radius: number): number {
  return polygonArea(normBallUpperPolygon(triple, radius));
}
