import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { Surface } from '@/math/surfaces/types';
import { NumericalCurve } from '@/math/curves/NumericalCurve';
import type { PatchCurve } from './types';

export interface CurveOnSurfaceOptions {
  closed?: boolean;
  curveType?: 'centripetal' | 'chordal' | 'catmullrom';
  tension?: number;
}

/**
 * CurveOnSurface — adapter that maps a `PatchCurve` through a `Surface`
 * and exposes a reactive 3D `NumericalCurve` consumable by any existing
 * curve renderer (`CurveTube`, `CurveLine`, etc.).
 *
 * Composes a `NumericalCurve` internally; users pass `.curve` to their
 * renderer of choice:
 *
 * ```ts
 * const lifted = new CurveOnSurface(patchCurve, surface);
 * scene.add(new CurveTube({ curve: lifted.curve, radius: 0.1 }));
 * ```
 *
 * The internal-composition (not inheritance) design has a reason:
 * renderers depend on `lifted` (which re-maps on pc/surface change);
 * the inner `NumericalCurve`'s own cascade from `updatePoints` stays
 * off the hot path. Renderers rebuild exactly once per upstream change,
 * not twice.
 */
export class CurveOnSurface implements Parametric {
  readonly params = new Params(this);

  /**
   * The reactive 3D curve. Pass this to `CurveTube`, `CurveLine`, etc.
   */
  readonly curve: NumericalCurve;

  private readonly patchCurve: PatchCurve;
  private readonly surface: Surface;

  constructor(
    patchCurve: PatchCurve,
    surface: Surface,
    options: CurveOnSurfaceOptions = {},
  ) {
    this.patchCurve = patchCurve;
    this.surface = surface;

    const initial = this.computeVec3s() ?? [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1e-6),
    ];

    this.curve = new NumericalCurve({
      points: initial,
      closed: options.closed ?? false,
      curveType: options.curveType ?? 'centripetal',
      tension: options.tension ?? 0.5,
    });

    this.params.dependOn(patchCurve, surface);
  }

  /**
   * Called by the reactive cascade when the patch curve or the surface
   * changes. Re-maps points through the (current) surface and pushes them
   * into the internal `NumericalCurve`.
   */
  rebuild(): void {
    const vec3s = this.computeVec3s();
    if (vec3s) this.curve.updatePoints(vec3s);
  }

  private computeVec3s(): THREE.Vector3[] | undefined {
    const pts = this.patchCurve.getPoints();
    if (pts.length < 2) return undefined;

    const out: THREE.Vector3[] = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      const [u, v] = pts[i];
      out[i] = this.surface.evaluate(u, v);
    }
    return out;
  }

  dispose(): void {
    this.curve.dispose();
    this.params.dispose();
  }
}
