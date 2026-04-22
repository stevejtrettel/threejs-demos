/**
 * Linkage — a graph of joints connected by rigid rods.
 *
 * Stores joint positions as a flat Float32Array with stride = dim.
 * Rod-length constraints c_e(p) = |p_a − p_b|² − L_e² are implicit;
 * residuals and the sparse Jacobian are exposed for inspection and
 * for the constraint-solving tools that come in later passes.
 */

import { Params } from '@/Params';
import type { Parametric, Rebuildable } from '@/types';
import type { Joint, JointId, Rod } from './types';

export interface LinkageOptions {
  joints: Joint[];
  rods: Rod[];
  /** Ambient dimension: 2 for planar, 3 for spatial. Default 2. */
  dim?: 2 | 3;
  /** Initial positions. If omitted, pinned joints land at their pin and free joints at the origin. */
  positions?: Float32Array;
}

/**
 * A single nonzero entry in the constraint Jacobian ∂c/∂p.
 * Row = rod index, col = flat position-coordinate index (joint*dim + axis).
 */
export interface JacobianEntry {
  row: number;
  col: number;
  value: number;
}

export class Linkage implements Parametric, Rebuildable {
  readonly params = new Params(this);

  declare joints: Joint[];
  declare rods: Rod[];
  declare positions: Float32Array;
  readonly dim: 2 | 3;

  constructor(options: LinkageOptions) {
    this.dim = options.dim ?? 2;

    this.params
      .define('joints', options.joints, { triggers: 'rebuild' })
      .define('rods', options.rods, { triggers: 'rebuild' })
      .define(
        'positions',
        options.positions ?? this._seedPositions(options.joints),
        { triggers: 'update' }
      );
  }

  rebuild(): void {
    // Re-seed from pins whenever joints change — joint pin positions may have moved.
    // Free joints reset to origin; callers are expected to re-pose (e.g. via
    // setChainAngles) on the next frame.
    this.positions = this._seedPositions(this.joints);
  }

  /**
   * Replace the positions array and notify dependents.
   * Pass a new Float32Array (not a mutated reference) so reactivity fires.
   */
  setPositions(positions: Float32Array): void {
    this.params.set('positions', positions);
  }

  /**
   * Get joint position as a tuple. Returns a fresh array each call.
   */
  getJointPosition(id: JointId): number[] {
    const out: number[] = new Array(this.dim);
    const base = id * this.dim;
    for (let i = 0; i < this.dim; i++) out[i] = this.positions[base + i];
    return out;
  }

  /**
   * Constraint residuals c_e(p) = |p_a − p_b|² − L_e². One entry per rod.
   * Equals zero iff positions satisfy all rod-length constraints.
   */
  constraintResiduals(p: Float32Array = this.positions): number[] {
    const out: number[] = new Array(this.rods.length);
    const d = this.dim;
    for (let e = 0; e < this.rods.length; e++) {
      const rod = this.rods[e];
      let sq = 0;
      for (let k = 0; k < d; k++) {
        const diff = p[rod.a * d + k] - p[rod.b * d + k];
        sq += diff * diff;
      }
      out[e] = sq - rod.length * rod.length;
    }
    return out;
  }

  /**
   * Sparse constraint Jacobian in triplet form.
   * For rod e = (a, b): ∂c_e/∂p_a = +2(p_a − p_b), ∂c_e/∂p_b = −2(p_a − p_b).
   * All other entries are zero. Pinned joints still get entries — callers that
   * want the reduced Jacobian on free coords can filter columns by joint index.
   */
  constraintJacobian(p: Float32Array = this.positions): JacobianEntry[] {
    const entries: JacobianEntry[] = [];
    const d = this.dim;
    for (let e = 0; e < this.rods.length; e++) {
      const rod = this.rods[e];
      for (let k = 0; k < d; k++) {
        const diff = p[rod.a * d + k] - p[rod.b * d + k];
        const v = 2 * diff;
        entries.push({ row: e, col: rod.a * d + k, value: v });
        entries.push({ row: e, col: rod.b * d + k, value: -v });
      }
    }
    return entries;
  }

  /**
   * Ids of joints with a pin constraint.
   */
  pinnedJoints(): Set<JointId> {
    const out = new Set<JointId>();
    for (const j of this.joints) if (j.pinned) out.add(j.id);
    return out;
  }

  dispose(): void {
    this.params.dispose();
  }

  private _seedPositions(joints: Joint[]): Float32Array {
    const d = this.dim;
    const out = new Float32Array(joints.length * d);
    for (const j of joints) {
      if (!j.pinned) continue;
      const base = j.id * d;
      for (let k = 0; k < d; k++) out[base + k] = j.pinned[k] ?? 0;
    }
    return out;
  }
}
