/**
 * Numerical validation of the relativity core (run in Node, no THREE.js).
 *
 *   node --import ./scripts/reg-alias.mjs scripts/validate-relativity.ts
 */

import { Euclidean } from '@/math/manifolds';
import { integrate, rk4 } from '@/math/ode';
import { geodesicDeriv, geodesicNorm } from '@/math/geodesics/geodesicFlow';
import { Schwarzschild } from '@/math/relativity/Schwarzschild';
import { MajumdarPapapetrou } from '@/math/relativity/MajumdarPapapetrou';
import { opticalMetric } from '@/math/relativity/opticalMetric';
import { nullVelocity, sampleLightCone } from '@/math/relativity/nullGeodesic';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  const tag = ok ? '  ok ' : 'FAIL ';
  if (!ok) failures++;
  console.log(`${tag} ${name}${detail ? '  — ' + detail : ''}`);
}
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// 1. Flat space: geodesic is a straight line, zero acceleration.
{
  const flat = new Euclidean(3);
  const deriv = geodesicDeriv(flat);
  const traj = integrate({ deriv, initial: [0, 0, 0, 1, 2, 3], dt: 0.1, steps: 10 });
  const end = traj.states[traj.states.length - 1];
  check('flat ℝ³ straight line', close(end[0], 1, 1e-9) && close(end[1], 2, 1e-9) && close(end[2], 3, 1e-9),
    `end pos = [${end.slice(0, 3).map((x) => x.toFixed(3))}]`);
}

// 2. Schwarzschild optical metric (Riemannian): geodesic preserves |v|².
{
  const bh = new Schwarzschild({ mass: 1 });
  const opt = bh.chart('optical');
  const deriv = geodesicDeriv(opt);
  // Launch at (x,y) = (8,0) heading mostly +y with some -x (an inbound ray).
  let state = [8, 0, -0.4, 1];
  const n0 = geodesicNorm(opt, state);
  const traj = integrate({ deriv, initial: state, dt: 0.01, steps: 4000, stepper: rk4 });
  const n1 = geodesicNorm(opt, traj.states[traj.states.length - 1]);
  check('optical metric preserves |v|²', close(n0, n1, 1e-4 * Math.abs(n0) + 1e-6),
    `|v|²: ${n0.toFixed(6)} → ${n1.toFixed(6)}`);
}

// 3. Generic opticalMetric(standard) matches Schwarzschild's analytic optical chart.
{
  const bh = new Schwarzschild({ mass: 1 });
  const direct = bh.chart('optical');
  const derived = opticalMetric(bh.chart('standard'));
  let maxErr = 0;
  for (const p of [[5, 0], [3, 4], [-6, 2], [10, -3]]) {
    const a = direct.computeMetric(p).data;
    const b = derived.computeMetric(p).data;
    for (let i = 0; i < 4; i++) maxErr = Math.max(maxErr, Math.abs(a[i] - b[i]));
  }
  check('opticalMetric(standard) == analytic optical', maxErr < 1e-9, `max |Δg| = ${maxErr.toExponential(2)}`);
}

// 4. MP optical metric is U⁴·δ.
{
  const mp = new MajumdarPapapetrou();
  const opt = mp.chart('optical');
  let maxErr = 0;
  for (const p of [[0, 0.0001 + 3], [5, 1], [-4, -2]]) {
    const U = mp.potential(p[0], p[1]);
    const U4 = U * U * U * U;
    const g = opt.computeMetric(p).data;
    maxErr = Math.max(maxErr, Math.abs(g[0] - U4), Math.abs(g[3] - U4), Math.abs(g[1]), Math.abs(g[2]));
  }
  check('MP optical metric = U⁴·δ', maxErr < 1e-7, `max |Δ| = ${maxErr.toExponential(2)}`);
}

// 5. Null velocity really is null on the Lorentzian chart.
{
  const bh = new Schwarzschild({ mass: 1 });
  const std = bh.chart('standard');
  const event = [0, 8, 0];
  const v = nullVelocity(std, event, [Math.cos(0.7), Math.sin(0.7)]);
  const norm = geodesicNorm(std, [...event, ...v]);
  check('nullVelocity gives g(v,v)=0', close(norm, 0, 1e-9), `g(v,v) = ${norm.toExponential(2)}, v^t = ${v[0].toFixed(4)}`);
}

// 6. Photon sphere: a null ray launched tangentially at r = 3M orbits at ~constant r.
{
  const bh = new Schwarzschild({ mass: 1 });
  const std = bh.chart('standard');
  const r0 = 3; // = 3M
  const event = [0, r0, 0];
  // Tangential spatial direction at (r0, 0) is +y.
  const v = nullVelocity(std, event, [0, 1]);
  const deriv = geodesicDeriv(std);
  let state = [...event, ...v];
  let minR = Infinity, maxR = -Infinity;
  for (let k = 0; k < 1200; k++) {
    const traj = integrate({ deriv, initial: state, dt: 0.01, steps: 1 });
    state = traj.states[traj.states.length - 1];
    const r = Math.hypot(state[1], state[2]);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
  }
  check('photon sphere orbit stays near r=3M', close(minR, 3, 0.05) && close(maxR, 3, 0.05),
    `r ∈ [${minR.toFixed(3)}, ${maxR.toFixed(3)}]`);
}

// 7. Light-cone sampler returns a rectangular grid that freezes at the horizon.
{
  const bh = new Schwarzschild({ mass: 1 });
  const std = bh.chart('standard');
  const rH = bh.horizonRadius();
  const rays = sampleLightCone(std, [0, 6, 0], {
    rays: 16, steps: 200, dt: 0.03,
    stop: (c) => Math.hypot(c[1], c[2]) < rH * 1.001,
  });
  const rectangular = rays.every((r) => r.points.length === 201 && r.coords.length === 201);
  const someStopped = rays.some((r) => r.stopped);
  check('light cone grid rectangular', rectangular, `${rays.length} rays`);
  check('some rays fall through horizon (freeze)', someStopped, `${rays.filter((r) => r.stopped).length}/16 stopped`);
}

// 8. Eddington–Finkelstein: regular across the horizon + cone tipping.
{
  const bh = new Schwarzschild({ mass: 1, extent: 40 });
  const ef = bh.chart('eddingtonFinkelstein');
  const deriv = geodesicDeriv(ef);

  // Null vectors really are null at several radii (incl. just outside horizon).
  let maxNorm = 0;
  for (const r of [8, 4, 2.2]) {
    for (let a = 0; a < 8; a++) {
      const th = (a * Math.PI) / 4;
      const v = nullVelocity(ef, [0, r, 0], [Math.cos(th), Math.sin(th)]);
      maxNorm = Math.max(maxNorm, Math.abs(geodesicNorm(ef, [0, r, 0, ...v])));
    }
  }
  check('EF null vectors are null', maxNorm < 1e-10, `max |g(v,v)| = ${maxNorm.toExponential(2)}`);

  // Tipping: at r=8 the cone has escaping rays; just outside the horizon none escape.
  function escapes(r0: number): { escaped: number; nan: boolean } {
    let escaped = 0, nan = false;
    for (let i = 0; i < 48; i++) {
      const th = (2 * Math.PI * i) / 48;
      let s = [0, r0, 0, ...nullVelocity(ef, [0, r0, 0], [Math.cos(th), Math.sin(th)])];
      for (let k = 0; k < 400; k++) {
        const traj = integrate({ deriv, initial: s, dt: 0.025, steps: 1 });
        s = traj.states[traj.states.length - 1];
        const rr = Math.hypot(s[1], s[2]);
        if (!Number.isFinite(rr)) { nan = true; break; }
        if (rr < 1.0) break;
        if (rr > 14) { escaped++; break; }
      }
    }
    return { escaped, nan };
  }
  const far = escapes(8);
  const lip = escapes(2.15);
  check('EF cone tips: far escapes, horizon-lip does not',
    far.escaped > 5 && lip.escaped === 0 && !far.nan && !lip.nan,
    `escaped: r=8 → ${far.escaped}, r=2.15 → ${lip.escaped}`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
