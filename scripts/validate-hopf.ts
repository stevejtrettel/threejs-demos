/**
 * Pins down the ℂ² ↔ ℝ⁴ convention used by hopfUtils before anything is built
 * on top of it. Run:
 *   node --import ./scripts/reg-alias.mjs <this file>
 */

import * as THREE from 'three';
import { toroidalCoords, stereoProj } from '@/math/hopf/hopfUtils';
import { HopfChart, baseAngles, basePoint } from '@/math/hopf/HopfChart';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
};

type C = [number, number]; // [re, im]
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cconj = (a: C): C => [a[0], -a[1]];
const cneg = (a: C): C => [-a[0], -a[1]];
const cabs = (a: C) => Math.hypot(a[0], a[1]);
const cdiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const expi = (t: number): C => [Math.cos(t), Math.sin(t)];

// Claim 1: toroidalCoords(a,b,c) is the ℝ⁴ image of (z1,z2) = (e^{ia} sin c, e^{ib} cos c)
// under the layout (Re z1, Re z2, -Im z1, Im z2).
const fromC2 = (z1: C, z2: C) => new THREE.Vector4(z1[0], z2[0], -z1[1], z2[1]);

{
  let worst = 0;
  for (const [a, b, c] of [[0.3, 1.1, 0.4], [2.0, -0.7, 1.2], [-1.3, 2.9, 0.05], [1.0, 1.0, Math.PI / 2]]) {
    const lhs = toroidalCoords(a, b, c);
    const z1 = cmul(expi(a), [Math.sin(c), 0]);
    const z2 = cmul(expi(b), [Math.cos(c), 0]);
    const rhs = fromC2(z1, z2);
    worst = Math.max(worst, lhs.clone().sub(rhs).length());
  }
  check('toroidalCoords == fromC2(e^{ia} sin c, e^{ib} cos c)', worst < 1e-12, `max err ${worst.toExponential(2)}`);
}

// Claim 2: the fiber used by hopfFiber(theta, phi) is the diagonal U(1) orbit
//   t ↦ e^{it} · (e^{iθ} sin(φ/2), cos(φ/2))
// so the base coordinate is w = z1/z2 = e^{iθ} tan(φ/2), constant along the fiber.
const fiberPointC2 = (theta: number, phi: number, t: number): [C, C] => [
  cmul(expi(theta + t), [Math.sin(phi / 2), 0]),
  cmul(expi(t), [Math.cos(phi / 2), 0]),
];
const baseCoord = (z1: C, z2: C): C => cdiv(z1, z2); // w ∈ ℂ ∪ {∞}

{
  const theta = 0.7, phi = 1.3;
  const w0 = baseCoord(...fiberPointC2(theta, phi, 0));
  let worst = 0;
  for (let k = 0; k < 12; k++) {
    const w = baseCoord(...fiberPointC2(theta, phi, (k / 12) * 2 * Math.PI));
    worst = Math.max(worst, cabs([w[0] - w0[0], w[1] - w0[1]]));
  }
  check('w = z1/z2 is constant along a fiber', worst < 1e-12, `max drift ${worst.toExponential(2)}`);

  const expected = cmul(expi(theta), [Math.tan(phi / 2), 0]);
  check('w = e^{iθ} tan(φ/2)', cabs([w0[0] - expected[0], w0[1] - expected[1]]) < 1e-12);
}

// Claim 3: fiberPointC2 → fromC2 → stereoProj agrees with the existing hopfFiber path.
{
  const theta = 0.7, phi = 1.3;
  let worst = 0;
  for (let k = 0; k < 12; k++) {
    const t = (k / 12) * 2 * Math.PI;
    const viaExisting = stereoProj(toroidalCoords(theta + t, t, phi / 2));
    const [z1, z2] = fiberPointC2(theta, phi, t);
    const viaC2 = stereoProj(fromC2(z1, z2));
    worst = Math.max(worst, viaExisting.clone().sub(viaC2).length());
  }
  check('ℂ² route reproduces the existing hopfFiber points', worst < 1e-12, `max err ${worst.toExponential(2)}`);
}

// Claim 4: A ∈ SU(2) acting as (z1,z2) ↦ A(z1,z2) maps fibers to fibers, and the
// induced map on the base is the Möbius map w ↦ (αw + β)/(-β̄w + ᾱ).
const su2 = (alpha: C, beta: C) => (z1: C, z2: C): [C, C] => [
  cadd(cmul(alpha, z1), cmul(beta, z2)),
  cadd(cmul(cneg(cconj(beta)), z1), cmul(cconj(alpha), z2)),
];

{
  // A random-ish SU(2) element, normalized.
  let alpha: C = [0.3, -0.5], beta: C = [0.7, 0.41];
  const n = Math.hypot(cabs(alpha), cabs(beta));
  alpha = [alpha[0] / n, alpha[1] / n];
  beta = [beta[0] / n, beta[1] / n];
  const A = su2(alpha, beta);

  const theta = 0.7, phi = 1.3;
  const wIn = baseCoord(...fiberPointC2(theta, phi, 0));

  let worst = 0;
  const wOut0 = baseCoord(...A(...fiberPointC2(theta, phi, 0)));
  for (let k = 0; k < 12; k++) {
    const w = baseCoord(...A(...fiberPointC2(theta, phi, (k / 12) * 2 * Math.PI)));
    worst = Math.max(worst, cabs([w[0] - wOut0[0], w[1] - wOut0[1]]));
  }
  check('SU(2) maps fibers to fibers', worst < 1e-12, `image w drift ${worst.toExponential(2)}`);

  const mob = cdiv(cadd(cmul(alpha, wIn), beta), cadd(cmul(cneg(cconj(beta)), wIn), cconj(alpha)));
  check('induced base map is w ↦ (αw+β)/(-β̄w+ᾱ)', cabs([mob[0] - wOut0[0], mob[1] - wOut0[1]]) < 1e-12);
}

// Claim 5: stereoProj blows up exactly at (z1,z2) = (-i, 0), i.e. the base point φ = π.
{
  const denomAt = (z1: C, z2: C) => 1 - fromC2(z1, z2).z; // stereoProj divides by this
  check('projection point is (z1,z2) = (-i, 0)', Math.abs(denomAt([0, -1], [0, 0])) < 1e-15);

  // Approaching φ = π the fiber radius diverges. The denominator is 1 + Im z1,
  // smallest where sin(θ + t) = -1; sampling the fiber on a fixed grid misses
  // that point and badly understates the blow-up, so evaluate there directly.
  const theta = 0.4;
  const worstRadius = (phi: number) =>
    stereoProj(fromC2(...fiberPointC2(theta, phi, -Math.PI / 2 - theta))).length();

  // r ≈ 4 / (π - φ): the cutoff radius the demo picks maps to a φ-margin of 4/R.
  const rates = [0.2, 0.05, 0.01, 0.002].map((eps) => worstRadius(Math.PI - eps) * eps);
  const worstRate = Math.max(...rates.map((r) => Math.abs(r - 4)));
  check('fiber radius diverges as 4/(π - φ)', worstRate < 0.05, `r·(π-φ) = ${rates.map((r) => r.toFixed(3)).join(', ')}`);
}

// --- HopfChart ---------------------------------------------------------------

{
  const chart = new HopfChart({ cutoffRadius: Infinity });

  // The untouched window must reproduce the existing hopfFiber exactly.
  {
    const theta = 0.7, phi = 1.3;
    let worst = 0;
    for (let k = 0; k < 24; k++) {
      const t = (k / 24) * 2 * Math.PI;
      const existing = stereoProj(toroidalCoords(theta + t, t, phi / 2));
      worst = Math.max(worst, chart.fiberPoint(theta, phi, t).distanceTo(existing));
    }
    check('identity window reproduces hopfFiber', worst < 1e-12, `max err ${worst.toExponential(2)}`);
  }

  // baseAngles ∘ basePoint is the identity.
  {
    let worst = 0;
    for (const [theta, phi] of [[0.4, 1.1], [-2.2, 2.6], [3.0, 0.2]]) {
      const back = baseAngles(basePoint(theta, phi));
      worst = Math.max(worst, Math.abs(back.theta - theta), Math.abs(back.phi - phi));
    }
    check('baseAngles ∘ basePoint = id', worst < 1e-12, `max err ${worst.toExponential(2)}`);
  }

  // The fiber over (θ, φ) really does sit over the base point h(θ, φ): every
  // point of it lifts back to the same base coordinate.
  {
    const theta = 0.7, phi = 1.3;
    const expected = basePoint(theta, phi);
    let worst = 0;
    for (let k = 0; k < 12; k++) {
      const t = (k / 12) * 2 * Math.PI;
      const [z1, z2] = fiberPointC2(theta, phi, t);
      const q = 1 / (Math.hypot(...z1) ** 2 + Math.hypot(...z2) ** 2);
      const h = new THREE.Vector3(
        2 * (z1[0] * z2[0] + z1[1] * z2[1]) * q,
        2 * (z1[1] * z2[0] - z1[0] * z2[1]) * q,
        (Math.hypot(...z1) ** 2 - Math.hypot(...z2) ** 2) * q,
      );
      worst = Math.max(worst, h.distanceTo(expected));
    }
    check('fiber over (θ,φ) lies over h(θ,φ)', worst < 1e-12, `max err ${worst.toExponential(2)}`);
  }
}

// rotate(axis, angle) must induce exactly that rotation of the base sphere.
{
  const axes = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 2, -3).normalize()];
  const probes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.3, -0.5, 0.81).normalize(), new THREE.Vector3(0, 0, 1)];

  let worst = 0;
  for (const axis of axes) {
    for (const angle of [0.3, 1.7, -2.4]) {
      const chart = new HopfChart();
      chart.rotate(axis, angle);
      const expected = new THREE.Matrix4().makeRotationAxis(axis, angle);
      for (const p of probes) {
        const want = p.clone().applyMatrix4(expected);
        worst = Math.max(worst, chart.mapBase(p).distanceTo(want));
      }
    }
  }
  check('rotate(axis, angle) induces that rotation of the base', worst < 1e-9, `max err ${worst.toExponential(2)}`);
}

// Successive rotations compose in the order performed.
{
  const chart = new HopfChart();
  const x = new THREE.Vector3(1, 0, 0);
  const z = new THREE.Vector3(0, 0, 1);
  chart.rotate(z, 0.6);
  chart.rotate(x, 1.1);
  const expected = new THREE.Matrix4()
    .makeRotationAxis(x, 1.1)
    .multiply(new THREE.Matrix4().makeRotationAxis(z, 0.6));
  const p = new THREE.Vector3(0.3, -0.5, 0.81).normalize();
  check('rotations compose left-to-right', chart.mapBase(p).distanceTo(p.clone().applyMatrix4(expected)) < 1e-9);
}

// mapBase and unmapBase are inverse.
{
  const chart = new HopfChart();
  chart.rotate(new THREE.Vector3(1, 2, -3).normalize(), 1.9);
  const p = new THREE.Vector3(0.3, -0.5, 0.81).normalize();
  check('unmapBase ∘ mapBase = id', chart.unmapBase(chart.mapBase(p)).distanceTo(p) < 1e-12);
}

// The singular fiber is where singularBase says it is: whole nearby, clipped at it.
{
  const chart = new HopfChart({ cutoffRadius: 14 });
  chart.rotate(new THREE.Vector3(1, 2, -3).normalize(), 1.9);

  const bad = chart.singularBase();
  const { theta, phi } = baseAngles(bad);
  check('fiber at singularBase is clipped', !chart.fiberIsWhole(theta, phi), `at ${bad.toArray().map((v) => v.toFixed(2))}`);

  // Antipodal to it is the furthest a fiber can be from the blow-up.
  const good = baseAngles(bad.clone().negate());
  check('fiber opposite singularBase is whole', chart.fiberIsWhole(good.theta, good.phi));

  // With no rotation the blow-up sits at h = (0, 0, 1), i.e. φ = π.
  const identity = new HopfChart();
  check('untouched window is singular at (0,0,1)', identity.singularBase().distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-12);
}

// A rotated window is a Möbius transformation of ℝ³, so fibers stay circles.
{
  const chart = new HopfChart({ cutoffRadius: Infinity });
  chart.rotate(new THREE.Vector3(0.3, 1, 0.2).normalize(), 1.1);

  const theta = 0.7, phi = 1.3;
  const pts = Array.from({ length: 40 }, (_, k) => chart.fiberPoint(theta, phi, (k / 40) * 2 * Math.PI));

  // Take the circumcentre of three samples and check every other sample sits at
  // that radius. The centroid would NOT do: a Möbius map does not preserve the
  // parameterization, so evenly spaced t gives unevenly spaced points and the
  // centroid drifts off the true centre.
  const [p1, p2, p3] = [pts[0], pts[13], pts[27]];
  const a = new THREE.Vector3().subVectors(p1, p3);
  const b = new THREE.Vector3().subVectors(p2, p3);
  const axb = new THREE.Vector3().crossVectors(a, b);
  const centre = new THREE.Vector3()
    .addScaledVector(b, a.lengthSq())
    .addScaledVector(a, -b.lengthSq())
    .cross(axb)
    .divideScalar(2 * axb.lengthSq())
    .add(p3);

  const normal = axb.clone().normalize();
  const planarity = Math.max(...pts.map((p) => Math.abs(p.clone().sub(centre).dot(normal))));
  const radii = pts.map((p) => p.distanceTo(centre));
  const spread = (Math.max(...radii) - Math.min(...radii)) / radii[0];
  check('rotated fibers are still circles', planarity < 1e-9 && spread < 1e-9,
    `planarity ${planarity.toExponential(2)}, relative radius spread ${spread.toExponential(2)}`);
}

console.log(failures ? `\n${failures} FAILED` : '\nall conventions confirmed');
process.exit(failures ? 1 : 0);
