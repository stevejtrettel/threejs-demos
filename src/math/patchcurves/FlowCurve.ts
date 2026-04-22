import { Params } from '@/Params';
import type { SurfaceDomain } from '@/math/surfaces/types';
import type { BoundaryEdge } from '@/math/geodesics/types';
import type { VectorField } from '@/math/vectorfields/types';
import { FlowIntegrator } from '@/math/vectorfields/FlowIntegrator';
import type { PatchCurve } from './types';

export interface FlowCurveOptions {
  initialPosition: [number, number];
  initialTime?: number;
  stepSize?: number;
  steps: number;
  /**
   * Stop integration when the trajectory leaves the field's domain.
   * Default: true.
   */
  bounded?: boolean;
  /**
   * Explicit domain override for boundary checking. Defaults to
   * `field.getDomain()`.
   */
  domain?: SurfaceDomain;
}

/**
 * FlowCurve — a `PatchCurve` produced by integrating a `VectorField`.
 *
 * On any upstream param change, re-integrates eagerly during its
 * `rebuild()`. The cascade (topological order) guarantees this happens
 * before any dependent adapter (`CurveOnSurface`) reads `getPoints()`.
 *
 * @example
 *   const curve = new FlowCurve(gradient, {
 *     initialPosition: [1, 2], steps: 500, stepSize: 0.02,
 *   });
 *   scene.add(new CurveLine({ curve: new CurveOnSurface(curve, graph).curve }));
 *   scene.add(new CurveLine({ curve: new CurveOnSurface(curve, flat ).curve }));
 */
export class FlowCurve implements PatchCurve {
  readonly params = new Params(this);

  private field: VectorField;
  private integrator: FlowIntegrator;

  private readonly initialPosition: [number, number];
  private readonly initialTime: number;
  private readonly steps: number;
  private readonly bounded: boolean;
  private readonly domain?: SurfaceDomain;

  private points: [number, number][] = [];
  private _stopped = false;
  private _stoppedAtBoundary?: BoundaryEdge;

  constructor(field: VectorField, options: FlowCurveOptions) {
    this.field = field;
    this.initialPosition = [...options.initialPosition] as [number, number];
    this.initialTime = options.initialTime ?? 0;
    this.steps = options.steps;
    this.bounded = options.bounded ?? true;
    this.domain = options.domain;

    this.integrator = new FlowIntegrator(field, {
      stepSize: options.stepSize ?? 0.01,
    });

    this.params.dependOn(field);

    this.integrate();
  }

  rebuild(): void {
    this.integrate();
  }

  getPoints(): ReadonlyArray<[number, number]> {
    return this.points;
  }

  get stopped(): boolean {
    return this._stopped;
  }

  get stoppedAtBoundary(): BoundaryEdge | undefined {
    return this._stoppedAtBoundary;
  }

  private integrate(): void {
    const pts: [number, number][] = new Array(this.steps);
    this._stopped = false;
    this._stoppedAtBoundary = undefined;

    // The n-D VectorField returns a ManifoldDomain; the 2D integrator here
    // expects a SurfaceDomain. Convert when using the default.
    let domain: SurfaceDomain | null = null;
    if (this.bounded) {
      if (this.domain) {
        domain = this.domain;
      } else {
        const b = this.field.getDomain();
        domain = {
          uMin: b.min[0], uMax: b.max[0],
          vMin: b.min[1], vMax: b.max[1],
        };
      }
    }

    let state = {
      position: [...this.initialPosition] as [number, number],
      t: this.initialTime,
    };

    let count = 0;
    for (let i = 0; i < this.steps; i++) {
      pts[i] = [state.position[0], state.position[1]];
      count++;

      if (domain) {
        const result = this.integrator.integrateBounded(state, domain);
        state = result.state;
        if (result.hitBoundary) {
          this._stopped = true;
          this._stoppedAtBoundary = result.boundaryEdge;
          break;
        }
      } else {
        state = this.integrator.integrate(state);
      }
    }

    pts.length = count;
    this.points = pts;
  }

  dispose(): void {
    this.params.dispose();
  }
}
