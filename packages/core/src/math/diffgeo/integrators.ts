/**
 * ODE integrators for differential geometry
 * Pure functions for numerical integration
 */

import * as THREE from 'three';
import { TangentVector } from './types';
import type { DifferentialSurface } from './types';

/**
 * Single step of 4th-order Runge-Kutta integration
 *
 * @param f - Derivative function: state → derivative
 * @param state - Current state
 * @param dt - Time step
 * @returns New state after one step
 */
export function rungeKutta4<T>(
  f: (state: T) => T,
  state: T,
  dt: number,
  add: (a: T, b: T, scale: number) => T
): T {
  const k1 = f(state);
  const k2 = f(add(state, k1, dt * 0.5));
  const k3 = f(add(state, k2, dt * 0.5));
  const k4 = f(add(state, k3, dt));

  // Weighted average: (k1 + 2*k2 + 2*k3 + k4) / 6
  let result = add(state, k1, dt / 6);
  result = add(result, k2, dt / 3);
  result = add(result, k3, dt / 3);
  result = add(result, k4, dt / 6);

  return result;
}

/**
 * RK4 specialized for TangentVector
 *
 * @param f - Acceleration function: TangentVector → Vector2 acceleration
 * @param state - Current tangent vector
 * @param dt - Time step
 * @returns New tangent vector after one step
 */
export function rungeKutta4TangentVector(
  f: (state: TangentVector) => THREE.Vector2,
  state: TangentVector,
  dt: number
): TangentVector {
  // k1
  const k1_vel = state.vel.clone();
  const k1_acc = f(state);

  // k2
  const s2 = new TangentVector(
    state.pos.clone().addScaledVector(k1_vel, dt * 0.5),
    state.vel.clone().addScaledVector(k1_acc, dt * 0.5)
  );
  const k2_vel = s2.vel.clone();
  const k2_acc = f(s2);

  // k3
  const s3 = new TangentVector(
    state.pos.clone().addScaledVector(k2_vel, dt * 0.5),
    state.vel.clone().addScaledVector(k2_acc, dt * 0.5)
  );
  const k3_vel = s3.vel.clone();
  const k3_acc = f(s3);

  // k4
  const s4 = new TangentVector(
    state.pos.clone().addScaledVector(k3_vel, dt),
    state.vel.clone().addScaledVector(k3_acc, dt)
  );
  const k4_vel = s4.vel.clone();
  const k4_acc = f(s4);

  // Combine
  const newPos = state.pos.clone()
    .addScaledVector(k1_vel, dt / 6)
    .addScaledVector(k2_vel, dt / 3)
    .addScaledVector(k3_vel, dt / 3)
    .addScaledVector(k4_vel, dt / 6);

  const newVel = state.vel.clone()
    .addScaledVector(k1_acc, dt / 6)
    .addScaledVector(k2_acc, dt / 3)
    .addScaledVector(k3_acc, dt / 3)
    .addScaledVector(k4_acc, dt / 6);

  return new TangentVector(newPos, newVel);
}

/**
 * Compute geodesic acceleration: d²γ/dt² = -Γ^k_ij (dγ^i/dt)(dγ^j/dt)
 *
 * @param surface - Surface with Christoffel symbols
 * @param tv - Current tangent vector
 * @returns Acceleration in parameter space
 */
export function geodesicAcceleration(
  surface: DifferentialSurface,
  tv: TangentVector
): THREE.Vector2 {
  const Γ = surface.christoffelSymbols(tv.pos.x, tv.pos.y);
  const u_dot = tv.vel.x;
  const v_dot = tv.vel.y;

  // ü = -Γ^u_uu (u')² - 2Γ^u_uv u'v' - Γ^u_vv (v')²
  const u_ddot = -(
    Γ.u.u.u * u_dot * u_dot +
    2 * Γ.u.u.v * u_dot * v_dot +
    Γ.u.v.v * v_dot * v_dot
  );

  // v̈ = -Γ^v_uu (u')² - 2Γ^v_uv u'v' - Γ^v_vv (v')²
  const v_ddot = -(
    Γ.v.u.u * u_dot * u_dot +
    2 * Γ.v.u.v * u_dot * v_dot +
    Γ.v.v.v * v_dot * v_dot
  );

  return new THREE.Vector2(u_ddot, v_ddot);
}

/**
 * Integrate a geodesic on a surface
 *
 * @param surface - Surface to integrate on
 * @param initialTV - Initial position and velocity
 * @param options - Integration parameters
 * @returns Array of points in 3D space
 */
export function integrateGeodesic(
  surface: DifferentialSurface,
  initialTV: TangentVector,
  options: {
    steps?: number;
    stepSize?: number;
    maxArcLength?: number;
    isOutsideDomain?: (u: number, v: number) => boolean;
  } = {}
): THREE.Vector3[] {
  const {
    steps = 500,
    stepSize = 0.01,
    maxArcLength = Infinity,
    isOutsideDomain
  } = options;

  const points: THREE.Vector3[] = [];
  let state = initialTV.clone();
  let arcLength = 0;

  // Acceleration function
  const acceleration = (tv: TangentVector) => geodesicAcceleration(surface, tv);

  for (let i = 0; i < steps; i++) {
    // Check domain boundary (from GraphGeometry.js line 198)
    if (isOutsideDomain && isOutsideDomain(state.pos.x, state.pos.y)) {
      break;
    }

    // Check for invalid state
    if (isNaN(state.pos.x) || isNaN(state.pos.y) ||
        isNaN(state.vel.x) || isNaN(state.vel.y) ||
        !isFinite(state.pos.x) || !isFinite(state.pos.y) ||
        !isFinite(state.vel.x) || !isFinite(state.vel.y)) {
      console.warn('Geodesic integration encountered invalid state at step', i);
      break;
    }

    // Add current point
    const p = surface.parameterization(state.pos.x, state.pos.y);

    // Validate point
    if (!p || isNaN(p.x) || isNaN(p.y) || isNaN(p.z) ||
        !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
      console.warn('Geodesic parameterization returned invalid point at step', i, 'state:', state.pos);
      break;
    }

    points.push(p);

    // Check arc length limit
    if (i > 0) {
      arcLength += p.distanceTo(points[i - 1]);
      if (arcLength > maxArcLength) {
        break;
      }
    }

    // Integrate one step
    state = rungeKutta4TangentVector(acceleration, state, stepSize);
  }

  return points;
}

/**
 * Compute parallel transport derivative: DV/dt = -Γ^i_jk γ'^j V^k
 *
 * From GraphGeometry.js lines 53-79
 *
 * @param surface - Surface with Christoffel symbols
 * @param tv - Tangent vector (position and velocity along curve)
 * @param V - Vector being transported
 * @returns Derivative of V
 */
export function parallelTransportDerivative(
  surface: DifferentialSurface,
  tv: TangentVector,
  V: THREE.Vector2
): THREE.Vector2 {
  const { pos, vel } = tv;
  const Γ = surface.christoffelSymbols(pos.x, pos.y);

  // DV/dt = -Γ^i_jk γ'^j V^k
  const VuP =
    -vel.x * (Γ.u.u.u * V.x + Γ.u.u.v * V.y) -
    vel.y * (Γ.u.v.u * V.x + Γ.u.v.v * V.y);

  const VvP =
    -vel.x * (Γ.v.u.u * V.x + Γ.v.u.v * V.y) -
    vel.y * (Γ.v.v.u * V.x + Γ.v.v.v * V.y);

  return new THREE.Vector2(VuP, VvP);
}

/**
 * Integrate parallel transport along a curve
 *
 * From GraphGeometry.js getParallelTransport (lines 252-256)
 *
 * @param surface - Surface to transport on
 * @param curve - Array of (u,v) points defining the curve
 * @param initialVectors - Initial basis vectors to transport [e1, e2]
 * @param options - Integration parameters
 * @returns Array of transported basis vectors at each curve point
 *
 * @example
 *   const curve = integrateGeodesicCoords(surface, initialTV, { steps: 100 });
 *   const initial = [new Vector2(1,0), new Vector2(0,1)];
 *   const transported = integrateParallelTransport(surface, curve, initial);
 *   // transported[i] = [e1, e2] at curve[i]
 */
export function integrateParallelTransport(
  surface: DifferentialSurface,
  curve: THREE.Vector2[],
  initialVectors: [THREE.Vector2, THREE.Vector2],
  options: {
    stepSize?: number;
  } = {}
): Array<[THREE.Vector2, THREE.Vector2]> {
  const { stepSize = 0.0005 } = options;

  if (curve.length < 2) {
    return [initialVectors];
  }

  const result: Array<[THREE.Vector2, THREE.Vector2]> = [];
  result.push([initialVectors[0].clone(), initialVectors[1].clone()]);

  let e1 = initialVectors[0].clone();
  let e2 = initialVectors[1].clone();

  // Integrate along curve segments
  for (let i = 1; i < curve.length; i++) {
    const p0 = curve[i - 1];
    const p1 = curve[i];

    // Tangent vector along curve
    const dt = p1.clone().sub(p0);
    const ds = dt.length();

    if (ds < 1e-10) {
      result.push([e1.clone(), e2.clone()]);
      continue;
    }

    const vel = dt.divideScalar(ds);
    const tv = new TangentVector(p0, vel);

    // Simple Euler integration (can upgrade to RK4 if needed)
    const de1 = parallelTransportDerivative(surface, tv, e1);
    const de2 = parallelTransportDerivative(surface, tv, e2);

    e1.add(de1.multiplyScalar(stepSize));
    e2.add(de2.multiplyScalar(stepSize));

    result.push([e1.clone(), e2.clone()]);
  }

  return result;
}

/**
 * Integrate geodesic in parameter space (returns (u,v) coordinates)
 *
 * @param surface - Surface to integrate on
 * @param initialTV - Initial position and velocity
 * @param options - Integration parameters
 * @returns Array of (u,v) points
 */
export function integrateGeodesicCoords(
  surface: DifferentialSurface,
  initialTV: TangentVector,
  options: {
    steps?: number;
    stepSize?: number;
  } = {}
): THREE.Vector2[] {
  const {
    steps = 500,
    stepSize = 0.01
  } = options;

  const coords: THREE.Vector2[] = [];
  let state = initialTV.clone();

  const acceleration = (tv: TangentVector) => geodesicAcceleration(surface, tv);

  for (let i = 0; i < steps; i++) {
    coords.push(state.pos.clone());
    state = rungeKutta4TangentVector(acceleration, state, stepSize);
  }

  return coords;
}
