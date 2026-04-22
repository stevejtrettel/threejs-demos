/**
 * Linkage types
 *
 * A linkage is a graph: joints (nodes) connected by rigid rods (edges).
 * Joints may be pinned to a fixed position in space; unpinned joints are free.
 * Rods have a fixed rest length that acts as a constraint.
 *
 * Configurations are stored as joint positions (not angles) — the generic
 * coordinate that works for any graph topology. Angles are a convenient
 * over-parameterization for chain-shaped linkages and live in helpers
 * like PlanarChain.
 */

export type JointId = number;

export interface Joint {
  id: JointId;
  /** If set, this joint's position is fixed at this point. Length must match the linkage's dim. */
  pinned?: readonly number[];
}

export interface Rod {
  a: JointId;
  b: JointId;
  /** Rest length — the rod-length constraint for the configuration space is |p_a − p_b|² = length². */
  length: number;
}
