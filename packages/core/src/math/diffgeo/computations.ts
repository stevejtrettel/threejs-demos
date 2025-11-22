/**
 * Differential geometry computations using finite differences
 */

import * as THREE from 'three';
import type {
  FirstFundamentalForm,
  SecondFundamentalForm,
  ChristoffelSymbols
} from './types';

/**
 * Compute partial derivatives using finite differences
 */
export function computePartials(
  f: (u: number, v: number) => THREE.Vector3,
  u: number,
  v: number,
  epsilon: number = 0.0001
): {
  pu: THREE.Vector3;   // ∂f/∂u
  pv: THREE.Vector3;   // ∂f/∂v
  puu: THREE.Vector3;  // ∂²f/∂u²
  puv: THREE.Vector3;  // ∂²f/∂u∂v
  pvv: THREE.Vector3;  // ∂²f/∂v²
} {
  const p = f(u, v);
  const p_u_plus = f(u + epsilon, v);
  const p_u_minus = f(u - epsilon, v);
  const p_v_plus = f(u, v + epsilon);
  const p_v_minus = f(u, v - epsilon);

  // First derivatives (central difference)
  const pu = new THREE.Vector3()
    .subVectors(p_u_plus, p_u_minus)
    .divideScalar(2 * epsilon);

  const pv = new THREE.Vector3()
    .subVectors(p_v_plus, p_v_minus)
    .divideScalar(2 * epsilon);

  // Second derivatives
  const puu = new THREE.Vector3()
    .addVectors(p_u_plus, p_u_minus)
    .sub(p.clone().multiplyScalar(2))
    .divideScalar(epsilon * epsilon);

  const pvv = new THREE.Vector3()
    .addVectors(p_v_plus, p_v_minus)
    .sub(p.clone().multiplyScalar(2))
    .divideScalar(epsilon * epsilon);

  const puv = new THREE.Vector3()
    .subVectors(f(u + epsilon, v + epsilon), f(u + epsilon, v - epsilon))
    .sub(new THREE.Vector3().subVectors(f(u - epsilon, v + epsilon), f(u - epsilon, v - epsilon)))
    .divideScalar(4 * epsilon * epsilon);

  return { pu, pv, puu, puv, pvv };
}

/**
 * Compute surface normal from parameterization
 */
export function computeSurfaceNormal(
  f: (u: number, v: number) => THREE.Vector3,
  u: number,
  v: number,
  epsilon: number = 0.0001
): THREE.Vector3 {
  const { pu, pv } = computePartials(f, u, v, epsilon);
  return new THREE.Vector3().crossVectors(pu, pv).normalize();
}

/**
 * Compute first fundamental form: g_ij = <∂_i, ∂_j>
 */
export function computeFirstFundamentalForm(
  f: (u: number, v: number) => THREE.Vector3,
  u: number,
  v: number,
  epsilon: number = 0.0001
): FirstFundamentalForm {
  const { pu, pv } = computePartials(f, u, v, epsilon);

  return {
    E: pu.dot(pu),  // <∂u, ∂u>
    F: pu.dot(pv),  // <∂u, ∂v>
    G: pv.dot(pv)   // <∂v, ∂v>
  };
}

/**
 * Compute second fundamental form: h_ij = <∂_ij, N>
 */
export function computeSecondFundamentalForm(
  f: (u: number, v: number) => THREE.Vector3,
  u: number,
  v: number,
  epsilon: number = 0.0001
): SecondFundamentalForm {
  const { pu, pv, puu, puv, pvv } = computePartials(f, u, v, epsilon);
  const N = new THREE.Vector3().crossVectors(pu, pv).normalize();

  return {
    L: puu.dot(N),  // <∂uu, N>
    M: puv.dot(N),  // <∂uv, N>
    N: pvv.dot(N)   // <∂vv, N>
  };
}

/**
 * Compute Christoffel symbols: Γ^k_ij
 *
 * Using the formula:
 * Γ^k_ij = (1/2) g^kl (∂_i g_jl + ∂_j g_il - ∂_l g_ij)
 *
 * For surfaces, we compute them from the first fundamental form
 */
export function computeChristoffelSymbols(
  f: (u: number, v: number) => THREE.Vector3,
  u: number,
  v: number,
  epsilon: number = 0.0001
): ChristoffelSymbols {
  // First fundamental form and its derivatives
  const g = computeFirstFundamentalForm(f, u, v, epsilon);
  const g_u = computeFirstFundamentalForm(f, u + epsilon, v, epsilon);
  const g_v = computeFirstFundamentalForm(f, u, v + epsilon, epsilon);

  const E = g.E, F = g.F, G = g.G;
  const E_u = (g_u.E - E) / epsilon;
  const E_v = (g_v.E - E) / epsilon;
  const F_u = (g_u.F - F) / epsilon;
  const F_v = (g_v.F - F) / epsilon;
  const G_u = (g_u.G - G) / epsilon;
  const G_v = (g_v.G - G) / epsilon;

  // Inverse metric: g^ij
  const det = E * G - F * F;
  const g_inv_uu = G / det;
  const g_inv_uv = -F / det;
  const g_inv_vv = E / det;

  // Christoffel symbols using the formula
  // Γ^u_uu = (1/2) g^u_u E_u + g^u_v F_u - (1/2) g^u_v E_v
  const Γ_u_uu = 0.5 * g_inv_uu * E_u + g_inv_uv * F_u - 0.5 * g_inv_uv * E_v;
  const Γ_u_uv = 0.5 * g_inv_uu * E_v + 0.5 * g_inv_uv * (F_u + F_v - G_u);
  const Γ_u_vu = Γ_u_uv;  // Symmetry
  const Γ_u_vv = 0.5 * g_inv_uu * (2 * F_v - G_u) + 0.5 * g_inv_uv * G_v;

  const Γ_v_uu = 0.5 * g_inv_uv * E_u + 0.5 * g_inv_vv * (2 * F_u - E_v);
  const Γ_v_uv = 0.5 * g_inv_uv * E_v + 0.5 * g_inv_vv * (F_u + F_v - G_u);
  const Γ_v_vu = Γ_v_uv;  // Symmetry
  const Γ_v_vv = 0.5 * g_inv_uv * (2 * F_v - G_u) + 0.5 * g_inv_vv * G_v;

  return {
    u: {
      u: { u: Γ_u_uu, v: Γ_u_uv },
      v: { u: Γ_u_vu, v: Γ_u_vv }
    },
    v: {
      u: { u: Γ_v_uu, v: Γ_v_uv },
      v: { u: Γ_v_vu, v: Γ_v_vv }
    }
  };
}

/**
 * Compute Gaussian curvature: K = (LN - M²) / (EG - F²)
 */
export function computeGaussianCurvature(
  f: (u: number, v: number) => THREE.Vector3,
  u: number,
  v: number,
  epsilon: number = 0.0001
): number {
  const I = computeFirstFundamentalForm(f, u, v, epsilon);
  const II = computeSecondFundamentalForm(f, u, v, epsilon);

  const det_I = I.E * I.G - I.F * I.F;
  const det_II = II.L * II.N - II.M * II.M;

  return det_II / det_I;
}

/**
 * Compute mean curvature: H = (EN - 2FM + GL) / (2(EG - F²))
 */
export function computeMeanCurvature(
  f: (u: number, v: number) => THREE.Vector3,
  u: number,
  v: number,
  epsilon: number = 0.0001
): number {
  const I = computeFirstFundamentalForm(f, u, v, epsilon);
  const II = computeSecondFundamentalForm(f, u, v, epsilon);

  const det_I = I.E * I.G - I.F * I.F;
  const numerator = I.E * II.N - 2 * I.F * II.M + I.G * II.L;

  return numerator / (2 * det_I);
}
