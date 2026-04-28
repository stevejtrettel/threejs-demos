/**
 * ArrowGlyphs — generic instanced-cone arrows at arbitrary positions and
 * orientations.
 *
 * The visual primitive used by `FieldArrows`, freed from the "grid on a
 * surface" sampling pattern so it can be used for arrows along a curve
 * (parallel-transport demos), arrows at computed feature points, or any
 * ad-hoc list of (position, direction) pairs.
 *
 * One cone per instance. Cones are pre-translated so the BASE sits at the
 * given position and the APEX points along `direction`. Length can be
 * per-instance or uniform.
 *
 * @example
 *   const arrows = new ArrowGlyphs({ count: 200, color: 0xffaa33, length: 0.3 });
 *   scene.add(arrows);
 *   for (let i = 0; i < 200; i++) {
 *     arrows.setArrow(i, positions[i], directions[i]);
 *   }
 */

import * as THREE from 'three';

export interface ArrowGlyphsOptions {
  /** Number of arrows. Fixed at construction. */
  count: number;

  /** Uniform cone color (default `0x2266cc`). */
  color?: number;

  /** Default arrow length, used when `setArrow` is called without one. Default 1.0. */
  length?: number;

  /** Cone base radius as a fraction of length (default 0.25). */
  coneRadiusRatio?: number;

  /** Number of radial segments on the cone (default 10). */
  radialSegments?: number;
}

/**
 * A fixed-count set of instanced cone arrows. Each instance is set via
 * `setArrow(i, position, direction, [length])`.
 */
export class ArrowGlyphs extends THREE.InstancedMesh {
  private readonly defaultLength: number;

  // Scratch objects reused across `setArrow` calls to avoid allocations.
  private readonly _pos = new THREE.Vector3();
  private readonly _dir = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _scale = new THREE.Vector3();
  private readonly _mat = new THREE.Matrix4();
  private readonly _up = new THREE.Vector3(0, 1, 0);
  private readonly _zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(options: ArrowGlyphsOptions) {
    const {
      count,
      color = 0x2266cc,
      length = 1.0,
      coneRadiusRatio = 0.25,
      radialSegments = 10,
    } = options;

    // Unit cone: base at y=0, apex at y=1. Pre-translate so instance
    // transforms are (scale, rotate, translate) with the base at `position`.
    const geom = new THREE.ConeGeometry(
      coneRadiusRatio,
      1,
      radialSegments,
      1,
      false,
    );
    geom.translate(0, 0.5, 0);

    const material = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      metalness: 0.1,
      roughness: 0.7,
    });

    super(geom, material, count);
    this.defaultLength = length;
  }

  /**
   * Position and orient the i-th arrow. `direction` doesn't need to be
   * normalized — we normalize internally. If the direction magnitude is
   * near zero, the instance is hidden (zero-scale).
   *
   * `length` overrides the default arrow length for this instance.
   */
  setArrow(i: number, position: THREE.Vector3, direction: THREE.Vector3, length?: number): void {
    this._dir.copy(direction);
    const m = this._dir.length();
    if (m < 1e-10) {
      this.setMatrixAt(i, this._zeroMat);
      this.instanceMatrix.needsUpdate = true;
      return;
    }
    this._dir.divideScalar(m);

    // Orient the cone's +Y axis toward `direction`.
    this._quat.setFromUnitVectors(this._up, this._dir);

    // Scale: radius scales with length × coneRadiusRatio (baked into the cone
    // geometry via the radius param we passed). Here we just scale uniformly
    // along the cone axis (Y) by length, and along the radial axes (X, Z) by
    // length too — keeps the proportions right.
    const L = length ?? this.defaultLength;
    this._scale.set(L, L, L);

    this._pos.copy(position);
    this._mat.compose(this._pos, this._quat, this._scale);
    this.setMatrixAt(i, this._mat);
    this.instanceMatrix.needsUpdate = true;
  }

  /** Hide the i-th arrow. Equivalent to `setArrow` with zero direction. */
  hideArrow(i: number): void {
    this.setMatrixAt(i, this._zeroMat);
    this.instanceMatrix.needsUpdate = true;
  }
}
