/**
 * Two-pass moving-frame integrator for K = -1 surfaces.
 *
 * Given a sine-Gordon solution ω(u, v) on a rectangle [uMin, uMax] × [vMin,
 * vMax], reconstruct the embedded surface X: [uMin, uMax] × [vMin, vMax] →
 * ℝ³ together with its orthonormal frame (T₁, T₂, N) at every grid node by
 * integrating the connection equations along a path from (uMin, vMin) to
 * each grid point.
 *
 * Algorithm:
 *
 *   1. Starting from F = I, X = 0 at (uMin, vMin), walk along the bottom
 *      edge v = vMin in the u-direction via RK4 on
 *
 *          dF/du = F · A_u(ω_u(u, vMin)),    dX/du = T₁.
 *
 *      Store the state at each grid column.
 *
 *   2. From each bottom-edge state, walk upward in v via RK4 on
 *
 *          dF/dv = F · A_v(ω(u_i, v)),
 *          dX/dv = cos ω · T₁ + sin ω · T₂.
 *
 *      Store every grid node.
 *
 * Path-independence is guaranteed by the compatibility condition
 * ∂_v A_u − ∂_u A_v + [A_u, A_v] = 0, which reduces to ω_uv = sin ω. Any
 * polygonal path from corner to grid point gives the same answer modulo
 * discretization error.
 *
 * Result: positions[i][j] = X(u_i, v_j), T₁[i][j], T₂[i][j], N[i][j], with
 * i indexing u (0..Nu-1) and j indexing v (0..Nv-1).
 */

import * as THREE from 'three';
import { rk4 } from '@/math/ode';
import type { ScalarField2D } from '@/math/functions/ScalarField2D';
import { derivU, derivV, INIT_STATE } from './connection';

export interface FrameGridOptions {
  /** ω(u, v) as a ScalarField2D — also supplies ω_u via partialsAt. */
  omega: ScalarField2D;

  /** Rectangle in (u, v) to integrate over. */
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;

  /** Grid resolution. positions has dimensions Nu × Nv. */
  Nu: number;
  Nv: number;
}

export interface FrameGrid {
  Nu: number;
  Nv: number;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  /** du, dv: grid step sizes. */
  du: number;
  dv: number;

  /** positions[i][j] = X(u_i, v_j). */
  positions: THREE.Vector3[][];
  /** T1[i][j], T2[i][j], N[i][j] at each grid node. Right-handed orthonormal. */
  T1: THREE.Vector3[][];
  T2: THREE.Vector3[][];
  N: THREE.Vector3[][];
}

/** Unpack a length-12 state into THREE.Vector3 columns and position. */
function unpack(s: number[]): {
  T1: THREE.Vector3;
  T2: THREE.Vector3;
  N: THREE.Vector3;
  X: THREE.Vector3;
} {
  return {
    T1: new THREE.Vector3(s[0], s[3], s[6]),
    T2: new THREE.Vector3(s[1], s[4], s[7]),
    N:  new THREE.Vector3(s[2], s[5], s[8]),
    X:  new THREE.Vector3(s[9], s[10], s[11]),
  };
}

export function buildFrameGrid(opts: FrameGridOptions): FrameGrid {
  const { omega, uMin, uMax, vMin, vMax, Nu, Nv } = opts;
  if (Nu < 2 || Nv < 2) {
    throw new Error('buildFrameGrid: Nu and Nv must each be ≥ 2.');
  }

  const du = (uMax - uMin) / (Nu - 1);
  const dv = (vMax - vMin) / (Nv - 1);

  // Pass 1: walk along v = vMin in u, storing column-states.
  const bottomStates: number[][] = new Array(Nu);
  bottomStates[0] = [...INIT_STATE];

  const stepU = (state: number[], u: number) =>
    derivU(state, omega.partialsAt(u, vMin)[0]);

  for (let i = 1; i < Nu; i++) {
    const uPrev = uMin + (i - 1) * du;
    bottomStates[i] = rk4(stepU, bottomStates[i - 1], uPrev, du);
  }

  // Pass 2: from each bottom-edge state, walk upward in v.
  const positions: THREE.Vector3[][] = new Array(Nu);
  const T1: THREE.Vector3[][] = new Array(Nu);
  const T2: THREE.Vector3[][] = new Array(Nu);
  const N: THREE.Vector3[][] = new Array(Nu);

  for (let i = 0; i < Nu; i++) {
    const u = uMin + i * du;
    const stepV = (state: number[], v: number) =>
      derivV(state, omega.evaluateAt(u, v));

    positions[i] = new Array(Nv);
    T1[i] = new Array(Nv);
    T2[i] = new Array(Nv);
    N[i] = new Array(Nv);

    let state = bottomStates[i];
    const first = unpack(state);
    positions[i][0] = first.X;
    T1[i][0] = first.T1;
    T2[i][0] = first.T2;
    N[i][0] = first.N;

    for (let j = 1; j < Nv; j++) {
      const vPrev = vMin + (j - 1) * dv;
      state = rk4(stepV, state, vPrev, dv);
      const u = unpack(state);
      positions[i][j] = u.X;
      T1[i][j] = u.T1;
      T2[i][j] = u.T2;
      N[i][j] = u.N;
    }
  }

  return { Nu, Nv, uMin, uMax, vMin, vMax, du, dv, positions, T1, T2, N };
}
