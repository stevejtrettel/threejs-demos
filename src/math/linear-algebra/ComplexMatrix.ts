/**
 * `ComplexMatrix` — m×n matrix with complex entries.
 *
 * Storage parallel to `Matrix`: a single `Float64Array`, but of length
 * `2 * rows * cols` (real and imaginary parts interleaved). Layout:
 *
 *   `data[2 * (i * cols + j)]      = Re M[i][j]`
 *   `data[2 * (i * cols + j) + 1]  = Im M[i][j]`
 *
 * Cache-friendly for matrix-vector and matrix-matrix products. Methods
 * mirror `Matrix` — same idioms, just with complex arithmetic inside.
 *
 * Closed-form `det` and `invert` for `n = 2` (the dim that the Lie
 * library actually needs). General-`n` LU-style operations are
 * deferred until a demo asks for them.
 */

import type { Complex } from '@/math/algebra';
import { cmul, csub, cdiv } from '@/math/algebra';

export class ComplexMatrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float64Array;

  constructor(rows: number, cols: number, data?: Float64Array) {
    this.rows = rows;
    this.cols = cols;
    this.data = data ?? new Float64Array(2 * rows * cols);
  }

  // ── Construction ─────────────────────────────────────────────

  static fromEntries(entries: Complex[][]): ComplexMatrix {
    const m = entries.length;
    const n = entries[0].length;
    const out = new ComplexMatrix(m, n);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const k = 2 * (i * n + j);
        out.data[k]     = entries[i][j][0];
        out.data[k + 1] = entries[i][j][1];
      }
    }
    return out;
  }

  static zeros(rows: number, cols: number): ComplexMatrix {
    return new ComplexMatrix(rows, cols);
  }

  static identity(n: number): ComplexMatrix {
    const m = new ComplexMatrix(n, n);
    for (let i = 0; i < n; i++) {
      m.data[2 * (i * n + i)] = 1;   // 1 + 0·i on the diagonal
    }
    return m;
  }

  // ── Element access ───────────────────────────────────────────

  get(i: number, j: number): Complex {
    const k = 2 * (i * this.cols + j);
    return [this.data[k], this.data[k + 1]];
  }

  set(i: number, j: number, z: Complex): void {
    const k = 2 * (i * this.cols + j);
    this.data[k]     = z[0];
    this.data[k + 1] = z[1];
  }

  // ── Arithmetic (return new matrices) ─────────────────────────

  add(other: ComplexMatrix): ComplexMatrix {
    const out = new ComplexMatrix(this.rows, this.cols);
    for (let k = 0; k < this.data.length; k++) {
      out.data[k] = this.data[k] + other.data[k];
    }
    return out;
  }

  subtract(other: ComplexMatrix): ComplexMatrix {
    const out = new ComplexMatrix(this.rows, this.cols);
    for (let k = 0; k < this.data.length; k++) {
      out.data[k] = this.data[k] - other.data[k];
    }
    return out;
  }

  /** Scale by a real number. */
  scale(s: number): ComplexMatrix {
    const out = new ComplexMatrix(this.rows, this.cols);
    for (let k = 0; k < this.data.length; k++) {
      out.data[k] = this.data[k] * s;
    }
    return out;
  }

  /** Scale by a complex number. */
  scaleC(s: Complex): ComplexMatrix {
    const sr = s[0], si = s[1];
    const out = new ComplexMatrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const k = 2 * (i * this.cols + j);
        const ar = this.data[k], ai = this.data[k + 1];
        out.data[k]     = ar * sr - ai * si;
        out.data[k + 1] = ar * si + ai * sr;
      }
    }
    return out;
  }

  /** Matrix-matrix product `A · B`. */
  multiply(other: ComplexMatrix): ComplexMatrix {
    if (this.cols !== other.rows) {
      throw new Error(
        `multiply: shape mismatch ${this.rows}×${this.cols} · ${other.rows}×${other.cols}`,
      );
    }
    const out = new ComplexMatrix(this.rows, other.cols);
    const inner = this.cols;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sumR = 0, sumI = 0;
        for (let k = 0; k < inner; k++) {
          const aIdx = 2 * (i * inner + k);
          const bIdx = 2 * (k * other.cols + j);
          const aR = this.data[aIdx],  aI = this.data[aIdx + 1];
          const bR = other.data[bIdx], bI = other.data[bIdx + 1];
          sumR += aR * bR - aI * bI;
          sumI += aR * bI + aI * bR;
        }
        const oIdx = 2 * (i * other.cols + j);
        out.data[oIdx]     = sumR;
        out.data[oIdx + 1] = sumI;
      }
    }
    return out;
  }

  /** Matrix-vector product `A · v` where `v` is a length-`cols` complex vector. */
  mulVec(v: Complex[]): Complex[] {
    if (v.length !== this.cols) {
      throw new Error(`mulVec: vector length ${v.length} ≠ matrix cols ${this.cols}`);
    }
    const out: Complex[] = new Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      let sumR = 0, sumI = 0;
      for (let j = 0; j < this.cols; j++) {
        const k = 2 * (i * this.cols + j);
        const aR = this.data[k], aI = this.data[k + 1];
        const vR = v[j][0], vI = v[j][1];
        sumR += aR * vR - aI * vI;
        sumI += aR * vI + aI * vR;
      }
      out[i] = [sumR, sumI];
    }
    return out;
  }

  /** `Mᵀ` (transpose, *no* conjugation). */
  transpose(): ComplexMatrix {
    const out = new ComplexMatrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const src = 2 * (i * this.cols + j);
        const dst = 2 * (j * this.rows + i);
        out.data[dst]     = this.data[src];
        out.data[dst + 1] = this.data[src + 1];
      }
    }
    return out;
  }

  /** Entry-wise complex conjugate (no transpose). */
  conjugate(): ComplexMatrix {
    const out = new ComplexMatrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const k = 2 * (i * this.cols + j);
        out.data[k]     =  this.data[k];
        out.data[k + 1] = -this.data[k + 1];
      }
    }
    return out;
  }

  /** Hermitian conjugate `M† = (M̄)ᵀ` (conjugate-transpose). */
  dagger(): ComplexMatrix {
    const out = new ComplexMatrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const src = 2 * (i * this.cols + j);
        const dst = 2 * (j * this.rows + i);
        out.data[dst]     =  this.data[src];
        out.data[dst + 1] = -this.data[src + 1];
      }
    }
    return out;
  }

  clone(): ComplexMatrix {
    return new ComplexMatrix(this.rows, this.cols, new Float64Array(this.data));
  }

  // ── Determinant + inverse (closed form for n = 2) ───────────

  /** Determinant. Closed-form 2×2 only; throws otherwise. */
  det(): Complex {
    if (this.rows !== this.cols) {
      throw new Error(`det: expected square matrix, got ${this.rows}×${this.cols}`);
    }
    if (this.rows === 1) return this.get(0, 0);
    if (this.rows === 2) {
      const a = this.get(0, 0), b = this.get(0, 1);
      const c = this.get(1, 0), d = this.get(1, 1);
      return csub(cmul(a, d), cmul(b, c));
    }
    throw new Error(`det: not implemented for n > 2 (need a complex LU)`);
  }

  /** Inverse. Closed-form 2×2 only; throws otherwise. */
  invert(): ComplexMatrix {
    if (this.rows !== this.cols) {
      throw new Error(`invert: expected square matrix, got ${this.rows}×${this.cols}`);
    }
    if (this.rows === 2) {
      const a = this.get(0, 0), b = this.get(0, 1);
      const c = this.get(1, 0), d = this.get(1, 1);
      const detM = csub(cmul(a, d), cmul(b, c));
      const out = new ComplexMatrix(2, 2);
      // out = (1/det) · [[d, −b], [−c, a]]
      const oneOverDet = cdiv([1, 0], detM);
      const setEntry = (i: number, j: number, z: Complex) => {
        const k = 2 * (i * 2 + j);
        out.data[k]     = z[0];
        out.data[k + 1] = z[1];
      };
      setEntry(0, 0, cmul(oneOverDet, d));
      setEntry(0, 1, cmul(oneOverDet, [-b[0], -b[1]]));
      setEntry(1, 0, cmul(oneOverDet, [-c[0], -c[1]]));
      setEntry(1, 1, cmul(oneOverDet, a));
      return out;
    }
    throw new Error(`invert: not implemented for n > 2 (need a complex LU)`);
  }

  /** Trace = sum of diagonal entries. */
  trace(): Complex {
    if (this.rows !== this.cols) {
      throw new Error(`trace: expected square matrix, got ${this.rows}×${this.cols}`);
    }
    let r = 0, im = 0;
    for (let i = 0; i < this.rows; i++) {
      const k = 2 * (i * this.cols + i);
      r += this.data[k];
      im += this.data[k + 1];
    }
    return [r, im];
  }
}

