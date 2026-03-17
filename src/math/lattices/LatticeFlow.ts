/**
 * LatticeFlow — paths in the space of 2D lattices
 *
 * Two construction modes:
 *
 * 1. Closed geodesic from a hyperbolic M ∈ SL(2,ℤ):
 *      LatticeFlow.fromMatrix([[2,1],[1,1]])
 *    The flow is A_t = P·diag(e^t, e^{-t})·P⁻¹ applied to ℤ².
 *    Period T = log(λ) where λ is the dominant eigenvalue.
 *
 * 2. Open geodesic from an initial lattice:
 *      LatticeFlow.fromLattice(lattice)
 *    Standard diagonal flow diag(e^t, e^{-t}) in the x/y axes.
 *    Not periodic in general.
 */

import { type Complex } from '../algebra/complex';
import { Lattice2D } from './Lattice2D';

// ── Types ────────────────────────────────────────────

export type Mat2 = [[number, number], [number, number]];

interface Eigenbasis {
  e1: [number, number];
  e2: [number, number];
  invP: [[number, number], [number, number]];
}

// ── Class ────────────────────────────────────────────

export class LatticeFlow {
  /** Flow period (only defined for closed orbits) */
  readonly period: number | undefined;

  /** Whether the flow is a closed geodesic */
  readonly isClosed: boolean;

  /** The initial lattice at t = 0 */
  readonly initialLattice: Lattice2D;

  /** The SL(2,ℤ) matrix (only for closed orbits) */
  readonly matrix: Mat2 | undefined;

  /** Dominant eigenvalue (only for closed orbits) */
  readonly lambda: number | undefined;

  // Eigenbasis for closed flows (undefined for open flows)
  private readonly _eigenbasis: Eigenbasis | undefined;

  // Checkpoint system: avoids e^t overflow by periodically re-seating
  // the flow on a reduced basis. Each checkpoint stores (absoluteTime, lattice).
  // To evaluate at(t), we find the nearest checkpoint and flow a short Δt from it.
  private _checkpoints: Array<{ t: number; w1: Complex; w2: Complex }>;
  private readonly _checkpointInterval: number;

  private constructor(opts: {
    w1: Complex;
    w2: Complex;
    period?: number;
    matrix?: Mat2;
    lambda?: number;
    eigenbasis?: Eigenbasis;
  }) {
    this._checkpoints = [{ t: 0, w1: opts.w1, w2: opts.w2 }];
    this._checkpointInterval = opts.period ?? 5; // re-seat every 5 time units (or every period)
    this.period = opts.period;
    this.isClosed = opts.period !== undefined;
    this.matrix = opts.matrix;
    this.lambda = opts.lambda;
    this._eigenbasis = opts.eigenbasis;
    this.initialLattice = new Lattice2D(opts.w1, opts.w2).reduce();
  }

  // ── Construction ─────────────────────────────────

  /**
   * Closed geodesic from a hyperbolic M ∈ SL(2,ℤ).
   *
   * The flow acts on the standard lattice ℤ² via
   * A_t = P·diag(e^t, e^{-t})·P⁻¹ where P is the eigenvector matrix.
   * At time T = log(λ), A_T = M, so the lattice returns to itself.
   */
  static fromMatrix(M: Mat2): LatticeFlow {
    const [[a, b], [c, d]] = M;

    const det = a * d - b * c;
    if (Math.abs(det - 1) > 1e-10) {
      throw new Error(`det(M) = ${det}, need 1 for SL(2,ℤ)`);
    }

    const tr = a + d;
    if (Math.abs(tr) <= 2) {
      throw new Error(`|tr(M)| = ${Math.abs(tr)} ≤ 2, need hyperbolic (|tr| > 2)`);
    }

    // Eigenvalues: λ² − tr·λ + 1 = 0
    const disc = Math.sqrt(tr * tr - 4);
    const lam = (tr + disc) / 2;
    const period = Math.log(Math.abs(lam));

    // Eigenvectors define the flow directions.
    const lam2 = (tr - disc) / 2;
    let e1: [number, number], e2: [number, number];
    if (Math.abs(b) > Math.abs(c)) {
      e1 = [b, lam - a];
      e2 = [b, lam2 - a];
    } else {
      e1 = [lam - d, c];
      e2 = [lam2 - d, c];
    }

    // P⁻¹ for decomposing vectors into the eigenbasis
    const detP = e1[0] * e2[1] - e1[1] * e2[0];
    const invP: [[number, number], [number, number]] = [
      [e2[1] / detP, -e2[0] / detP],
      [-e1[1] / detP, e1[0] / detP],
    ];

    return new LatticeFlow({
      w1: [1, 0],
      w2: [0, 1],
      period,
      matrix: M,
      lambda: lam,
      eigenbasis: { e1, e2, invP },
    });
  }

  /**
   * Open geodesic from an initial lattice.
   *
   * Applies the standard diagonal flow diag(e^t, e^{-t}) to
   * the lattice basis vectors in the x/y coordinate axes.
   */
  static fromLattice(lattice: Lattice2D): LatticeFlow {
    return new LatticeFlow({
      w1: lattice.omega1,
      w2: lattice.omega2,
    });
  }

  // ── Internal: flow a single vector by Δt ───────

  private _flowVector(vx: number, vy: number, dt: number): [number, number] {
    if (this._eigenbasis) {
      // Closed flow: decompose into eigenbasis, scale, recompose
      const { e1, e2, invP } = this._eigenbasis;
      const alpha = invP[0][0] * vx + invP[0][1] * vy;
      const beta = invP[1][0] * vx + invP[1][1] * vy;
      const s = Math.exp(dt);
      const si = Math.exp(-dt);
      return [
        alpha * s * e1[0] + beta * si * e2[0],
        alpha * s * e1[1] + beta * si * e2[1],
      ];
    }
    // Open flow: standard diagonal
    return [vx * Math.exp(dt), vy * Math.exp(-dt)];
  }

  // ── Evaluation ───────────────────────────────────

  /**
   * The lattice at time t.
   *
   * For closed flows, uses t mod period (always bounded).
   * For open flows, uses internal checkpoints to keep Δt small,
   * avoiding e^t overflow.
   */
  at(t: number): Lattice2D {
    // Closed flows: t mod period keeps numbers bounded
    if (this.isClosed && this.period !== undefined) {
      const tMod = ((t % this.period) + this.period) % this.period;
      const cp = this._checkpoints[0];
      return new Lattice2D(
        this._flowVector(cp.w1[0], cp.w1[1], tMod),
        this._flowVector(cp.w2[0], cp.w2[1], tMod),
      ).reduce();
    }

    // Open flows: find or build checkpoint, flow short Δt from it
    const cp = this._getCheckpoint(t);
    const dt = t - cp.t;
    return new Lattice2D(
      this._flowVector(cp.w1[0], cp.w1[1], dt),
      this._flowVector(cp.w2[0], cp.w2[1], dt),
    ).reduce();
  }

  /**
   * Find the best checkpoint for time t, creating new ones as needed.
   * Checkpoints are kept sorted by time. We flow forward from the
   * latest checkpoint before t, creating intermediate checkpoints
   * at each interval.
   */
  private _getCheckpoint(t: number): { t: number; w1: Complex; w2: Complex } {
    const cps = this._checkpoints;
    const interval = this._checkpointInterval;

    // Find the latest checkpoint at or before t
    let best = cps[0];
    for (const cp of cps) {
      if (cp.t <= t && cp.t >= best.t) best = cp;
    }

    // Build checkpoints forward until we're within one interval of t
    while (best.t + interval < t) {
      const nextT = best.t + interval;
      const lat = new Lattice2D(
        this._flowVector(best.w1[0], best.w1[1], interval),
        this._flowVector(best.w2[0], best.w2[1], interval),
      ).reduce();
      const newCp = { t: nextT, w1: lat.omega1, w2: lat.omega2 };
      cps.push(newCp);
      best = newCp;
    }

    return best;
  }

  /**
   * Sample the flow at N equally-spaced times over one period (closed)
   * or over a given time range (open).
   */
  sample(n: number, tMax?: number): Lattice2D[] {
    const T = tMax ?? this.period ?? 1;
    const lattices: Lattice2D[] = [];
    for (let i = 0; i < n; i++) {
      lattices.push(this.at((i / n) * T));
    }
    return lattices;
  }
}
