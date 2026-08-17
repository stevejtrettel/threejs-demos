/**
 * SphericalPath.ts
 *
 * An editable curve constrained to the unit sphere S².
 *
 * The path is defined by an ordered list of control points on S² and
 * interpolated by a Catmull-Rom spline through them, renormalized back onto the
 * sphere. Renormalizing a spline is not the same as a genuinely spherical
 * spline — the parameterization is not constant-speed and the segments are not
 * geodesics — but it lands *exactly* on S², passes through every control point,
 * and stays smooth, which is what a curve being dragged around needs. (For two
 * control points the chord's radial projection is precisely the great-circle
 * arc, so the common case is geodesic anyway.)
 *
 * Everything here is in ℝ³ unit vectors, deliberately: spherical angle
 * conventions differ between callers, and baking one in here would push a
 * convention onto every consumer. Callers convert at their own boundary.
 *
 * Mutations bump `revision`, which consumers compare against to decide whether
 * to rebuild derived geometry. A counter rather than the `Params` cascade
 * because this is a plain data model, not a scene object.
 */

import * as THREE from 'three';

/** Result of locating the closest point of the path to a query point. */
export interface PathProjection {
  /** Curve parameter in [0, 1] of the closest sampled point. */
  s: number;
  /** Angular distance to the path, in radians. */
  angle: number;
  /**
   * Index of the control point that begins the segment containing `s`.
   * Inserting at `index + 1` splits that segment.
   */
  index: number;
}

export interface SphericalPathOptions {
  /** Initial control points; normalized on entry. */
  controls?: THREE.Vector3[];
  /** Whether the path closes into a loop (default false). */
  closed?: boolean;
  /** Samples used for the polyline approximation (default 240). */
  resolution?: number;
}

export class SphericalPath {
  private controls: THREE.Vector3[] = [];
  private _closed: boolean;
  private readonly resolution: number;

  /** Incremented on every mutation. */
  revision = 0;

  private spline: THREE.CatmullRomCurve3 | null = null;
  private splineRevision = -1;

  private samples: THREE.Vector3[] = [];
  private samplesRevision = -1;

  constructor(options: SphericalPathOptions = {}) {
    this._closed = options.closed ?? false;
    this.resolution = options.resolution ?? 240;
    if (options.controls) {
      this.controls = options.controls.map((p) => p.clone().normalize());
    }
  }

  // --- Shape -----------------------------------------------------------------

  get closed(): boolean {
    return this._closed;
  }

  set closed(value: boolean) {
    if (this._closed === value) return;
    this._closed = value;
    this.revision++;
  }

  get count(): number {
    return this.controls.length;
  }

  /**
   * Whether there are enough control points to define a curve. A closed path
   * needs three: Catmull-Rom through two points cannot distinguish the two ways
   * round, and degenerates to a doubled arc.
   */
  get hasCurve(): boolean {
    return this.controls.length >= (this._closed ? 3 : 2);
  }

  /** Read-only view of the control points. */
  get controlPoints(): readonly THREE.Vector3[] {
    return this.controls;
  }

  controlAt(i: number): THREE.Vector3 {
    return this.controls[i];
  }

  // --- Editing ---------------------------------------------------------------

  append(p: THREE.Vector3): number {
    this.controls.push(p.clone().normalize());
    this.revision++;
    return this.controls.length - 1;
  }

  insert(index: number, p: THREE.Vector3): number {
    const i = Math.max(0, Math.min(index, this.controls.length));
    this.controls.splice(i, 0, p.clone().normalize());
    this.revision++;
    return i;
  }

  move(index: number, p: THREE.Vector3): void {
    if (index < 0 || index >= this.controls.length) return;
    this.controls[index].copy(p).normalize();
    this.revision++;
  }

  remove(index: number): void {
    if (index < 0 || index >= this.controls.length) return;
    this.controls.splice(index, 1);
    this.revision++;
  }

  clear(): void {
    if (!this.controls.length) return;
    this.controls.length = 0;
    this.revision++;
  }

  /**
   * Replace the control points with a decimation of a freehand stroke.
   *
   * Uses Ramer–Douglas–Peucker with the error measured as the angle from the
   * great circle through the segment's endpoints, so `tolerance` is in radians
   * and is independent of where on the sphere the stroke was drawn.
   *
   * `minControls` guards the degenerate outcome: a short or straight stroke
   * decimates to two points, which is not enough to close into a loop, and the
   * user would be left with a path that cannot be drawn at all. When the
   * decimation undershoots, the stroke is resampled evenly instead.
   */
  setFromStroke(stroke: THREE.Vector3[], tolerance = 0.05, minControls = 2): void {
    const pts = stroke.map((p) => p.clone().normalize());
    let controls = pts.length <= 2 ? pts : simplify(pts, tolerance);

    if (controls.length < minControls && pts.length >= minControls) {
      controls = Array.from({ length: minControls }, (_, i) =>
        pts[Math.round((i * (pts.length - 1)) / (minControls - 1))]);
    }

    this.controls = controls;
    this.revision++;
  }

  // --- Evaluation ------------------------------------------------------------

  /**
   * Point on the path at parameter s ∈ [0, 1].
   *
   * Degenerate paths still answer: with one control point every s maps to it,
   * so a caller mid-edit gets a sensible value rather than an exception.
   */
  evaluate(s: number, out?: THREE.Vector3): THREE.Vector3 {
    const result = out ?? new THREE.Vector3();
    if (!this.controls.length) return result.set(0, 0, 1);
    if (!this.hasCurve) return result.copy(this.controls[0]);

    const curve = this.getSpline();
    curve.getPoint(this._closed ? s % 1 : THREE.MathUtils.clamp(s, 0, 1), result);
    return result.normalize();
  }

  /** The path as a polyline. For a closed path the first point is repeated at the end. */
  polyline(): readonly THREE.Vector3[] {
    if (this.samplesRevision === this.revision) return this.samples;

    this.samples = [];
    if (this.hasCurve) {
      const n = this.resolution;
      for (let i = 0; i <= n; i++) this.samples.push(this.evaluate(i / n));
    } else if (this.controls.length) {
      this.samples.push(this.controls[0].clone());
    }
    this.samplesRevision = this.revision;
    return this.samples;
  }

  // --- Queries ---------------------------------------------------------------

  /**
   * Index of the control point within `maxAngle` radians of `p`, or -1.
   * Ties go to the nearest.
   */
  nearestControl(p: THREE.Vector3, maxAngle = Infinity): number {
    let best = -1;
    let bestAngle = maxAngle;
    for (let i = 0; i < this.controls.length; i++) {
      const angle = this.controls[i].angleTo(p);
      if (angle < bestAngle) {
        bestAngle = angle;
        best = i;
      }
    }
    return best;
  }

  /** Closest point of the path to `p`, located on the sampled polyline. */
  project(p: THREE.Vector3): PathProjection | null {
    if (!this.hasCurve) return null;

    const pts = this.polyline();
    let bestAngle = Infinity;
    let bestIndex = 0;
    for (let i = 0; i < pts.length; i++) {
      const angle = pts[i].angleTo(p);
      if (angle < bestAngle) {
        bestAngle = angle;
        bestIndex = i;
      }
    }

    const s = bestIndex / (pts.length - 1);
    // Which control-point segment that sample falls in. Catmull-Rom spans
    // controls uniformly in s, closed paths having one extra wrap-around span.
    const spans = this._closed ? this.controls.length : this.controls.length - 1;
    const index = Math.min(Math.floor(s * spans), spans - 1);
    return { s, angle: bestAngle, index };
  }

  /**
   * Signed area enclosed by a closed path, in steradians.
   *
   * Sums the signed solid angles of a triangle fan from the first sample, using
   * the standard tangent half-angle formula — stable for the sliver triangles a
   * dense polyline produces, unlike anything built on spherical excess directly.
   * Positive is counterclockwise seen from outside. Returns 0 for open paths.
   */
  enclosedArea(): number {
    if (!this._closed || !this.hasCurve) return 0;

    const pts = this.polyline();
    const a = pts[0];
    let total = 0;
    for (let i = 1; i + 1 < pts.length; i++) {
      const b = pts[i];
      const c = pts[i + 1];
      const numerator = a.dot(new THREE.Vector3().crossVectors(b, c));
      const denominator = 1 + a.dot(b) + b.dot(c) + c.dot(a);
      total += 2 * Math.atan2(numerator, denominator);
    }
    return total;
  }

  // --- Internals -------------------------------------------------------------

  private getSpline(): THREE.CatmullRomCurve3 {
    if (this.spline && this.splineRevision === this.revision) return this.spline;
    this.spline = new THREE.CatmullRomCurve3(
      this.controls.map((p) => p.clone()),
      this._closed,
      'catmullrom',
      0.5,
    );
    this.splineRevision = this.revision;
    return this.spline;
  }
}

/** Ramer–Douglas–Peucker with angular error against the great circle. */
function simplify(pts: THREE.Vector3[], tolerance: number): THREE.Vector3[] {
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;

  const normal = new THREE.Vector3();
  const stack: Array<[number, number]> = [[0, pts.length - 1]];

  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    if (hi <= lo + 1) continue;

    normal.crossVectors(pts[lo], pts[hi]);
    const degenerate = normal.lengthSq() < 1e-16;
    if (!degenerate) normal.normalize();

    let worst = tolerance;
    let split = -1;
    for (let i = lo + 1; i < hi; i++) {
      // Endpoints (anti)parallel: no great circle is determined, so fall back to
      // angular distance from the start point.
      const d = degenerate
        ? pts[i].angleTo(pts[lo])
        : Math.abs(Math.asin(THREE.MathUtils.clamp(pts[i].dot(normal), -1, 1)));
      if (d > worst) {
        worst = d;
        split = i;
      }
    }

    if (split >= 0) {
      keep[split] = true;
      stack.push([lo, split], [split, hi]);
    }
  }

  return pts.filter((_, i) => keep[i]);
}
