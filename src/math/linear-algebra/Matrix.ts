/**
 * Matrix
 *
 * An m×n matrix backed by a Float64Array in row-major order.
 * Double precision to avoid numerical issues in row reduction.
 */

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
