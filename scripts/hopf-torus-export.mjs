#!/usr/bin/env node
/**
 * hopf-torus-export.mjs
 *
 * Standalone Node script: samples points from a Hopf torus on S³ ⊂ R⁴
 * (i.e. before stereographic projection to R³). Reimplements the Hopf
 * fibration math locally — does not depend on src/. No build step.
 *
 *   node scripts/hopf-torus-export.mjs
 *
 * For each curve in the CURVES array, writes a CSV file with columns
 * `x,y,z,w` to OUT_DIR. Sampling is uniform in the flat (intrinsic)
 * metric of the torus — i.e. arc-length-corrected along the S² curve.
 */

import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── EDITABLE ───────────────────────────────────────────────────────────────

const TARGET_POINTS = 20000;
const OUT_DIR = 'data/hopf-tori';

const PI = Math.PI;

// A curve is [0, 2π] → S² ⊂ R³ (unit Vector3). `fromSpherical` lets you
// write it in (theta, phi) coords; phi must stay strictly inside (0, π).
const CURVES = [
  {
    name: 'figure-eight',
    curve: fromSpherical((t) => ({
      theta: t,
      phi: PI / 3 + 0.3 * Math.sin(2 * t),
    })),
  },
  {
    name: 'tilted-circle',
    curve: fromSpherical((t) => ({
      theta: t,
      phi: PI / 4,
    })),
  },
  {
    name: 'trefoil-petals',
    curve: fromSpherical((t) => ({
      theta: t,
      phi: PI / 2 + 0.4 * Math.sin(3 * t),
    })),
  },
  {
    name: 'wobble-5',
    curve: fromSpherical((t) => ({
      theta: t,
      phi: PI / 3 + 0.15 * Math.sin(5 * t),
    })),
  },
];

// ─── END EDITABLE ───────────────────────────────────────────────────────────

const TWO_PI = 2 * PI;
const RESOLUTION = 4096;

function fromSpherical(fn) {
  return (t) => {
    const { theta, phi } = fn(t);
    const sinPhi = Math.sin(phi);
    return [Math.cos(theta) * sinPhi, Math.sin(theta) * sinPhi, Math.cos(phi)];
  };
}

function toSpherical([x, y, z]) {
  const phi = Math.acos(Math.max(-1, Math.min(1, z)));
  const theta = Math.atan2(y, x);
  return { theta, phi };
}

// Hopf toroidal coordinates on S³ ⊂ R⁴ — matches src/math/hopf/hopfUtils.ts
function toroidalCoords(a, b, c) {
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const x = Math.cos(a) * sinC;
  const y = Math.sin(a) * sinC;
  const z = Math.cos(b) * cosC;
  const w = Math.sin(b) * cosC;
  // (x, y, z, w) → (x, z, -y, w)
  return [x, z, -y, w];
}

function buildHopfTorus(curve) {
  const N = RESOLUTION;
  const dt = TWO_PI / N;
  const arc = new Float64Array(N + 1);
  const fudge = new Float64Array(N + 1);

  let arcSum = 0;
  let fudgeSum = 0;

  for (let i = 0; i < N; i++) {
    const s0 = toSpherical(curve(i * dt));
    const s1 = toSpherical(curve((i + 1) * dt));

    let dtheta = s1.theta - s0.theta;
    if (dtheta > PI) dtheta -= TWO_PI;
    if (dtheta < -PI) dtheta += TWO_PI;
    const dphi = s1.phi - s0.phi;
    const sinPhi = Math.sin(s0.phi);
    arcSum += Math.sqrt(sinPhi * sinPhi * dtheta * dtheta + dphi * dphi);

    const sinHalfPhi = Math.sin(s0.phi / 2);
    fudgeSum += sinHalfPhi * sinHalfPhi * dtheta;

    arc[i + 1] = arcSum;
    fudge[i + 1] = fudgeSum;
  }

  const totalLength = arcSum;

  function lerp(table, t) {
    const fIdx = (t / TWO_PI) * N;
    const i = Math.max(0, Math.min(N - 1, Math.floor(fIdx)));
    return table[i] + (fIdx - i) * (table[i + 1] - table[i]);
  }

  function inverseArc(L) {
    if (L <= 0) return 0;
    if (L >= totalLength) return TWO_PI;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arc[mid] <= L) lo = mid;
      else hi = mid;
    }
    const frac = (L - arc[lo]) / (arc[hi] - arc[lo]);
    return ((lo + frac) / N) * TWO_PI;
  }

  // (s, v) ∈ [0, 2π) × [0, L/2) → R⁴ on S³
  function isometricImage4D(s, v) {
    const t = inverseArc(2 * v);
    const { theta, phi } = toSpherical(curve(t));
    const f = lerp(fudge, t);
    return toroidalCoords(theta + s - f, s - f, phi / 2);
  }

  return { isometricImage4D, totalLength };
}

async function exportCurve({ name, curve }) {
  const { isometricImage4D, totalLength } = buildHopfTorus(curve);
  const height = totalLength / 2;

  // grid dims with aspect matching the fundamental domain (2π : height)
  const aspect = TWO_PI / height;
  const vSamples = Math.max(2, Math.round(Math.sqrt(TARGET_POINTS / aspect)));
  const uSamples = Math.max(2, Math.round(TARGET_POINTS / vSamples));
  const total = uSamples * vSamples;

  const outPath = path.join(OUT_DIR, `${name}.csv`);
  const stream = createWriteStream(outPath);
  stream.write('x,y,z,w\n');

  for (let i = 0; i < uSamples; i++) {
    const s = (i / uSamples) * TWO_PI;
    for (let j = 0; j < vSamples; j++) {
      const v = (j / vSamples) * height;
      const [x, y, z, w] = isometricImage4D(s, v);
      stream.write(`${x},${y},${z},${w}\n`);
    }
  }

  stream.end();
  await once(stream, 'finish');
  console.log(
    `${name.padEnd(16)} ${total} pts  (u=${uSamples} × v=${vSamples}, L=${totalLength.toFixed(4)})  →  ${outPath}`,
  );
}

async function main() {
  const root = path.resolve(fileURLToPath(import.meta.url), '../..');
  process.chdir(root);
  await mkdir(OUT_DIR, { recursive: true });

  for (const c of CURVES) {
    await exportCurve(c);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
