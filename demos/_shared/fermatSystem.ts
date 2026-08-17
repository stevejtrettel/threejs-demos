/**
 * The toy system for the certified-solving demos.
 *
 * A schematic, at the lowest dimension where the picture still has all the
 * moving parts, of the search-then-certify pipeline used to certify the
 * 8-vertex square paper torus. There the constraint locus is a flat,
 * square-modulus locus in ℝ²⁴ and the certified system is 9 × 9; here it is a
 * cubic surface in ℝ³ and the system is 3 × 3. Nothing about the real example
 * is being modelled — only the shape of the method.
 *
 * ## The pieces
 *
 * A surface `S ⊂ ℝ³`, the Fermat cubic, cut out by
 *
 *     g(x, y, z) = x³ + y³ + z³ − 1.
 *
 * `∇g = 3(x², y², z²)` vanishes only at the origin, which is not on `S`, so
 * `S` is a smooth surface everywhere.
 *
 * A map to the plane, written in ambient coordinates,
 *
 *     F(x, y, z) = (x³ − y² + z,  xy + yz + zx),
 *
 * and the question: where on `S` does `F = (0, 1)`?
 *
 * That is two equations on a 2-manifold, so the solutions are isolated points.
 * Equivalently — and this is the form Newton and the Krawczyk test want — it is
 * the square system
 *
 *     G = (g,  F₁,  F₂ − 1) : ℝ³ → ℝ³
 *
 * whose zeros are exactly the solutions. Note what that reframing does: being
 * *on the surface* stops being a background assumption and becomes one of the
 * three equations, certified alongside the other two.
 *
 * There are exactly two real solutions, both nondegenerate (`det DG` ≈ +6.79
 * and −8.89). They are the two points where the curve `{F₁ = 0}` crosses the
 * small oval `{F₂ = 1}`, both drawn on the surface in `certify-descent`.
 *
 * ## The graph chart
 *
 * Real cube roots are single-valued, so `S` is globally a graph:
 *
 *     z = ∛(1 − x³ − y³).
 *
 * This is used *only* for meshing the surface and for tracing level curves on
 * it — the fast, exact way to draw this particular example. Every algorithm in
 * the demos works on the implicit form, through `ImplicitSurface3D`, exactly as
 * it would for a surface with no such chart.
 */

import * as THREE from 'three';
import { Matrix } from '@/math/linear-algebra';
import { ImplicitSurface3D } from '@/math/implicit';
import { leastSquaresObjective, type DifferentiableMap } from '@/math/rootfind';
import type { IntervalSystem } from '@/math/certify';
import { iadd, icube, imul, ipoint, iscale, isqr, isub } from '@/math/interval';

/** The window in the `(x, y)` graph chart that the demos draw. */
export const CHART = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };

/** The value of `F` we are solving for. */
export const TARGET = [0, 1];

/** `S = { g = 0 }`, the Fermat cubic surface. */
export const surface = new ImplicitSurface3D({
  value: (x, y, z) => x ** 3 + y ** 3 + z ** 3 - 1,
  gradient: (x, y, z) => [3 * x * x, 3 * y * y, 3 * z * z],
});

/** `z` on the surface above `(x, y)` — the graph chart. */
export function height(x: number, y: number): number {
  return Math.cbrt(1 - x ** 3 - y ** 3);
}

/** The point of `S` above `(x, y)`. */
export function lift(x: number, y: number): number[] {
  return [x, y, height(x, y)];
}

/**
 * How much a unit of chart area stretches on the surface — the area element
 * `√(1 + hₓ² + h_y²)` of the graph `z = h(x, y)`.
 *
 * Differentiating `h = (1 − x³ − y³)^{1/3}` gives `hₓ = −x²/z²`, `h_y = −y²/z²`,
 * so the factor is `√(1 + (x⁴ + y⁴)/z⁴)`. It is *unbounded*: along the curve
 * `x³ + y³ = 1` the height `z` vanishes, and there the normal `∇g = 3(x², y², z²)`
 * is horizontal — the surface stands up as a cliff over the `(x, y)`-plane and
 * the graph chart degenerates. Over the drawn window the factor ranges from 1
 * to about 10⁴.
 *
 * It is nonetheless integrable, so sampling *uniformly by surface area* is well
 * posed: near the curve `z³ = 1 − x³ − y³ ≈ c·u` for `u` the distance to it, so
 * the factor grows like `u^(−2/3)` and the exponent is under 1. The drawn patch
 * has finite area ≈ 31.63.
 *
 * Anything that wants points spread evenly on `S` rather than evenly on the
 * chart has to weight by this.
 */
export function chartAreaElement(x: number, y: number): number {
  const z = height(x, y);
  return Math.sqrt(1 + (x ** 4 + y ** 4) / z ** 4);
}

/** `F: ℝ³ → ℝ²`. */
export const F: DifferentiableMap = {
  domainDim: 3,
  codomainDim: 2,

  value([x, y, z]) {
    return Float64Array.of(x ** 3 - y * y + z, x * y + y * z + z * x);
  },

  jacobian([x, y, z]) {
    return Matrix.fromRows([
      [3 * x * x, -2 * y, 1],
      [y + z, x + z, x + y],
    ]);
  },
};

/** `G = (g, F₁, F₂ − 1): ℝ³ → ℝ³` — the square system Newton solves. */
export const squareSystem: DifferentiableMap = {
  domainDim: 3,
  codomainDim: 3,

  value([x, y, z]) {
    return Float64Array.of(
      x ** 3 + y ** 3 + z ** 3 - 1,
      x ** 3 - y * y + z,
      x * y + y * z + z * x - 1,
    );
  },

  jacobian([x, y, z]) {
    return Matrix.fromRows([
      [3 * x * x, 3 * y * y, 3 * z * z],
      [3 * x * x, -2 * y, 1],
      [y + z, x + z, x + y],
    ]);
  },
};

/**
 * The same square system, evaluable over boxes as well as at points.
 *
 * The interval versions are the identical polynomials with interval operations
 * substituted, with one care: `y²` uses `isqr` rather than `imul(Y, Y)`, since
 * multiplying an interval by itself forgets that the two factors are the same
 * number and admits impossible products. Every other term is linear in each
 * variable it involves, so no such rewriting helps it.
 */
export const intervalSystem: IntervalSystem = {
  dim: 3,

  value: (p) => squareSystem.value(p),
  jacobian: (p) => squareSystem.jacobian(p),

  intervalValue([X, Y, Z]) {
    return [
      isub(iadd(iadd(icube(X), icube(Y)), icube(Z)), ipoint(1)),
      iadd(isub(icube(X), isqr(Y)), Z),
      isub(iadd(iadd(imul(X, Y), imul(Y, Z)), imul(Z, X)), ipoint(1)),
    ];
  },

  intervalJacobian([X, Y, Z]) {
    return [
      [iscale(3, isqr(X)), iscale(3, isqr(Y)), iscale(3, isqr(Z))],
      [iscale(3, isqr(X)), iscale(-2, Y), ipoint(1)],
      [iadd(Y, Z), iadd(X, Z), iadd(X, Y)],
    ];
  },
};

/** `φ = ½‖F − (0,1)‖²`, the objective the descent flows down. */
export const objective = leastSquaresObjective(F, TARGET);

/** `‖F(p) − (0,1)‖` — the residual the descent is trying to kill. */
export function residual(p: number[]): number {
  const v = F.value(p);
  return Math.hypot(v[0] - TARGET[0], v[1] - TARGET[1]);
}

/** `‖G(p)‖` — the residual of the full square system, including `g`. */
export function systemResidual(p: number[]): number {
  const v = squareSystem.value(p);
  return Math.hypot(v[0], v[1], v[2]);
}

/**
 * The two real solutions, polished by Newton to machine precision.
 *
 * Reproduced by `scripts/validate-certify.ts`, which also checks that random
 * multistart Newton finds these two and nothing else.
 */
export const SOLUTIONS: number[][] = [
  [0.249833074825656, 0.853582930172214, 0.713010096258212],
  [0.756731660627702, 0.820709208866623, 0.240226663839],
];

/**
 * Math coordinates → world coordinates.
 *
 * A cyclic permutation `(x, y, z) → (y, z, x)`, which puts the surface's `z`
 * along the world's up axis while keeping the frame right-handed (a swap would
 * mirror the scene).
 */
export function toWorld(p: ArrayLike<number>): THREE.Vector3 {
  return new THREE.Vector3(p[1], p[2], p[0]);
}

/** World coordinates → math coordinates, inverse of `toWorld`. */
export function fromWorld(v: THREE.Vector3): number[] {
  return [v.z, v.x, v.y];
}
