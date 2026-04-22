# Linear algebra toolkit — plan

**Date:** 2026-04-22
**Status:** proposed, awaiting decision
**Prompted by:** need for `det`, `invert` while building `math/manifolds/`. Current `linear-algebra/` module covers row reduction and nullspace only; anything beyond that was about to be vibecoded.

## Goal

A focused, well-tested toolkit for *small dense* linear algebra, covering the operations the math library actually needs: metric tensors, differential forms, symplectic linear algebra, principal curvatures, and any future Hamilton-style linear solves. Not a general numerical library — no large-sparse, no production-grade SVD, no complex arithmetic unless forced by a demo.

## Scope

**In scope.**
- Small square matrices (n ≤ 8 typical; n ≤ ~32 still fine) as dense `Float64Array`-backed `Matrix` objects.
- LU-based workhorses: determinant, inverse, linear solve.
- Cholesky for symmetric positive-definite matrices (metric tensors are SPD).
- Jacobi eigendecomposition for symmetric matrices (principal curvatures, spectral decomposition of quadratic forms).
- Conversions to/from plain `number[][]` at API boundaries, so hand-written math formulas can read `g[i][j]` naturally.
- A small set of free-function vector ops on `number[]` (dot, norm, cross, normalize, add, scale) — where a call site wants vector math but not a class wrapper.

**Out of scope (defer until a demo demands it).**
- General (non-symmetric) eigendecomposition — needs the QR algorithm, complex arithmetic for complex eigenvalues, iterative convergence. Real cost, low current value.
- QR decomposition / Gram-Schmidt — useful for least squares, but no demo needs it yet.
- SVD — the hard one. Add when PCA / pseudo-inverse / rank-revealing is actually required.
- Sparse matrices — linkages already roll their own triplet representation; generalize only if a second sparse consumer shows up.
- Complex matrices (Hermitian, unitary).
- Large-matrix performance work (blocking, cache-friendly traversal, BLAS bindings).
- Structured small-dim types (`Mat2`, `Mat3`, `Mat4`). Three.js already covers 3×3 and 4×4 for geometry transforms; a parallel typed-small layer would just add confusion. Use `Matrix` at any n.

## Current state

```
src/math/linear-algebra/
  Matrix.ts        class: Float64Array row-major, basic ops + row ops
  rref.ts          free fn: reduce to RREF in place, returns pivot cols
  nullspace.ts     free fn: basis for kernel (uses rref)
  index.ts         barrel: exports Matrix, rref, nullspace
  README.md        documents current state; "Future" section lists det, inverse, rank, eigen, sparse
  det.ts           [draft, vibecoded]  LU-based determinant
  invert.ts        [draft, vibecoded]  Gauss-Jordan inverse
```

Current consumers: `experiments/cubic/main.ts` uses `nullspace`. That's it — the `Matrix` class is otherwise unused in the codebase. The `math/linkages/` module rolls its own sparse Jacobian in triplet form and does not touch `linear-algebra/`.

## API shape

### Keep: class for the container, free functions for operations

The existing choice (class for storage + row ops, free functions for higher-level operations) is good. It matches the existing files (`rref`, `nullspace`) and keeps the class thin.

```ts
// Ownership
import { Matrix } from '@/math/linear-algebra';

// Operations
import { rref, nullspace, det, invert, solve, cholesky, eigensym } from '@/math/linear-algebra';

const A = Matrix.fromRows([[2, 1], [1, 3]]);
const x = solve(A, [1, 2]);    // returns number[]
const d = det(A);               // returns number
const Ainv = invert(A);         // returns Matrix
```

### Plain arrays at API boundaries

Hand-written geometric formulas (Christoffel, Hodge star, wedge) read better with `g[i][j]` than `g.get(i, j)`. Rule: `Matrix` is the *internal* working type for algorithms; `number[][]` is the *interchange* type at boundaries where readability matters.

`Matrix.fromRows(number[][])` and `Matrix.toArrays(): number[][]` bridge the two. Allocation cost for n ≤ 8 is irrelevant.

Some free functions accept either (use `ensureMatrix(m: Matrix | number[][]): Matrix`). Don't proliferate overloads; pick one input type per function.

### Immutability convention

- High-level ops (`det`, `invert`, `solve`, `cholesky`, `eigensym`): pure, return new values, do not mutate input.
- Low-level row ops on `Matrix` (`swapRows`, `scaleRow`, `addScaledRow`): mutate in place; these exist to let `rref`, `invert` etc. compose. Documented on `Matrix`.
- Decomposition routines that need scratch space copy the input internally.

### Vector utilities

A small set of free functions on `number[]`:

```ts
dot(a: number[], b: number[]): number
norm(a: number[]): number
normalize(a: number[]): number[]
add(a: number[], b: number[]): number[]
sub(a: number[], b: number[]): number[]
scale(a: number[], s: number): number[]
cross(a: number[], b: number[]): number[]          // 3D only; throw otherwise
matVec(A: Matrix, v: number[]): number[]           // A·v
vecMat(v: number[], A: Matrix): number[]           // vᵀ·A
```

No `Vector` class. The project uses `THREE.Vector3` where appropriate (3D geometry) and plain arrays where dimension is variable (manifolds, forms).

Placed in `math/linear-algebra/vectors.ts`.

## Additions, in priority order

Each item is independently shippable and testable.

### 1. LU + det + solve + invert (one pass, shared factorization)

One file, one algorithm, three public functions. LU with partial pivoting. `det` is the signed product of pivots. `solve` is forward + back substitution. `invert` is `solve` against identity columns (or the Gauss-Jordan already drafted — pick one).

Files:
- `math/linear-algebra/lu.ts` — `luDecompose(A): { L, U, P, sign }`
- `math/linear-algebra/det.ts` — uses `luDecompose`
- `math/linear-algebra/solve.ts` — `solve(A, b): number[]`
- `math/linear-algebra/invert.ts` — uses `solve`

The vibecoded `det.ts` and `invert.ts` get rewritten against `luDecompose` instead of each running their own elimination. Less duplicated code, one implementation of pivoting.

### 2. Cholesky for SPD matrices

Metric tensors are symmetric positive-definite. Cholesky (`A = LLᵀ`) is ~2× faster than LU, and the failure mode (non-SPD) is informative ("your metric is not positive-definite — probably a sign error"). Backstops `invert` for metrics.

File: `math/linear-algebra/cholesky.ts` — `cholesky(A): Matrix` (lower triangular), throws with a clear message if `A` isn't SPD.

### 3. Vector utilities

Free functions on `number[]` as above. File: `math/linear-algebra/vectors.ts`.

### 4. Symmetric eigendecomposition (Jacobi)

Iterative Jacobi rotations — simple, convergent, gives orthonormal eigenvectors. Only for symmetric matrices. Unlocks: principal curvatures on `DifferentialSurface` (currently noted as "future" in `math-needs.md`), spectral decomposition of second fundamental form, normal-mode-style analysis.

File: `math/linear-algebra/eigensym.ts` — `eigensym(A): { values: number[], vectors: Matrix }` (columns of `vectors` are eigenvectors, sorted descending).

### 5. Small numerical helpers

- `isClose(a: number, b: number, tol?): boolean`
- `isCloseMatrix(A, B, tol?)` and `isCloseVector`
- `frobenius(A): number` — Frobenius norm, useful for diagnostics and test assertions.

File: `math/linear-algebra/numerics.ts`.

## Deferred with rationale

| Feature | Why deferred |
| --- | --- |
| QR decomposition | No current consumer. Add when least-squares or Gram-Schmidt orthonormalization is actually needed. |
| General (non-symmetric) eigen | Hard to implement correctly; real eigenvalues only in special cases; complex arithmetic is a separate rabbit hole. Wait for a demo that genuinely needs it. |
| SVD | Big implementation cost, genuinely useful, but nothing current pushes for it. Add when PCA / pseudo-inverse / low-rank work shows up. |
| Sparse matrices | Only linkages is sparse and it already has a purpose-built representation. If a second sparse consumer appears, that is the signal to generalize. |
| Block / banded structure | Premature. |
| Typed small-dim (`Mat2`, `Mat3`) | Three.js covers 3×3 / 4×4. A separate small-dim typed layer adds naming without adding capability. Only add if benchmarks show `Matrix` overhead is a problem for n = 2, 3. |

## How `manifolds/` will use it

Replaces the current `manifolds/linear.ts` entirely. After this plan lands:

- `Manifold.computeMetric(p): number[][]` stays as the public interface shape (readable in formulas).
- `christoffelFromMetric` converts the metric to `Matrix`, calls `invert`, pulls out a `number[][]` via `toArrays()`, then does the index-heavy sum in plain arrays.
- `Euclidean.ts` stops using the local `identity` / `zeros` helpers; it either uses `Matrix.identity(n).toArrays()` or just inlines the trivial constant matrix. Probably the latter, since it's truly trivial.
- `manifolds/linear.ts` is deleted. `isSymmetric` and `symmetrize` move to `linear-algebra/numerics.ts` if still useful; otherwise dropped until needed.

Phase 2 (subsume 2D) will then touch the surface-level consumers (`christoffel.ts`, `pullback.ts`, `GeodesicIntegrator.ts`) to use the unified `linear-algebra/` toolkit instead of scattered `number[][]` + hand-written inversion.

## Testing strategy

Tests matter more here than for most library code — wrong linear algebra is a silent correctness killer downstream.

For each decomposition, cover:
- **Known-answer tests** — hand-computed 2×2 and 3×3 cases (determinant, inverse, eigenvalues of simple matrices).
- **Round-trip tests** — `A · invert(A) ≈ I`, `L · Lᵀ ≈ A` for Cholesky, `Q V Qᵀ ≈ A` for eigensym.
- **Known-singular** — `invert` on a rank-deficient matrix should throw with a clear message; `det` should return 0 (or within tolerance).
- **Dimension sweep** — run the round-trip test at n = 2, 3, 4, 5 with random SPD matrices (seeded for reproducibility).

No test framework is currently wired up in this project — the existing convention is ad-hoc smoke scripts in `/tmp`. Two options:
1. **Add a test runner** (Vitest, since Vite is already the dev server). Modest setup. Correct long-term.
2. **Keep smoke scripts, check them in** under `src/math/linear-algebra/__tests__/` or similar, runnable via `npx tsx`.

Recommendation: Vitest. Thirty minutes of setup, and the linear-algebra toolkit is exactly the kind of code where an actual test suite pays off immediately. This is a small scope creep but it's the right tool.

## Open design questions

1. **Test runner.** Vitest vs checked-in smoke scripts. (Recommendation: Vitest.)
2. **Free functions vs methods on `Matrix`.** Add `invert`, `det` as free functions (current draft) or as `Matrix.prototype.invert()` / `.det()` methods (ergonomic, `A.invert()`). Existing `rref(m)` is free-function; I'd continue that pattern for internal consistency.
3. **Input flexibility.** Do `det`, `invert`, `solve` accept `Matrix | number[][]` (auto-convert) or strictly `Matrix`? Strict is simpler; flexible is more ergonomic for one-off callers. I lean strict: one input type per function, with clear conversion utilities.
4. **`number[][]` vs `number[]` row-major for the "plain" shape.** Nested arrays (what I've been using) vs a flat `number[]` with dimension info. Nested is readable; flat is one allocation. For small n, nested wins on clarity.
5. **Vector ops location.** `math/linear-algebra/vectors.ts`, or a new `math/vectors/` folder. I'd put them in `linear-algebra/` — they naturally co-live with matrix ops.
6. **Reconcile the vibecoded files.** `invert.ts` and `det.ts` currently stand alone. Rewrite them against the new `lu.ts`? Or leave as-is for small n and add `lu` separately? The first option is cleaner; the second is less work upfront. I lean toward the rewrite — keep one LU pivoting implementation in the codebase.

## Proposed order

1. Nail the open questions above.
2. `lu.ts` + rewrite `det.ts`, `invert.ts`, add `solve.ts`.
3. `vectors.ts`.
4. `numerics.ts`.
5. Wire up Vitest; write tests for what exists.
6. `cholesky.ts` with tests.
7. `eigensym.ts` with tests.
8. Delete `manifolds/linear.ts`, update `christoffel.ts` and `Euclidean.ts` to use the unified toolkit.
9. Update `linear-algebra/README.md` to document the new API.

Pause points after each step. The toolkit is in a working state at every boundary.
