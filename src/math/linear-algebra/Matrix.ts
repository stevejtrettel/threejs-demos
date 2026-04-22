/**
 * Matrix
 *
 * An m×n matrix backed by a Float64Array in row-major order.
 * Double precision to avoid numerical issues in row reduction.
 */

import { luDecompose, luSolve } from './lu';
import { choleskyDecompose } from './cholesky';
import { eigensym as eigensymImpl } from './eigensym';
import type { EigensymResult } from './eigensym';

export class Matrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float64Array;

  constructor(rows: number, cols: number, data?: Float64Array) {
    this.rows = rows;
    this.cols = cols;
    this.data = data ?? new Float64Array(rows * cols);
  }

  // ── Construction ─────────────────────────────────────────────

  static fromRows(rows: number[][]): Matrix {
    const m = rows.length;
    const n = rows[0].length;
    const data = new Float64Array(m * n);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        data[i * n + j] = rows[i][j];
      }
    }
    return new Matrix(m, n, data);
  }

  static zeros(rows: number, cols: number): Matrix {
    return new Matrix(rows, cols);
  }

  static identity(n: number): Matrix {
    const m = new Matrix(n, n);
    for (let i = 0; i < n; i++) {
      m.data[i * n + i] = 1;
    }
    return m;
  }

  // ── Element access ───────────────────────────────────────────

  get(i: number, j: number): number {
    return this.data[i * this.cols + j];
  }

  set(i: number, j: number, value: number): void {
    this.data[i * this.cols + j] = value;
  }

  getRow(i: number): number[] {
    const out: number[] = new Array(this.cols);
    const offset = i * this.cols;
    for (let j = 0; j < this.cols; j++) {
      out[j] = this.data[offset + j];
    }
    return out;
  }

  getCol(j: number): number[] {
    const out: number[] = new Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      out[i] = this.data[i * this.cols + j];
    }
    return out;
  }

  /** Convert to a nested `number[][]` (row-major). Fresh arrays, no aliasing. */
  toArrays(): number[][] {
    const out: number[][] = new Array(this.rows);
    for (let i = 0; i < this.rows; i++) out[i] = this.getRow(i);
    return out;
  }

  // ── Arithmetic (return new matrices) ─────────────────────────

  add(other: Matrix): Matrix {
    const out = new Matrix(this.rows, this.cols);
    for (let k = 0; k < this.data.length; k++) {
      out.data[k] = this.data[k] + other.data[k];
    }
    return out;
  }

  scale(s: number): Matrix {
    const out = new Matrix(this.rows, this.cols);
    for (let k = 0; k < this.data.length; k++) {
      out.data[k] = this.data[k] * s;
    }
    return out;
  }

  multiply(other: Matrix): Matrix {
    const out = new Matrix(this.rows, other.cols);
    const n = this.cols;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += this.data[i * n + k] * other.data[k * other.cols + j];
        }
        out.data[i * other.cols + j] = sum;
      }
    }
    return out;
  }

  transpose(): Matrix {
    const out = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        out.data[j * this.rows + i] = this.data[i * this.cols + j];
      }
    }
    return out;
  }

  clone(): Matrix {
    return new Matrix(this.rows, this.cols, new Float64Array(this.data));
  }

  // ── Row operations (mutate in place) ─────────────────────────

  swapRows(i: number, j: number): void {
    if (i === j) return;
    const a = i * this.cols;
    const b = j * this.cols;
    for (let k = 0; k < this.cols; k++) {
      const tmp = this.data[a + k];
      this.data[a + k] = this.data[b + k];
      this.data[b + k] = tmp;
    }
  }

  scaleRow(i: number, s: number): void {
    const offset = i * this.cols;
    for (let k = 0; k < this.cols; k++) {
      this.data[offset + k] *= s;
    }
  }

  addScaledRow(target: number, source: number, s: number): void {
    const t = target * this.cols;
    const src = source * this.cols;
    for (let k = 0; k < this.cols; k++) {
      this.data[t + k] += s * this.data[src + k];
    }
  }

  // ── Higher-level operations (decompositions live in sibling files) ──
  //
  // Algorithms are implemented in `./lu`, `./cholesky`, `./eigensym` and
  // invoked lazily from method bodies below. The imports are live
  // references — only the method calls trigger them at runtime, so the
  // circular dependency with those files resolves safely.

  /** Matrix-vector product `A·v`. */
  mulVec(v: number[]): number[] {
    if (v.length !== this.cols) {
      throw new Error(`mulVec: vector length ${v.length} ≠ matrix cols ${this.cols}`);
    }
    const out = new Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      let sum = 0;
      const offset = i * this.cols;
      for (let j = 0; j < this.cols; j++) sum += this.data[offset + j] * v[j];
      out[i] = sum;
    }
    return out;
  }

  /** Row-vector times matrix `vᵀ·A`. */
  vecMul(v: number[]): number[] {
    if (v.length !== this.rows) {
      throw new Error(`vecMul: vector length ${v.length} ≠ matrix rows ${this.rows}`);
    }
    const out = new Array(this.cols).fill(0);
    for (let i = 0; i < this.rows; i++) {
      const vi = v[i];
      const offset = i * this.cols;
      for (let j = 0; j < this.cols; j++) out[j] += vi * this.data[offset + j];
    }
    return out;
  }

  /** Determinant (LU-based). Throws if non-square. */
  det(): number {
    if (this.rows !== this.cols) {
      throw new Error(`det: expected square matrix, got ${this.rows}×${this.cols}`);
    }
    if (this.rows === 2) {
      return this.data[0] * this.data[3] - this.data[1] * this.data[2];
    }
    try {
      const { LU, parity } = luDecompose(this);
      let d = parity as number;
      for (let i = 0; i < this.rows; i++) d *= LU.get(i, i);
      return d;
    } catch {
      // Singular matrix — determinant is zero.
      return 0;
    }
  }

  /** Inverse via LU-based solves against identity columns. Throws if singular. */
  invert(): Matrix {
    if (this.rows !== this.cols) {
      throw new Error(`invert: expected square matrix, got ${this.rows}×${this.cols}`);
    }
    const n = this.rows;

    // 2×2 fast path — closed-form inverse avoids LU factorization overhead.
    // Matters because metric tensors on 2D surfaces hit this in hot loops.
    if (n === 2) {
      const a = this.data[0], b = this.data[1], c = this.data[2], d = this.data[3];
      const D = a * d - b * c;
      if (D === 0) throw new Error('invert: singular 2×2 matrix');
      const inv = 1 / D;
      const out = new Matrix(2, 2);
      out.data[0] =  d * inv;
      out.data[1] = -b * inv;
      out.data[2] = -c * inv;
      out.data[3] =  a * inv;
      return out;
    }

    const lu = luDecompose(this);
    const out = new Matrix(n, n);
    const e = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      if (j > 0) e[j - 1] = 0;
      e[j] = 1;
      const col = luSolve(lu, e);
      for (let i = 0; i < n; i++) out.set(i, j, col[i]);
    }
    return out;
  }

  /** Solve `A·x = b`. Throws if `A` is singular or non-square. */
  solve(b: number[]): number[] {
    if (this.rows !== this.cols) {
      throw new Error(`solve: expected square matrix, got ${this.rows}×${this.cols}`);
    }
    if (b.length !== this.rows) {
      throw new Error(`solve: b length ${b.length} ≠ matrix rows ${this.rows}`);
    }
    return luSolve(luDecompose(this), b);
  }

  /** Cholesky factorization. Throws if the matrix is not SPD. */
  cholesky(): Matrix {
    return choleskyDecompose(this);
  }

  /** Symmetric eigendecomposition via Jacobi. Values sorted descending. */
  eigensym(): EigensymResult {
    return eigensymImpl(this);
  }

  // ── Display ──────────────────────────────────────────────────

  toString(): string {
    const rows: string[] = [];
    for (let i = 0; i < this.rows; i++) {
      const entries = this.getRow(i).map((v) =>
        Math.abs(v) < 1e-10 ? '0' : v.toPrecision(4)
      );
      rows.push('[ ' + entries.join('  ') + ' ]');
    }
    return rows.join('\n');
  }
}
