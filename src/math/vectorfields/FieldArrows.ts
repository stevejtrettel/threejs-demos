import * as THREE from 'three';
import { Params } from '@/Params';
import type { DifferentialSurface } from '@/math/surfaces/types';
import type { VectorField } from './types';

export interface FieldArrowsOptions {
  /**
   * Grid resolution along u (default 16). One cone per sample.
   */
  uSegments?: number;

  /**
   * Grid resolution along v (default 16). One cone per sample.
   */
  vSegments?: number;

  /**
   * Magnitude → length scaling. Receives the pushed-forward (3D) magnitude,
   * returns the cone length in world units.
   *
   * If omitted, we **autoscale**: sample the grid once per rebuild, find
   * `m_max`, and use `L(m) = (m / m_max)^0.7 × maxLength`. The nonlinear
   * exponent compresses dynamic range so small vectors stay visible next to
   * large ones; the `maxLength` cap keeps arrows from overlapping the grid.
   */
  magScale?: (m: number) => number;

  /**
   * Upper bound on cone length (default: 0.5 × min grid spacing, measured
   * in parameter units). Used by the autoscale default; ignored if you
   * supply a custom `magScale`.
   */
  maxLength?: number;

  /**
   * Cone color (default 0x2266cc).
   */
  color?: number;

  /**
   * Cone base radius as a fraction of cone length (default 0.25). Lower =
   * more needle-like, higher = more triangular.
   */
  coneRadiusRatio?: number;
}

/**
 * FieldArrows — instanced cone glyphs visualizing a `VectorField` on a
 * `DifferentialSurface`.
 *
 * One cone per sample of a `uSegments × vSegments` grid over the surface's
 * domain. Each cone sits on the surface at its sample point, oriented along
 * the pushed-forward field vector, with length scaled by magnitude.
 *
 * The `DifferentialSurface` contract (via `computePartials`) is what
 * converts the parameter-space vector `[a, b]` into the 3D vector
 * `a·∂r/∂u + b·∂r/∂v`, which is what you actually see.
 *
 * Reactivity: depends on both surface and field. Any upstream param change
 * cascades here and re-samples all instance matrices. Instance count is
 * fixed at construction (uSegments × vSegments); changing it requires
 * disposing and recreating.
 *
 * @example
 *   const arrows = new FieldArrows(surface, field, {
 *     uSegments: 16, vSegments: 16, color: 0xff6600,
 *   });
 *   scene.add(arrows);
 */
export class FieldArrows extends THREE.InstancedMesh {
  readonly params = new Params(this);

  private readonly surface: DifferentialSurface;
  private readonly field: VectorField;

  private readonly uSegments: number;
  private readonly vSegments: number;
  private readonly magScale?: (m: number) => number;
  private readonly maxLength: number;

  declare color: number;

  constructor(
    surface: DifferentialSurface,
    field: VectorField,
    options: FieldArrowsOptions = {},
  ) {
    const uSegments = options.uSegments ?? 16;
    const vSegments = options.vSegments ?? 16;

    // Default maxLength from grid spacing in parameter coords. Field vectors
    // in 3D can still be larger/smaller than in parameter units depending on
    // surface curvature, but this is a sensible starting point for autoscale.
    const dom = surface.getDomain();
    const dU = (dom.uMax - dom.uMin) / uSegments;
    const dV = (dom.vMax - dom.vMin) / vSegments;
    const maxLength = options.maxLength ?? 0.5 * Math.min(dU, dV);

    // Unit cone: base at y=0, apex at y=1. We pre-translate so instance
    // transforms are a clean (scale, rotate, translate) triple with the base
    // landing at the sample point.
    const coneRadiusRatio = options.coneRadiusRatio ?? 0.25;
    const geom = new THREE.ConeGeometry(
      coneRadiusRatio,   // radius at base (y = -0.5 in default)
      1,                 // height
      8,                 // radial segments
      1,                 // height segments
      false,             // open-ended?
    );
    geom.translate(0, 0.5, 0);  // base centroid now at y=0, apex at y=1

    const material = new THREE.MeshStandardMaterial({
      color: options.color ?? 0x2266cc,
      flatShading: true,
      metalness: 0.1,
      roughness: 0.7,
    });

    const count = uSegments * vSegments;
    super(geom, material, count);

    this.surface = surface;
    this.field = field;
    this.uSegments = uSegments;
    this.vSegments = vSegments;
    this.magScale = options.magScale;
    this.maxLength = maxLength;

    this.params
      .define('color', options.color ?? 0x2266cc, { triggers: 'update' })
      .dependOn(surface, field);

    this.rebuild();
  }

  /**
   * Re-sample the grid and rewrite every instance transform.
   * Called automatically when surface or field parameters change.
   */
  rebuild(): void {
    const dom = this.surface.getDomain();
    const U = this.uSegments;
    const V = this.vSegments;

    // First pass: compute all (position, v3) pairs + magnitudes so the
    // autoscale default can normalize by the observed max.
    const positions: THREE.Vector3[] = new Array(U * V);
    const vectors: THREE.Vector3[] = new Array(U * V);
    const magnitudes = new Float32Array(U * V);
    let maxMag = 0;

    for (let j = 0; j < V; j++) {
      // Cell-center sampling so we don't sit on the boundary seams.
      const v = dom.vMin + (j + 0.5) * (dom.vMax - dom.vMin) / V;
      for (let i = 0; i < U; i++) {
        const u = dom.uMin + (i + 0.5) * (dom.uMax - dom.uMin) / U;
        const idx = j * U + i;

        const p = this.surface.evaluate(u, v);
        const { du, dv } = this.surface.computePartials(u, v);
        const [a, b] = this.field.evaluate(u, v);

        // Pushforward: v3 = a · ∂r/∂u + b · ∂r/∂v
        const v3 = new THREE.Vector3(
          a * du.x + b * dv.x,
          a * du.y + b * dv.y,
          a * du.z + b * dv.z,
        );

        const m = v3.length();
        positions[idx] = p;
        vectors[idx] = v3;
        magnitudes[idx] = m;
        if (m > maxMag) maxMag = m;
      }
    }

    // Build the length-scaling function. User-provided takes priority;
    // otherwise autoscale against the max observed magnitude.
    const scaleFn = this.magScale ?? this.buildAutoScale(maxMag);

    // Second pass: compose and write instance matrices.
    const up = new THREE.Vector3(0, 1, 0);
    const dirTmp = new THREE.Vector3();
    const quatTmp = new THREE.Quaternion();
    const scaleTmp = new THREE.Vector3();
    const matTmp = new THREE.Matrix4();
    const ZERO_MAT = new THREE.Matrix4().makeScale(0, 0, 0);

    for (let idx = 0; idx < U * V; idx++) {
      const m = magnitudes[idx];

      // Degenerate vector → zero-scale the instance (invisible).
      if (m < 1e-10) {
        this.setMatrixAt(idx, ZERO_MAT);
        continue;
      }

      const L = scaleFn(m);
      if (L < 1e-10) {
        this.setMatrixAt(idx, ZERO_MAT);
        continue;
      }

      // Orient: +Y → normalized v3.
      dirTmp.copy(vectors[idx]).divideScalar(m);
      quatTmp.setFromUnitVectors(up, dirTmp);

      // Uniform scale L: the geometry already encodes coneRadiusRatio in its
      // base radius, so world base radius = L × coneRadiusRatio automatically.
      scaleTmp.set(L, L, L);

      matTmp.compose(positions[idx], quatTmp, scaleTmp);
      this.setMatrixAt(idx, matTmp);
    }

    this.instanceMatrix.needsUpdate = true;
  }

  update(): void {
    const mat = this.material as THREE.MeshStandardMaterial;
    mat.color.set(this.color);
    mat.needsUpdate = true;
  }

  private buildAutoScale(maxMag: number): (m: number) => number {
    if (maxMag < 1e-10) return () => 0;
    const L_max = this.maxLength;
    const alpha = 0.7;
    return (m: number) => Math.pow(m / maxMag, alpha) * L_max;
  }

  dispose(): this {
    super.dispose();
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
    this.params.dispose();
    return this;
  }
}
