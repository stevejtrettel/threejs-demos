import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric, Rebuildable, Updatable } from '@/types';
import type { Curve } from './types';

export interface CurveLineOptions {
  curve: Curve;
  segments?: number;
  color?: THREE.ColorRepresentation;
  lineWidth?: number;
}

/**
 * CurveLine — render any `Curve` (3D) as a `THREE.Line`.
 *
 * Counterpart to [`CurveTube`](./CurveTube.ts): same kind of input (a
 * reactive 3D curve, e.g. `NumericalCurve` or `CurveOnSurface.curve`),
 * but rendered as a thin line instead of a tube. Use when you want the
 * lightweight visual and don't need volumetric geometry.
 *
 * Rebuilds automatically when the curve's parameters change (via
 * `dependOn(curve)`).
 */
export class CurveLine extends THREE.Line implements Parametric, Rebuildable, Updatable {
  readonly params = new Params(this);

  private theCurve: Curve;

  declare segments: number;
  declare color: THREE.ColorRepresentation;
  declare lineWidth: number;

  constructor(options: CurveLineOptions) {
    super();

    this.theCurve = options.curve;

    this.material = new THREE.LineBasicMaterial();
    this.geometry = new THREE.BufferGeometry();

    this.params
      .define('segments', options.segments ?? 256, { triggers: 'rebuild' })
      .define('color', options.color ?? 0xffffff, { triggers: 'update' })
      .define('lineWidth', options.lineWidth ?? 1, { triggers: 'update' })
      .dependOn(options.curve);

    this.update();
    this.rebuild();
  }

  rebuild(): void {
    const n = Math.max(2, this.segments);

    // Pull sample points from the curve. CatmullRomCurve3 (which
    // NumericalCurve extends) offers `getPoints(n)` which returns `n + 1`
    // points; our `Curve` interface only guarantees `evaluate(t)`, so
    // call that in a loop to stay generic.
    const domain = this.theCurve.getDomain();
    const t0 = domain.tMin;
    const span = domain.tMax - domain.tMin;

    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + (i / (n - 1)) * span;
      const p = this.theCurve.evaluate(t);
      const idx = i * 3;
      positions[idx] = p.x;
      positions[idx + 1] = p.y;
      positions[idx + 2] = p.z;
    }

    const attr = new THREE.BufferAttribute(positions, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', attr);
    this.geometry.setDrawRange(0, n);
    this.geometry.computeBoundingSphere();
  }

  update(): void {
    const mat = this.material as THREE.LineBasicMaterial;
    mat.color.set(this.color);
    mat.linewidth = this.lineWidth;
    mat.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
    this.params.dispose();
  }
}
