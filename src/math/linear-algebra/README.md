# Linear Algebra

Small dense linear algebra for the math library. Targeted at the matrices that show up in differential geometry and symplectic dynamics — metric tensors, Christoffel slices, second fundamental forms, symplectic 2-forms, Hamilton-equation solves — not large-scale numerical work.

See [`docs/planning/linear-algebra.md`](../../../docs/planning/linear-algebra.md) for design rationale and scope boundaries.

## Canonical type

`Matrix` — an m×n matrix backed by a `Float64Array` in row-major order. Methods are the main API; free functions are used where they belong to a specific decomposition algorithm (e.g. `rref`, `nullspace`) or read better as mathematical operators on plain arrays (e.g. `dot`, `norm`).

### Why `Float64Array`, not `number[][]`?

Conventional choice for dense numerical code. Contiguous memory, no per-row heap allocation, cache-friendly at any `n`. For tensor-index formulas where `g[i][j]` notation really matters, use `m.toArrays()` at the top of the function — it returns a fresh nested-array snapshot (O(n²) copy, negligible for n ≤ 8) and the rest of the formula reads like index notation.

## API summary

### Construction

```ts
Matrix.fromRows([[1, 2], [3, 4]])     // from nested arrays
Matrix.zeros(3, 4)                     // 3×4 zero matrix
Matrix.identity(3)                     // 3×3 identity
new Matrix(rows, cols, data?)          // low-level with optional Float64Array
```

### Element access

```ts
m.get(i, j)                // read
m.set(i, j, v)             // write
m.getRow(i) / m.getCol(j)  // fresh number[] copies
m.toArrays()               // fresh number[][] copy — use for index-heavy formulas
m.data                     // raw Float64Array, row-major
```

### Arithmetic (pure; return new matrices)

```ts
m.add(other)               // A + B
m.scale(s)                 // s · A
m.multiply(other)          // A · B
m.transpose()              // Aᵀ
m.clone()
```

### Higher-level operations

```ts
m.mulVec(v)                // A · v  → number[]
m.vecMul(v)                // vᵀ · A → number[]
m.det()                    // determinant (LU; 2×2 fast path)
m.invert()                 // LU-based inverse
m.solve(b)                 // x such that A·x = b
m.cholesky()               // L such that A = L·Lᵀ (SPD only)
m.eigensym()               // { values, vectors } for symmetric A
```

### Row operations (mutate in place — used by `rref` and `luDecompose`)

```ts
m.swapRows(i, j)
m.scaleRow(i, s)
m.addScaledRow(target, source, s)   // target ← target + s · source
```

### Specialized free functions

```ts
rref(m)                    // mutates m to RREF, returns pivot columns
nullspace(m)               // basis for kernel as number[][]
luDecompose(A)             // { LU, permutation, parity }
choleskyDecompose(A)       // same as m.cholesky(), free-function form
eigensym(A)                // same as m.eigensym(), free-function form
```

### Vectors (on plain `number[]`)

```ts
dot(a, b)
norm(a) / normalize(a)
add(a, b) / sub(a, b) / scale(a, s)
cross(a, b)                // 3D only
```

### Numerical helpers

```ts
isClose(a, b, tol?)
isCloseVector(a, b, tol?)
isCloseMatrix(A, B, tol?)
frobenius(A)               // sqrt(Σ |a_ij|²)
```

## Usage

```ts
import { Matrix, dot } from '@/math';

// Solve Hamilton's equations: ω · X = dH
const X = omega.invert().mulVec(dH);

// Metric-weighted inner product
const g = surface.computeMetric(p);   // Matrix
const inner = dot(g.mulVec(u), v);    // gᵢⱼ uⁱ vʲ

// Tensor-index-heavy formula: extract nested arrays once
function christoffelFromMetric(metric, p) {
  const gInv = metric(p).invert().toArrays();   // number[][]
  const dg  = /* rank-3 partials as number[][][] */;
  // now use direct indexing
  // ...
}
```

## Out of scope (by design)

- QR, SVD — add when a consumer demands them.
- General (non-symmetric) eigendecomposition — hard, low current value.
- Sparse matrices — linkages rolls its own triplet representation; generalize only when a second consumer shows up.
- Complex matrices.
- Large-matrix performance work (blocking, BLAS bindings).
- Fixed-size `Mat2`/`Mat3`/`Mat4` — THREE.js already covers graphics-transform uses.
