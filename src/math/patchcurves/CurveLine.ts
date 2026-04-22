import * as THREE from 'three';
import { Params } from '@/Params';
import type { Surface } from '@/math/surfaces/types';
import type { PatchCurve } from './types';

export interface CurveLineOptions {
  color?: number;
  lineWidth?: number;
}

/**
 * CurveLine — render a `PatchCurve` on a `Surface` as a `THREE.Line`.
 *
 * Works with any producer (`FlowCurve`, a future `GeodesicCurve`, a
 * user-supplied object implementing `PatchCurve`). Multiple `CurveLine`s
 * can share the same `PatchCurve` — each renders the same parameter-space
 * trajectory through its own surface.
 *
 * Topological cascade guarantees the curve is fresh by the time this
 * rebuilds.
 *
 * @example
 *   const curve = new FlowCurve(field, { initialPosition, steps });
 *   scene.add(new CurveLine(graphSurface, curve, { color: 0xff5500 }));
 *   scene.add(new CurveLine(flatPatch,    curve, { color: 0xff5500 }));
 */
export class CurveLine extends THREE.Line {
  readonly params = new Params(this);

  private surface: Surface;
  private curve: PatchCurve;

  declare color: number;
  declare lineWidth: number;

  constructor(surface: Surface, curve: PatchCurve, options: CurveLineOptions = {}) {
    super();

    this.surface = surface;
    this.curve = curve;

    this.params
      .define('color', options.color ?? 0x00aaff, { triggers: 'update' })
      .define('lineWidth', options.lineWidth ?? 1, { triggers: 'update' })
      .dependOn(surface, curve);

    this.material = new THREE.LineBasicMaterial();
    this.geometry = new THREE.BufferGeometry();

    this.update();
    this.rebuild();
  }

  rebuild(): void {
    const pts = this.curve.getPoints();
    const n = pts.length;

    let attr = this.geometry.getAttribute('position') as
      | THREE.BufferAttribute
      | undefined;
    let buffer: Float32Array;

    if (attr && attr.array.length === n * 3) {
      buffer = attr.array as Float32Array;
    } else {
      buffer = new Float32Array(n * 3);
      attr = new THREE.BufferAttribute(buffer, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('position', attr);
    }

    for (let i = 0; i < n; i++) {
      const [u, v] = pts[i];
      const p = this.surface.evaluate(u, v);
      const idx = i * 3;
      buffer[idx] = p.x;
      buffer[idx + 1] = p.y;
      buffer[idx + 2] = p.z;
    }

    attr.needsUpdate = true;
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
