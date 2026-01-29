# Linear Algebra

General-purpose matrix operations beyond what Three.js provides (which caps out at 4×4).

## Current state

**Matrix** — an m×n matrix backed by `Float64Array` (row-major). Supports:
- Construction: `fromRows`, `zeros`, `identity`
- Element access: `get`, `set`, `getRow`, `getCol`
- Arithmetic: `add`, `scale`, `multiply`, `transpose`, `clone`
- Row operations: `swapRows`, `scaleRow`, `addScaledRow` (mutate in place)

**rref** — reduces a matrix to reduced row echelon form in place via Gaussian elimination with partial pivoting. Returns pivot column indices.

**nullspace** — computes a basis for the kernel of a matrix (as `number[][]`) by cloning, running RREF, and reading off free variables.

## Usage

```typescript
import { Matrix, nullspace } from '@/math';

const m = Matrix.fromRows([
  [1, 0, 2, 1, 0, 3],
  [0, 1, 1, 0, 2, 1],
  // ...
]);

const basis = nullspace(m); // number[][] — each vector has length 6
```

## Future

- Determinant, inverse, rank
- Eigenvalues / eigenvectors
- Sparse matrix support
- Column-oriented matrix variant for when columns are the natural objects
