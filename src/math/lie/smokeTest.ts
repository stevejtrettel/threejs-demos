/**
 * Phase-1 sanity checks.
 *
 * Covers:
 *   - SO(3): hat/vee, Rodrigues, log round-trips, group axioms, adjoint
 *   - Lie-Poisson: structure-constant cache, Jacobi identity
 *   - Rigid body: principal-axis fixed point, tumbling conservation laws,
 *     SO(3)-preservation of the rotation over 10k+ steps
 *
 * Usage:
 *   import { runLieSmokeTests } from '@/math/lie/smokeTest';
 *   const report = runLieSmokeTests();
 *   console.log(`${report.passed}/${report.passed + report.failed} passed`);
 *   console.table(report.results);
 */

import { Matrix, ComplexMatrix } from '@/math/linear-algebra';
import { SO2 } from './groups/SO2';
import { SO3, hatSO3 } from './groups/SO3';
import { SU2 } from './groups/SU2';
import { SE2 } from './groups/SE2';
import { SE3 } from './groups/SE3';
import { SL2R } from './groups/SL2R';
import { SU11 } from './groups/SU11';
import { SL2C } from './groups/SL2C';
import { padeExp } from './exp/pade';
import { polar } from './factorizations/polar';
import { iwasawaSL2R, iwasawaCoordsSL2R } from './factorizations/iwasawa';
import { classifySL2R, classifySL2C } from './factorizations/classify';
import { mobiusSL2R, mobiusSU11, mobiusSL2C } from './mobius';
import { stepBody, stepWorld } from './stepper';
import { liePoissonManifold } from './liePoisson';
import { rigidBodyStep, rigidBodyHamiltonian } from './RigidBody';
import { PoissonGradient } from '@/math/symplectic';
import { integrate, rk4 } from '@/math/ode';

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

export interface SmokeTestReport {
  passed: number;
  failed: number;
  results: Check[];
}

function check(name: string, pass: boolean, detail = ''): Check {
  return { name, pass, detail };
}

function closeScalar(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

function closeVec(a: number[], b: number[], tol: number): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > tol) return false;
  }
  return true;
}

function closeMat(A: Matrix, B: Matrix, tol: number): boolean {
  if (A.rows !== B.rows || A.cols !== B.cols) return false;
  for (let i = 0; i < A.data.length; i++) {
    if (Math.abs(A.data[i] - B.data[i]) > tol) return false;
  }
  return true;
}

function randVec(n: number, scale = 1): number[] {
  const v = new Array(n);
  for (let i = 0; i < n; i++) v[i] = (Math.random() * 2 - 1) * scale;
  return v;
}

function norm(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

// ── Checks ─────────────────────────────────────────────────────────

function so2Checks(): Check[] {
  const out: Check[] = [];
  const I = SO2.identity();

  // exp(0) = I
  out.push(check(
    'SO2.exp([0]) = I',
    closeMat(SO2.exp([0]), I, 1e-14),
  ));

  // exp(π/2) rotates (1, 0) to (0, 1)
  const Rhalf = SO2.exp([Math.PI / 2]);
  out.push(check(
    'SO2.exp([π/2]) · (1,0) = (0,1)',
    closeVec(Rhalf.mulVec([1, 0]), [0, 1], 1e-12),
  ));

  // log ∘ exp = id on (−π, π)
  let maxRound = 0;
  for (let trial = 0; trial < 50; trial++) {
    const theta = (Math.random() * 2 - 1) * (Math.PI - 0.05);
    const back = SO2.log(SO2.exp([theta]))[0];
    const err = Math.abs(back - theta);
    if (err > maxRound) maxRound = err;
  }
  out.push(check(
    'log ∘ exp = id on (−π, π)',
    maxRound < 1e-12,
    `max err = ${maxRound.toExponential(2)}`,
  ));

  // Abelian bracket and adjoint
  out.push(check(
    'SO2 bracket is zero (abelian)',
    closeVec(SO2.bracket([0.3], [-0.7]), [0], 1e-14),
  ));

  out.push(check(
    'SO2 adjoint is identity',
    closeVec(SO2.adjoint(SO2.exp([0.5]), [0.7]), [0.7], 1e-14),
  ));

  // R Rᵀ = I, det R = 1
  const Rtest = SO2.exp([0.9]);
  out.push(check(
    'R Rᵀ = I on SO(2)',
    closeMat(Rtest.multiply(Rtest.transpose()), I, 1e-14),
  ));
  out.push(check(
    'det R = 1 on SO(2)',
    closeScalar(Rtest.det(), 1, 1e-14),
  ));

  return out;
}

function so3Checks(): Check[] {
  const out: Check[] = [];
  const I = SO3.identity();

  // exp(0) = I
  out.push(check(
    'SO3.exp([0,0,0]) = I',
    closeMat(SO3.exp([0, 0, 0]), I, 1e-12),
  ));

  // exp([0, 0, π/2]) rotates (1, 0, 0) to (0, 1, 0)
  const Rz = SO3.exp([0, 0, Math.PI / 2]);
  out.push(check(
    'SO3.exp([0,0,π/2]) · (1,0,0) = (0,1,0)',
    closeVec(Rz.mulVec([1, 0, 0]), [0, 1, 0], 1e-10),
  ));

  // log ∘ exp = id for |ξ| < π − 0.1
  let maxRoundtrip = 0;
  for (let trial = 0; trial < 50; trial++) {
    const xi = randVec(3, 1);
    const mag = norm(xi);
    if (mag > Math.PI - 0.1) continue;
    const xiBack = SO3.log(SO3.exp(xi));
    const err = norm([xiBack[0] - xi[0], xiBack[1] - xi[1], xiBack[2] - xi[2]]);
    if (err > maxRoundtrip) maxRoundtrip = err;
  }
  out.push(check(
    'log ∘ exp = id on |ξ| < π − 0.1',
    maxRoundtrip < 1e-10,
    `max err = ${maxRoundtrip.toExponential(2)}`,
  ));

  // exp(ξ) · exp(−ξ) = I
  let maxInvErr = 0;
  for (let trial = 0; trial < 20; trial++) {
    const xi = randVec(3, 1);
    const prod = SO3.exp(xi).multiply(SO3.exp([-xi[0], -xi[1], -xi[2]]));
    for (let i = 0; i < 9; i++) {
      const target = (i === 0 || i === 4 || i === 8) ? 1 : 0;
      const err = Math.abs(prod.data[i] - target);
      if (err > maxInvErr) maxInvErr = err;
    }
  }
  out.push(check(
    'exp(ξ)·exp(−ξ) = I',
    maxInvErr < 1e-10,
    `max err = ${maxInvErr.toExponential(2)}`,
  ));

  // R Rᵀ = I and det R = 1 for random R = exp(ξ)
  const Rtest = SO3.exp(randVec(3, 1));
  const RRt = Rtest.multiply(Rtest.transpose());
  out.push(check(
    'R Rᵀ = I for R ∈ exp(so(3))',
    closeMat(RRt, I, 1e-10),
  ));
  out.push(check(
    'det R = 1 for R ∈ exp(so(3))',
    closeScalar(Rtest.det(), 1, 1e-10),
  ));

  // Ad_R(ξ) = R · ξ
  let maxAdErr = 0;
  for (let trial = 0; trial < 10; trial++) {
    const R = SO3.exp(randVec(3, 1));
    const xi = randVec(3, 1);
    const adXi = SO3.adjoint(R, xi);
    const Rxi = R.mulVec(xi);
    for (let i = 0; i < 3; i++) {
      const e = Math.abs(adXi[i] - Rxi[i]);
      if (e > maxAdErr) maxAdErr = e;
    }
  }
  out.push(check(
    'Ad_R(ξ) = R · ξ',
    maxAdErr < 1e-12,
    `max err = ${maxAdErr.toExponential(2)}`,
  ));

  // bracket([1,0,0], [0,1,0]) = [0,0,1]
  out.push(check(
    'bracket([1,0,0],[0,1,0]) = [0,0,1]',
    closeVec(SO3.bracket([1, 0, 0], [0, 1, 0]), [0, 0, 1], 1e-14),
  ));

  return out;
}

function liePoissonChecks(): Check[] {
  const out: Check[] = [];
  const M = liePoissonManifold(SO3);

  // Jacobi identity on the Lie algebra: [α, [β, γ]] + [β, [γ, α]] + [γ, [α, β]] = 0.
  // This is what guarantees Jacobi on the induced Lie-Poisson bracket.
  let maxJacobi = 0;
  for (let trial = 0; trial < 20; trial++) {
    const a = randVec(3, 1);
    const b = randVec(3, 1);
    const g = randVec(3, 1);
    const t1 = SO3.bracket(a, SO3.bracket(b, g));
    const t2 = SO3.bracket(b, SO3.bracket(g, a));
    const t3 = SO3.bracket(g, SO3.bracket(a, b));
    const s = [t1[0] + t2[0] + t3[0], t1[1] + t2[1] + t3[1], t1[2] + t2[2] + t3[2]];
    const err = norm(s);
    if (err > maxJacobi) maxJacobi = err;
  }
  out.push(check(
    'Jacobi identity on SO(3) bracket',
    maxJacobi < 1e-12,
    `max err = ${maxJacobi.toExponential(2)}`,
  ));

  // Cached Poisson tensor reproduces the cross-product action:
  //   π^{ij}(μ) = −ε_{ijk} μ_k  ⇒  (π(μ) · v)_i = μ × v.
  // This is the Lie-Poisson convention that reproduces Euler's equation
  // dL/dt = L × Ω for H = ½|L|²/I (checked independently below).
  let maxPiErr = 0;
  for (let trial = 0; trial < 20; trial++) {
    const mu = randVec(3, 1);
    const v = randVec(3, 1);
    const pi = M.computePoissonTensor(mu);
    const piV = [
      pi[0] * v[0] + pi[1] * v[1] + pi[2] * v[2],
      pi[3] * v[0] + pi[4] * v[1] + pi[5] * v[2],
      pi[6] * v[0] + pi[7] * v[1] + pi[8] * v[2],
    ];
    const cross = [
      mu[1] * v[2] - mu[2] * v[1],
      mu[2] * v[0] - mu[0] * v[2],
      mu[0] * v[1] - mu[1] * v[0],
    ];
    for (let i = 0; i < 3; i++) {
      const e = Math.abs(piV[i] - cross[i]);
      if (e > maxPiErr) maxPiErr = e;
    }
  }
  out.push(check(
    'Lie-Poisson tensor: π(μ)·v = μ × v',
    maxPiErr < 1e-12,
    `max err = ${maxPiErr.toExponential(2)}`,
  ));

  // π antisymmetric
  const piTest = M.computePoissonTensor([0.3, -0.7, 1.2]);
  let maxAsym = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const e = Math.abs(piTest[i * 3 + j] + piTest[j * 3 + i]);
      if (e > maxAsym) maxAsym = e;
    }
  }
  out.push(check(
    'Poisson tensor is antisymmetric',
    maxAsym < 1e-14,
  ));

  // PoissonGradient reproduces L × Ω for rigid-body H
  const H = rigidBodyHamiltonian([1, 2, 3]);
  const X = new PoissonGradient(M, H);
  const Ltest = [0.4, -0.6, 0.8];
  const xh = X.evaluate(Ltest);
  const Omega = [Ltest[0] / 1, Ltest[1] / 2, Ltest[2] / 3];
  const LxOmega = [
    Ltest[1] * Omega[2] - Ltest[2] * Omega[1],
    Ltest[2] * Omega[0] - Ltest[0] * Omega[2],
    Ltest[0] * Omega[1] - Ltest[1] * Omega[0],
  ];
  out.push(check(
    'PoissonGradient(H_rigid) = L × Ω',
    closeVec(Array.from(xh), LxOmega, 1e-12),
  ));

  return out;
}

function rigidBodyChecks(): Check[] {
  const out: Check[] = [];
  const inertia: [number, number, number] = [1, 2, 3];

  // Principal-axis stability: L = (1, 0, 0) is a fixed point.
  {
    let state = { R: SO3.identity(), L: [1, 0, 0] };
    for (let i = 0; i < 5000; i++) {
      state = rigidBodyStep(state, 0.01, { inertia });
    }
    const stable =
      closeScalar(state.L[0], 1, 1e-12) &&
      closeScalar(state.L[1], 0, 1e-12) &&
      closeScalar(state.L[2], 0, 1e-12);
    out.push(check(
      'principal-axis L = (1,0,0) stays fixed over 5k steps',
      stable,
      `L = [${state.L.map((x) => x.toExponential(2)).join(', ')}]`,
    ));
  }

  // Tumbling conservation: |L|² and H conserved, R stays in SO(3).
  {
    const H = rigidBodyHamiltonian(inertia);
    let state = { R: SO3.identity(), L: [0.01, 1.0, 0] };
    const L0sq = state.L[0] * state.L[0] + state.L[1] * state.L[1] + state.L[2] * state.L[2];
    const H0 = H.evaluate(state.L);

    const STEPS = 10000;
    const dt = 0.001;

    let maxLSqDrift = 0;
    let maxHDrift = 0;
    let maxOrthoErr = 0;
    let maxDetErr = 0;

    for (let i = 0; i < STEPS; i++) {
      state = rigidBodyStep(state, dt, { inertia });

      const Lsq = state.L[0] * state.L[0] + state.L[1] * state.L[1] + state.L[2] * state.L[2];
      const Hnow = H.evaluate(state.L);
      const RRt = state.R.multiply(state.R.transpose());
      const detR = state.R.det();

      maxLSqDrift = Math.max(maxLSqDrift, Math.abs(Lsq - L0sq));
      maxHDrift = Math.max(maxHDrift, Math.abs(Hnow - H0));
      for (let k = 0; k < 9; k++) {
        const t = (k === 0 || k === 4 || k === 8) ? 1 : 0;
        const e = Math.abs(RRt.data[k] - t);
        if (e > maxOrthoErr) maxOrthoErr = e;
      }
      maxDetErr = Math.max(maxDetErr, Math.abs(detR - 1));
    }

    out.push(check(
      '|L|² conserved over 10k tumbling steps',
      maxLSqDrift < 1e-4,
      `max drift = ${maxLSqDrift.toExponential(2)}`,
    ));
    out.push(check(
      'H conserved over 10k tumbling steps',
      maxHDrift < 1e-4,
      `max drift = ${maxHDrift.toExponential(2)}`,
    ));
    out.push(check(
      'R Rᵀ = I over 10k tumbling steps',
      maxOrthoErr < 1e-10,
      `max off-orthogonality = ${maxOrthoErr.toExponential(2)}`,
    ));
    out.push(check(
      'det R = 1 over 10k tumbling steps',
      maxDetErr < 1e-10,
      `max det err = ${maxDetErr.toExponential(2)}`,
    ));
  }

  // PoissonGradient trajectory agrees with rigidBodyStep L equation to ~rk4 order.
  {
    const H = rigidBodyHamiltonian(inertia);
    const M = liePoissonManifold(SO3);
    const X = new PoissonGradient(M, H);

    const L0 = [0.3, -0.6, 0.9];
    const deriv = (s: number[]) => Array.from(X.evaluate(s));
    const traj = integrate({ deriv, initial: L0, dt: 0.01, steps: 500, stepper: rk4 });
    const Lend = traj.states[traj.states.length - 1];

    // Reference: rigidBodyStep with the same dt.
    let refState = { R: SO3.identity(), L: L0.slice() };
    for (let i = 0; i < 500; i++) {
      refState = rigidBodyStep(refState, 0.01, { inertia });
    }
    const diff = norm([
      Lend[0] - refState.L[0],
      Lend[1] - refState.L[1],
      Lend[2] - refState.L[2],
    ]);
    out.push(check(
      'PoissonGradient trajectory ≈ rigidBodyStep L',
      diff < 1e-8,
      `diff at t=5 = ${diff.toExponential(2)}`,
    ));
  }

  return out;
}

function padeChecks(): Check[] {
  const out: Check[] = [];

  // Padé exp of a skew-symmetric 3×3 should match Rodrigues.
  let maxPade = 0;
  for (let trial = 0; trial < 20; trial++) {
    const xi = randVec(3, 1.8);  // within [−π, π] or so
    const rodrigues = SO3.exp(xi);
    const pade = padeExp(hatSO3(xi));
    for (let i = 0; i < 9; i++) {
      const e = Math.abs(rodrigues.data[i] - pade.data[i]);
      if (e > maxPade) maxPade = e;
    }
  }
  out.push(check(
    'padeExp(hatSO3(ξ)) matches Rodrigues',
    maxPade < 1e-8,
    `max err = ${maxPade.toExponential(2)}`,
  ));

  // Diagonal: exp(diag(a, b, c)) = diag(e^a, e^b, e^c)
  const D = Matrix.fromRows([[0.5, 0, 0], [0, -0.3, 0], [0, 0, 1.2]]);
  const eD = padeExp(D);
  const ok =
    closeScalar(eD.data[0], Math.exp(0.5),  1e-10) &&
    closeScalar(eD.data[4], Math.exp(-0.3), 1e-10) &&
    closeScalar(eD.data[8], Math.exp(1.2),  1e-10);
  out.push(check('padeExp(diag(a,b,c)) = diag(eᵃ, eᵇ, eᶜ)', ok));

  return out;
}

function su2Checks(): Check[] {
  const out: Check[] = [];
  const I = SU2.identity();

  // Identity
  out.push(check(
    'SU2.identity = (1, 0, 0, 0)',
    I.data[0] === 1 && I.data[1] === 0 && I.data[2] === 0 && I.data[3] === 0,
  ));

  // exp(0) = identity
  const e0 = SU2.exp([0, 0, 0]);
  out.push(check(
    'SU2.exp([0,0,0]) = identity',
    closeVec(Array.from(e0.data), [1, 0, 0, 0], 1e-14),
  ));

  // Double-cover boundary: |ξ| = 2π should give −identity.
  const eFull = SU2.exp([0, 0, 2 * Math.PI]);
  out.push(check(
    'SU2.exp([0,0,2π]) = −identity  (double-cover signature)',
    closeVec(Array.from(eFull.data), [-1, 0, 0, 0], 1e-10),
  ));

  // And |ξ| = 4π returns to identity.
  const eDouble = SU2.exp([0, 0, 4 * Math.PI]);
  out.push(check(
    'SU2.exp([0,0,4π]) = +identity',
    closeVec(Array.from(eDouble.data), [1, 0, 0, 0], 1e-10),
  ));

  // Unit norm everywhere: every q = exp(ξ) lies on S³.
  let maxUnitErr = 0;
  for (let trial = 0; trial < 30; trial++) {
    const q = SU2.exp(randVec(3, 2));
    const n = q.data[0] ** 2 + q.data[1] ** 2 + q.data[2] ** 2 + q.data[3] ** 2;
    const e = Math.abs(n - 1);
    if (e > maxUnitErr) maxUnitErr = e;
  }
  out.push(check(
    '|q|² = 1 for all q = SU2.exp(ξ)',
    maxUnitErr < 1e-12,
    `max err = ${maxUnitErr.toExponential(2)}`,
  ));

  // log ∘ exp = id on |ξ| < π − 0.1. We canonicalize `log` to the
  // hemisphere `w ≥ 0`, which pins the principal branch to `|ξ| ≤ π`;
  // beyond that the log returns the short-way alternative through the
  // antipodal representative.
  let maxLogExp = 0;
  for (let trial = 0; trial < 50; trial++) {
    const xi = randVec(3, 1);
    const mag = Math.hypot(xi[0], xi[1], xi[2]);
    if (mag > Math.PI - 0.1) continue;
    const back = SU2.log(SU2.exp(xi));
    const err = Math.hypot(back[0] - xi[0], back[1] - xi[1], back[2] - xi[2]);
    if (err > maxLogExp) maxLogExp = err;
  }
  out.push(check(
    'logSU2 ∘ expSU2 = id on |ξ| < π − 0.1 (principal branch)',
    maxLogExp < 1e-10,
    `max err = ${maxLogExp.toExponential(2)}`,
  ));

  // q · q⁻¹ = identity.
  let maxInvErr = 0;
  for (let trial = 0; trial < 20; trial++) {
    const q = SU2.exp(randVec(3, 1.5));
    const prod = SU2.multiply(q, SU2.inverse(q));
    const e = Math.hypot(prod.data[0] - 1, prod.data[1], prod.data[2], prod.data[3]);
    if (e > maxInvErr) maxInvErr = e;
  }
  out.push(check(
    'q · q⁻¹ = identity on SU(2)',
    maxInvErr < 1e-12,
    `max err = ${maxInvErr.toExponential(2)}`,
  ));

  // Double cover: q and −q map to the same SO(3) rotation.
  //   Ad_q(v) = q · (0, v) · q* should equal SO3.exp(ξ) · v.
  let maxDC = 0;
  for (let trial = 0; trial < 10; trial++) {
    const xi = randVec(3, 1.5);
    const q  = SU2.exp(xi);
    const qN = new Matrix(2, 2);
    qN.data[0] = -q.data[0]; qN.data[1] = -q.data[1];
    qN.data[2] = -q.data[2]; qN.data[3] = -q.data[3];
    const R = SO3.exp(xi);

    const v = randVec(3, 1);
    // Rotate v via q-conjugation: wrap v as pure-imaginary quaternion.
    const vQuat = new Matrix(2, 2);
    vQuat.data[0] = 0; vQuat.data[1] = v[0]; vQuat.data[2] = v[1]; vQuat.data[3] = v[2];
    const viaQ  = SU2.multiply(SU2.multiply(q,  vQuat), SU2.inverse(q));
    const viaQN = SU2.multiply(SU2.multiply(qN, vQuat), SU2.inverse(qN));
    const viaR  = R.mulVec(v);

    for (let i = 0; i < 3; i++) {
      const eQ  = Math.abs(viaQ.data[i + 1]  - viaR[i]);
      const eQN = Math.abs(viaQN.data[i + 1] - viaR[i]);
      if (eQ  > maxDC) maxDC = eQ;
      if (eQN > maxDC) maxDC = eQN;
    }
  }
  out.push(check(
    'Double cover: Ad_q(v) = Ad_{−q}(v) = SO3.exp(ξ) · v',
    maxDC < 1e-10,
    `max err = ${maxDC.toExponential(2)}`,
  ));

  // Bracket on 𝔰𝔲(2) matches cross product (via default commutator).
  const br = SU2.bracket([1, 0, 0], [0, 1, 0]);
  out.push(check(
    'SU2.bracket([1,0,0],[0,1,0]) = [0,0,1]  (commutator via this.multiply override)',
    closeVec(br, [0, 0, 1], 1e-12),
  ));

  // Adjoint on 𝔰𝔲(2) also matches SO(3) rotation.
  let maxAdj = 0;
  for (let trial = 0; trial < 10; trial++) {
    const xi = randVec(3, 1.2);
    const q = SU2.exp(xi);
    const R = SO3.exp(xi);
    const eta = randVec(3, 1);
    const adSU2 = SU2.adjoint(q, eta);
    const adSO3 = R.mulVec(eta);
    for (let i = 0; i < 3; i++) {
      const e = Math.abs(adSU2[i] - adSO3[i]);
      if (e > maxAdj) maxAdj = e;
    }
  }
  out.push(check(
    'SU2.adjoint(q, η) = SO3.adjoint(R, η) for matching q, R',
    maxAdj < 1e-10,
    `max err = ${maxAdj.toExponential(2)}`,
  ));

  return out;
}

function se3Checks(): Check[] {
  const out: Check[] = [];
  const I = SE3.identity();

  // exp(0) = I
  out.push(check('SE3.exp(0) = I', closeMat(SE3.exp([0, 0, 0, 0, 0, 0]), I, 1e-14)));

  // Pure translation: exp([0, 0, 0, vx, vy, vz]) = [[I, v], [0, 1]]
  const pureT = SE3.exp([0, 0, 0, 1.2, -0.5, 0.8]);
  let okPure = true;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const target = (i === j) ? 1 : 0;
      if (Math.abs(pureT.data[i * 4 + j] - target) > 1e-12) okPure = false;
    }
  }
  okPure = okPure &&
    closeScalar(pureT.data[3], 1.2, 1e-12) &&
    closeScalar(pureT.data[7], -0.5, 1e-12) &&
    closeScalar(pureT.data[11], 0.8, 1e-12) &&
    closeScalar(pureT.data[15], 1, 1e-12);
  out.push(check('SE3.exp(pure translation) = [[I, v], [0, 1]]', okPure));

  // Bottom row is always [0, 0, 0, 1] on the group.
  let maxBot = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SE3.exp(randVec(6, 1));
    for (let j = 0; j < 4; j++) {
      const target = j === 3 ? 1 : 0;
      const e = Math.abs(g.data[12 + j] - target);
      if (e > maxBot) maxBot = e;
    }
  }
  out.push(check('SE3 group element has bottom row [0,0,0,1]', maxBot < 1e-12));

  // log ∘ exp = id for small |ω|.
  let maxLogExp = 0;
  for (let trial = 0; trial < 30; trial++) {
    const omega = randVec(3, 1.5);
    const v = randVec(3, 1.5);
    const xi = [...omega, ...v];
    const back = SE3.log(SE3.exp(xi));
    let err = 0;
    for (let i = 0; i < 6; i++) err = Math.max(err, Math.abs(back[i] - xi[i]));
    if (err > maxLogExp) maxLogExp = err;
  }
  out.push(check(
    'logSE3 ∘ expSE3 = id  on |ω| ≤ 1.5',
    maxLogExp < 1e-10,
    `max err = ${maxLogExp.toExponential(2)}`,
  ));

  // g · g⁻¹ = I via the closed-form inverse.
  let maxInvErr = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SE3.exp(randVec(6, 1));
    const gi = SE3.inverse(g);
    const prod = g.multiply(gi);
    for (let i = 0; i < 16; i++) {
      const target = (i === 0 || i === 5 || i === 10 || i === 15) ? 1 : 0;
      const e = Math.abs(prod.data[i] - target);
      if (e > maxInvErr) maxInvErr = e;
    }
  }
  out.push(check(
    'g · g⁻¹ = I on SE(3)',
    maxInvErr < 1e-12,
    `max err = ${maxInvErr.toExponential(2)}`,
  ));

  // Bracket on 𝔰𝔢(3) should match semidirect formula:
  //   [(ω₁, v₁), (ω₂, v₂)] = (ω₁ × ω₂,  ω₁ × v₂ − ω₂ × v₁)
  let maxBr = 0;
  for (let trial = 0; trial < 5; trial++) {
    const a = randVec(3, 1);
    const va = randVec(3, 1);
    const b = randVec(3, 1);
    const vb = randVec(3, 1);
    const br = SE3.bracket([...a, ...va], [...b, ...vb]);
    const cross = (u: number[], v: number[]) => [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const expectedOmega = cross(a, b);
    const cAB = cross(a, vb);
    const cBA = cross(b, va);
    const expectedV = [cAB[0] - cBA[0], cAB[1] - cBA[1], cAB[2] - cBA[2]];
    const expected = [...expectedOmega, ...expectedV];
    for (let i = 0; i < 6; i++) {
      const e = Math.abs(br[i] - expected[i]);
      if (e > maxBr) maxBr = e;
    }
  }
  out.push(check(
    'SE3 bracket matches semidirect formula',
    maxBr < 1e-12,
    `max err = ${maxBr.toExponential(2)}`,
  ));

  return out;
}

function polarChecks(): Check[] {
  const out: Check[] = [];

  // For random invertible A, reconstruct and verify Q·P = A, QᵀQ = I, P = Pᵀ.
  let maxReconErr = 0;
  let maxOrthoErr = 0;
  let maxSymErr = 0;
  for (let trial = 0; trial < 10; trial++) {
    // Build a well-conditioned 3×3 by exponentiating a random symmetric matrix
    // plus a rotation. Ensures invertibility without tuning.
    const S = Matrix.fromRows([
      [1 + Math.random() * 0.5, 0.1 * (Math.random() - 0.5), 0.1 * (Math.random() - 0.5)],
      [0.1 * (Math.random() - 0.5), 1 + Math.random() * 0.5, 0.1 * (Math.random() - 0.5)],
      [0.1 * (Math.random() - 0.5), 0.1 * (Math.random() - 0.5), 1 + Math.random() * 0.5],
    ]);
    const R = SO3.exp(randVec(3, 0.8));
    const A = R.multiply(S);

    const { Q, P } = polar(A);

    // Reconstruction
    const QP = Q.multiply(P);
    for (let i = 0; i < 9; i++) {
      const e = Math.abs(QP.data[i] - A.data[i]);
      if (e > maxReconErr) maxReconErr = e;
    }

    // Orthogonality
    const QtQ = Q.transpose().multiply(Q);
    for (let i = 0; i < 9; i++) {
      const target = (i === 0 || i === 4 || i === 8) ? 1 : 0;
      const e = Math.abs(QtQ.data[i] - target);
      if (e > maxOrthoErr) maxOrthoErr = e;
    }

    // Symmetry of P
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const e = Math.abs(P.data[i * 3 + j] - P.data[j * 3 + i]);
        if (e > maxSymErr) maxSymErr = e;
      }
    }
  }
  out.push(check('polar: Q·P reconstructs A',      maxReconErr < 1e-10, `max err = ${maxReconErr.toExponential(2)}`));
  // Cyclic-Jacobi eigensym converges slowly when AᵀA has clustered
  // eigenvalues (as here with near-identity matrices); orthogonality of
  // Q inherits that precision loss. 1e-7 is the practical bound.
  out.push(check('polar: Q is orthogonal (QᵀQ=I)', maxOrthoErr < 1e-7,  `max err = ${maxOrthoErr.toExponential(2)}`));
  out.push(check('polar: P is symmetric',          maxSymErr   < 1e-12, `max err = ${maxSymErr.toExponential(2)}`));

  return out;
}

function se2Checks(): Check[] {
  const out: Check[] = [];
  const I = SE2.identity();

  // exp(0) = I
  out.push(check('SE2.exp(0) = I', closeMat(SE2.exp([0, 0, 0]), I, 1e-14)));

  // Pure translation: exp([0, v_x, v_y]) = [[I, v], [0, 1]]
  const pureT = SE2.exp([0, 1.5, -0.7]);
  const okPure =
    closeScalar(pureT.data[0], 1, 1e-12) && closeScalar(pureT.data[1], 0, 1e-12) &&
    closeScalar(pureT.data[3], 0, 1e-12) && closeScalar(pureT.data[4], 1, 1e-12) &&
    closeScalar(pureT.data[2], 1.5, 1e-12) && closeScalar(pureT.data[5], -0.7, 1e-12) &&
    closeScalar(pureT.data[8], 1, 1e-12);
  out.push(check('SE2.exp(pure translation) = [[I, v], [0, 1]]', okPure));

  // Pure rotation by π/2: exp([π/2, 0, 0]) has R[0][0] = 0, R[1][0] = 1, t = 0.
  const pureR = SE2.exp([Math.PI / 2, 0, 0]);
  const okRot =
    closeScalar(pureR.data[0], 0, 1e-12) &&
    closeScalar(pureR.data[3], 1, 1e-12) &&
    closeScalar(pureR.data[2], 0, 1e-12) &&
    closeScalar(pureR.data[5], 0, 1e-12);
  out.push(check('SE2.exp([π/2, 0, 0]) is pure rotation by π/2', okRot));

  // Bottom row is always [0, 0, 1] on the group.
  let maxBot = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SE2.exp(randVec(3, 1));
    for (let j = 0; j < 3; j++) {
      const target = j === 2 ? 1 : 0;
      const e = Math.abs(g.data[6 + j] - target);
      if (e > maxBot) maxBot = e;
    }
  }
  out.push(check('SE2 group element has bottom row [0,0,1]', maxBot < 1e-12));

  // log ∘ exp = id on small |ω|.
  let maxLogExp = 0;
  for (let trial = 0; trial < 30; trial++) {
    const w = (Math.random() * 2 - 1) * 2.5;
    const vx = (Math.random() * 2 - 1) * 1.5;
    const vy = (Math.random() * 2 - 1) * 1.5;
    const xi = [w, vx, vy];
    const back = SE2.log(SE2.exp(xi));
    let err = 0;
    for (let i = 0; i < 3; i++) err = Math.max(err, Math.abs(back[i] - xi[i]));
    if (err > maxLogExp) maxLogExp = err;
  }
  out.push(check(
    'logSE2 ∘ expSE2 = id',
    maxLogExp < 1e-10,
    `max err = ${maxLogExp.toExponential(2)}`,
  ));

  // g · g⁻¹ = I via the closed-form inverse.
  let maxInvErr = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SE2.exp(randVec(3, 1));
    const prod = g.multiply(SE2.inverse(g));
    for (let i = 0; i < 9; i++) {
      const target = (i === 0 || i === 4 || i === 8) ? 1 : 0;
      const e = Math.abs(prod.data[i] - target);
      if (e > maxInvErr) maxInvErr = e;
    }
  }
  out.push(check('g · g⁻¹ = I on SE(2)', maxInvErr < 1e-12, `max err = ${maxInvErr.toExponential(2)}`));

  return out;
}

function stepperChecks(): Check[] {
  const out: Check[] = [];

  // Body and world steppers related by adjoint: stepWorld(R, Ad_R(ξ)) = stepBody(R, ξ).
  let maxAdjStep = 0;
  for (let trial = 0; trial < 10; trial++) {
    const xi = randVec(3, 0.8);
    const R = SO3.exp(randVec(3, 1));
    const xiWorld = SO3.adjoint(R, xi);   // Ad_R(ξ)
    const byBody  = stepBody(SO3, R, xi, 0.1);
    const byWorld = stepWorld(SO3, R, xiWorld, 0.1);
    for (let i = 0; i < 9; i++) {
      const e = Math.abs(byBody.data[i] - byWorld.data[i]);
      if (e > maxAdjStep) maxAdjStep = e;
    }
  }
  out.push(check(
    'stepBody(R, ξ) = stepWorld(R, Ad_R(ξ)) on SO(3)',
    maxAdjStep < 1e-12,
    `max err = ${maxAdjStep.toExponential(2)}`,
  ));

  // stepBody preserves SO(3) — R stays orthogonal after many steps.
  let R = SO3.identity();
  for (let i = 0; i < 2000; i++) {
    R = stepBody(SO3, R, [0.3, -0.2, 0.7], 0.01);
  }
  const RRt = R.multiply(R.transpose());
  let maxOrth = 0;
  for (let i = 0; i < 9; i++) {
    const target = (i === 0 || i === 4 || i === 8) ? 1 : 0;
    maxOrth = Math.max(maxOrth, Math.abs(RRt.data[i] - target));
  }
  out.push(check(
    'stepBody preserves SO(3) after 2000 steps',
    maxOrth < 1e-12,
    `max off-orthogonality = ${maxOrth.toExponential(2)}`,
  ));

  return out;
}

function sl2rChecks(): Check[] {
  const out: Check[] = [];
  const I = SL2R.identity();

  out.push(check('SL2R.identity is the 2×2 identity',
    closeMat(I, Matrix.fromRows([[1, 0], [0, 1]]), 1e-14)));

  out.push(check('SL2R.exp(0) = I', closeMat(SL2R.exp([0, 0, 0]), I, 1e-14)));

  // Hyperbolic generator H gives a diagonal scaling.
  // exp(t·H) = [[e^t, 0], [0, e^{-t}]]
  const expH = SL2R.exp([1, 0, 0]);
  out.push(check('SL2R.exp([1,0,0]) = diag(e, 1/e)',
    closeScalar(expH.data[0], Math.E, 1e-12) &&
    closeScalar(expH.data[3], 1 / Math.E, 1e-12) &&
    closeScalar(expH.data[1], 0, 1e-12) &&
    closeScalar(expH.data[2], 0, 1e-12)));

  // Elliptic generator (E - F) gives a rotation: hat([0, t, -t]) = [[0, t], [-t, 0]]
  // = -t·J where J = [[0,-1],[1,0]]. So exp(this) is rotation by ... let's check.
  // q = a² + bc = 0 + 1·(-1) = -1, so theta = 1, exp = cos(1) I + sin(1)/1 · X.
  const ER = SL2R.exp([0, 1, -1]);
  out.push(check('SL2R.exp([0,1,-1]) is a rotation (det = 1, |tr| = 2cos 1)',
    closeScalar(ER.data[0] * ER.data[3] - ER.data[1] * ER.data[2], 1, 1e-12) &&
    closeScalar(ER.data[0] + ER.data[3], 2 * Math.cos(1), 1e-12)));

  // Round-trip log ∘ exp on hyperbolic, elliptic, and parabolic-near regimes.
  let maxRT = 0;
  const samples = [
    [0.7, 0, 0],     // pure H
    [0, 0.5, 0.5],   // q = 0.25 hyperbolic
    [0, 0.3, -0.3],  // q = -0.09 elliptic, |xi| small
    [0.2, 0.1, -0.05], // mixed q
    [0, 0.4, 0],     // q = 0 parabolic (E only)
    [0, 0, 0.3],     // q = 0 parabolic (F only)
  ];
  for (const xi of samples) {
    const back = SL2R.log(SL2R.exp(xi));
    let err = 0;
    for (let i = 0; i < 3; i++) err = Math.max(err, Math.abs(back[i] - xi[i]));
    if (err > maxRT) maxRT = err;
  }
  out.push(check('logSL2R ∘ expSL2R = id  (across all three regimes)',
    maxRT < 1e-10, `max err = ${maxRT.toExponential(2)}`));

  // det(g) = 1 for all g = exp(xi).
  let maxDet = 0;
  for (let trial = 0; trial < 20; trial++) {
    const xi = randVec(3, 0.8);
    const g = SL2R.exp(xi);
    const det = g.data[0] * g.data[3] - g.data[1] * g.data[2];
    if (Math.abs(det - 1) > maxDet) maxDet = Math.abs(det - 1);
  }
  out.push(check('det(exp(ξ)) = 1 on SL(2,ℝ)',
    maxDet < 1e-12, `max det err = ${maxDet.toExponential(2)}`));

  // g · g⁻¹ = I via closed-form inverse.
  let maxInv = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SL2R.exp(randVec(3, 0.6));
    const prod = g.multiply(SL2R.inverse(g));
    for (let i = 0; i < 4; i++) {
      const target = (i === 0 || i === 3) ? 1 : 0;
      maxInv = Math.max(maxInv, Math.abs(prod.data[i] - target));
    }
  }
  out.push(check('g · g⁻¹ = I on SL(2,ℝ)',
    maxInv < 1e-12, `max err = ${maxInv.toExponential(2)}`));

  // Bracket via base class commutator: [H, E] = 2E.
  const br = SL2R.bracket([1, 0, 0], [0, 1, 0]);
  out.push(check('SL2R bracket [H, E] = 2E',
    closeVec(br, [0, 2, 0], 1e-12)));

  return out;
}

function iwasawaChecks(): Check[] {
  const out: Check[] = [];

  // Reconstruction: g = N · A · K.
  let maxRecon = 0;
  for (let trial = 0; trial < 20; trial++) {
    const g = SL2R.exp(randVec(3, 0.7));
    const { N, A, K } = iwasawaSL2R(g);
    const reconstructed = N.multiply(A).multiply(K);
    for (let i = 0; i < 4; i++) {
      maxRecon = Math.max(maxRecon, Math.abs(reconstructed.data[i] - g.data[i]));
    }
  }
  out.push(check('iwasawa: g = N · A · K reconstructs',
    maxRecon < 1e-12, `max err = ${maxRecon.toExponential(2)}`));

  // K is a rotation: K · Kᵀ = I.
  let maxOrth = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SL2R.exp(randVec(3, 0.7));
    const { K } = iwasawaSL2R(g);
    const KKt = K.multiply(K.transpose());
    for (let i = 0; i < 4; i++) {
      const target = (i === 0 || i === 3) ? 1 : 0;
      maxOrth = Math.max(maxOrth, Math.abs(KKt.data[i] - target));
    }
  }
  out.push(check('iwasawa: K ∈ SO(2)',
    maxOrth < 1e-12, `max err = ${maxOrth.toExponential(2)}`));

  // ℍ² coords: g · i = (x, y) from iwasawaCoordsSL2R.
  let maxH2 = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SL2R.exp(randVec(3, 0.5));
    const { x, y } = iwasawaCoordsSL2R(g);
    const [zx, zy] = mobiusSL2R(g, [0, 1]);   // g · i
    maxH2 = Math.max(maxH2, Math.abs(x - zx), Math.abs(y - zy));
  }
  out.push(check('iwasawa: (x, y) = g · i  via mobius',
    maxH2 < 1e-12, `max err = ${maxH2.toExponential(2)}`));

  return out;
}

function classifyChecks(): Check[] {
  const out: Check[] = [];

  // Construct one element of each class explicitly.
  const ellipticG  = SL2R.exp([0, 1, -1]);   // q = -1, exp gives rotation-like
  const parabolic  = Matrix.fromRows([[1, 1], [0, 1]]);   // tr = 2
  const hyperbolic = SL2R.exp([1, 0, 0]);    // tr = e + 1/e > 2

  out.push(check('classify: SL2R.exp([0,1,-1]) is elliptic',
    classifySL2R(ellipticG) === 'elliptic'));
  out.push(check('classify: [[1,1],[0,1]] is parabolic',
    classifySL2R(parabolic) === 'parabolic'));
  out.push(check('classify: SL2R.exp([1,0,0]) is hyperbolic',
    classifySL2R(hyperbolic) === 'hyperbolic'));

  return out;
}

function mobiusChecks(): Check[] {
  const out: Check[] = [];

  // K = SO(2) stabilizes i.
  let maxStab = 0;
  for (let theta of [0.3, 0.7, 1.5, -0.4]) {
    const k = SL2R.exp([0, theta, -theta]);   // approximate rotation
    // Better: use the actual rotation via SL2R.exp on the elliptic generator
    // J = E - F; exp(t · J) = cos(t) I + sin(t) J = standard 2D rotation.
    const z = mobiusSL2R(k, [0, 1]);
    // For elliptic g, the fixed point isn't necessarily i unless g is
    // exactly K. But g = exp(t(E−F)) IS in K (since q = -t² < 0 is the
    // elliptic regime corresponding to rotation).
    maxStab = Math.max(maxStab, Math.abs(z[0] - 0), Math.abs(z[1] - 1));
  }
  out.push(check('mobius: K ⊂ SO(2) stabilizes i',
    maxStab < 1e-12, `max err = ${maxStab.toExponential(2)}`));

  // Cocycle: (gh) · z = g · (h · z).
  let maxCoc = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SL2R.exp(randVec(3, 0.5));
    const h = SL2R.exp(randVec(3, 0.5));
    const z: [number, number] = [Math.random() - 0.5, 0.5 + Math.random()];
    const gh = g.multiply(h);
    const lhs = mobiusSL2R(gh, z);
    const rhs = mobiusSL2R(g, mobiusSL2R(h, z));
    maxCoc = Math.max(maxCoc, Math.abs(lhs[0] - rhs[0]), Math.abs(lhs[1] - rhs[1]));
  }
  out.push(check('mobius: cocycle (gh)·z = g·(h·z)',
    maxCoc < 1e-10, `max err = ${maxCoc.toExponential(2)}`));

  // ℍ² preservation: g · z stays in upper half plane.
  let allUpper = true;
  for (let trial = 0; trial < 50; trial++) {
    const g = SL2R.exp(randVec(3, 0.6));
    const z: [number, number] = [Math.random() - 0.5, 0.1 + Math.random()];
    const w = mobiusSL2R(g, z);
    if (w[1] <= 0) allUpper = false;
  }
  out.push(check('mobius: SL(2,ℝ) preserves ℍ²', allUpper));

  return out;
}

function complexMatrixChecks(): Check[] {
  const out: Check[] = [];

  // Identity is the complex 2×2 identity.
  const I = ComplexMatrix.identity(2);
  out.push(check(
    'ComplexMatrix.identity(2) has 1 + 0i on diagonal',
    I.get(0, 0)[0] === 1 && I.get(0, 0)[1] === 0 &&
    I.get(1, 1)[0] === 1 && I.get(1, 1)[1] === 0 &&
    I.get(0, 1)[0] === 0 && I.get(0, 1)[1] === 0 &&
    I.get(1, 0)[0] === 0 && I.get(1, 0)[1] === 0,
  ));

  // (a+bi)(c+di) = (ac−bd) + (ad+bc)i  — 1×1 multiplication
  const A = ComplexMatrix.fromEntries([[[2, 3]]]);
  const B = ComplexMatrix.fromEntries([[[1, -1]]]);
  const AB = A.multiply(B);
  out.push(check(
    'ComplexMatrix scalar mult: (2+3i)(1−i) = 5+i',
    AB.get(0, 0)[0] === 5 && AB.get(0, 0)[1] === 1,
  ));

  // Inversion: g · g⁻¹ = I for a random invertible 2×2.
  const G = ComplexMatrix.fromEntries([
    [[2, 1], [-1, 0.5]],
    [[0.3, -0.2], [1, 1]],
  ]);
  const Ginv = G.invert();
  const prod = G.multiply(Ginv);
  let maxInvErr = 0;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const expected: [number, number] = i === j ? [1, 0] : [0, 0];
      const got = prod.get(i, j);
      maxInvErr = Math.max(maxInvErr, Math.abs(got[0] - expected[0]), Math.abs(got[1] - expected[1]));
    }
  }
  out.push(check(
    'ComplexMatrix invert: g · g⁻¹ = I (2×2)',
    maxInvErr < 1e-10,
    `max err = ${maxInvErr.toExponential(2)}`,
  ));

  // dagger reverses conjugation: dagger of dagger = original.
  const dd = G.dagger().dagger();
  let maxDD = 0;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const a = G.get(i, j), b = dd.get(i, j);
      maxDD = Math.max(maxDD, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    }
  }
  out.push(check('ComplexMatrix dagger ∘ dagger = id', maxDD < 1e-14));

  return out;
}

function su11Checks(): Check[] {
  const out: Check[] = [];

  // Identity has α = 1, β = 0
  const I = SU11.identity();
  out.push(check(
    'SU11.identity = (1, 0, 0, 0)',
    I.data[0] === 1 && I.data[1] === 0 && I.data[2] === 0 && I.data[3] === 0,
  ));

  // exp(0) = I
  out.push(check('SU11.exp(0) = I', closeMat(SU11.exp([0, 0, 0]), I, 1e-14)));

  // SU(1,1) determinant constraint: |α|² − |β|² = 1.
  let maxDetErr = 0;
  for (let trial = 0; trial < 20; trial++) {
    const g = SU11.exp(randVec(3, 0.7));
    const ar = g.data[0], ai = g.data[1], br = g.data[2], bi = g.data[3];
    const constraint = (ar*ar + ai*ai) - (br*br + bi*bi) - 1;
    if (Math.abs(constraint) > maxDetErr) maxDetErr = Math.abs(constraint);
  }
  out.push(check(
    'SU(1,1) constraint |α|² − |β|² = 1 holds for exp(ξ)',
    maxDetErr < 1e-12,
    `max err = ${maxDetErr.toExponential(2)}`,
  ));

  // log ∘ exp = id (avoiding the parabolic boundary for round-trip).
  let maxRT = 0;
  for (let trial = 0; trial < 30; trial++) {
    const xi = randVec(3, 0.6);
    const back = SU11.log(SU11.exp(xi));
    let err = 0;
    for (let i = 0; i < 3; i++) err = Math.max(err, Math.abs(back[i] - xi[i]));
    if (err > maxRT) maxRT = err;
  }
  out.push(check(
    'logSU11 ∘ expSU11 = id  on small ξ',
    maxRT < 1e-10, `max err = ${maxRT.toExponential(2)}`,
  ));

  // g · g⁻¹ = I
  let maxInv = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SU11.exp(randVec(3, 0.5));
    const prod = SU11.multiply(g, SU11.inverse(g));
    for (let i = 0; i < 4; i++) {
      const target = i === 0 ? 1 : 0;
      maxInv = Math.max(maxInv, Math.abs(prod.data[i] - target));
    }
  }
  out.push(check('g · g⁻¹ = I on SU(1,1)', maxInv < 1e-12, `max err = ${maxInv.toExponential(2)}`));

  // Möbius preserves the disk: |g · z| < 1 for z in disk.
  let allInside = true;
  for (let trial = 0; trial < 30; trial++) {
    const g = SU11.exp(randVec(3, 0.5));
    // pick z in the disk
    const r = Math.random() * 0.8;
    const phi = Math.random() * 2 * Math.PI;
    const z: [number, number] = [r * Math.cos(phi), r * Math.sin(phi)];
    const w = mobiusSU11(g, z);
    if (w[0] * w[0] + w[1] * w[1] >= 1) allInside = false;
  }
  out.push(check('mobiusSU11 preserves the unit disk', allInside));

  // Cocycle for SU(1,1) Möbius
  let maxCoc = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SU11.exp(randVec(3, 0.4));
    const h = SU11.exp(randVec(3, 0.4));
    const z: [number, number] = [0.3 * Math.cos(trial), 0.3 * Math.sin(trial)];
    const gh = SU11.multiply(g, h);
    const lhs = mobiusSU11(gh, z);
    const rhs = mobiusSU11(g, mobiusSU11(h, z));
    maxCoc = Math.max(maxCoc, Math.abs(lhs[0] - rhs[0]), Math.abs(lhs[1] - rhs[1]));
  }
  out.push(check('SU(1,1) Möbius cocycle', maxCoc < 1e-10, `max err = ${maxCoc.toExponential(2)}`));

  return out;
}

function sl2cChecks(): Check[] {
  const out: Check[] = [];
  const I = SL2C.identity();

  // Identity is the complex 2×2 identity.
  out.push(check(
    'SL2C.identity is the 2×2 complex identity',
    I.get(0, 0)[0] === 1 && I.get(0, 0)[1] === 0 &&
    I.get(1, 1)[0] === 1 && I.get(1, 1)[1] === 0 &&
    I.get(0, 1)[0] === 0 && I.get(1, 0)[0] === 0,
  ));

  // exp(0) = I
  const e0 = SL2C.exp([0, 0, 0, 0, 0, 0]);
  let okE0 = true;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const z = e0.get(i, j);
    const target_re = i === j ? 1 : 0;
    if (Math.abs(z[0] - target_re) > 1e-14 || Math.abs(z[1]) > 1e-14) okE0 = false;
  }
  out.push(check('SL2C.exp(0) = I', okE0));

  // det(g) = 1 for g = exp(ξ).
  let maxDet = 0;
  for (let trial = 0; trial < 10; trial++) {
    const xi = randVec(6, 0.4);
    const g = SL2C.exp(xi);
    const detG = g.det();   // complex
    maxDet = Math.max(maxDet, Math.abs(detG[0] - 1), Math.abs(detG[1]));
  }
  out.push(check('det(exp(ξ)) = 1 on SL(2,ℂ)', maxDet < 1e-10, `max err = ${maxDet.toExponential(2)}`));

  // g · g⁻¹ = I
  let maxInv = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SL2C.exp(randVec(6, 0.4));
    const prod = SL2C.multiply(g, SL2C.inverse(g));
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const z = prod.get(i, j);
      const target_re = i === j ? 1 : 0;
      maxInv = Math.max(maxInv, Math.abs(z[0] - target_re), Math.abs(z[1]));
    }
  }
  out.push(check('g · g⁻¹ = I on SL(2,ℂ)', maxInv < 1e-10, `max err = ${maxInv.toExponential(2)}`));

  // Bracket (commutator) on a basis pair. For the H-E pair of sl(2,ℂ):
  //   [H, E] = 2E. Take H = (a_re=1, rest=0) and E = (b_re=1, rest=0).
  const br = SL2C.bracket(
    [1, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
  );
  out.push(check(
    'SL2C bracket [H, E] = 2E',
    Math.abs(br[0]) < 1e-12 && Math.abs(br[1]) < 1e-12 &&
    Math.abs(br[2] - 2) < 1e-12 && Math.abs(br[3]) < 1e-12 &&
    Math.abs(br[4]) < 1e-12 && Math.abs(br[5]) < 1e-12,
  ));

  // Möbius cocycle on the Riemann sphere
  let maxCoc = 0;
  for (let trial = 0; trial < 10; trial++) {
    const g = SL2C.exp(randVec(6, 0.3));
    const h = SL2C.exp(randVec(6, 0.3));
    const z: [number, number] = [0.5 * Math.cos(trial), 0.5 * Math.sin(trial)];
    const gh = SL2C.multiply(g, h);
    const lhs = mobiusSL2C(gh, z);
    const rhs = mobiusSL2C(g, mobiusSL2C(h, z));
    maxCoc = Math.max(maxCoc, Math.abs(lhs[0] - rhs[0]), Math.abs(lhs[1] - rhs[1]));
  }
  out.push(check('SL(2,ℂ) Möbius cocycle', maxCoc < 1e-10, `max err = ${maxCoc.toExponential(2)}`));

  // Classification: explicit examples
  const elliptic_ = SL2C.exp([0, 0, 0.5, 0, -0.5, 0]);   // sl(2,ℝ) elliptic, sits in SL(2,ℂ)
  const hyperbolic_ = SL2C.exp([0.7, 0, 0, 0, 0, 0]);    // pure H, real trace > 2
  const loxodromic_ = SL2C.exp([0.4, 0.4, 0, 0, 0, 0]);  // complex H — should be loxodromic
  out.push(check('classifySL2C: sl(2,ℝ) elliptic → elliptic', classifySL2C(elliptic_) === 'elliptic'));
  out.push(check('classifySL2C: real H → hyperbolic',          classifySL2C(hyperbolic_) === 'hyperbolic'));
  out.push(check('classifySL2C: complex H → loxodromic',       classifySL2C(loxodromic_) === 'loxodromic'));

  return out;
}

export function runLieSmokeTests(): SmokeTestReport {
  const results = [
    ...so2Checks(),
    ...so3Checks(),
    ...padeChecks(),
    ...su2Checks(),
    ...se2Checks(),
    ...se3Checks(),
    ...sl2rChecks(),
    ...iwasawaChecks(),
    ...classifyChecks(),
    ...mobiusChecks(),
    ...polarChecks(),
    ...stepperChecks(),
    ...liePoissonChecks(),
    ...rigidBodyChecks(),
    ...complexMatrixChecks(),
    ...su11Checks(),
    ...sl2cChecks(),
  ];
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.pass) passed++;
    else failed++;
  }
  return { passed, failed, results };
}
