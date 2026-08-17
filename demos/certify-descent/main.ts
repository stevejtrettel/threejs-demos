/**
 * certify-descent — finding a solution on a surface, before anyone proves it.
 *
 * A schematic of the search half of a certified-solving pipeline, at the
 * lowest dimension where every moving part is still present. The surface is the
 * Fermat cubic `S = { x³ + y³ + z³ = 1 }`, the question is where on it the map
 *
 *     F(x, y, z) = (x³ − y² + z,  xy + yz + zx)
 *
 * takes the value `(0, 1)`, and the answer is drawn three ways at once.
 *
 * ## What is on screen
 *
 * **The shading** is `‖F − (0,1)‖`, the residual: dark where the equations are
 * nearly satisfied, pale where they are badly violated. It is the landscape the
 * search walks down.
 *
 * **The field of trails** is projected gradient descent run from several hundred
 * stratified starting points. Every one of them ends at a solution — there is no
 * spurious local minimum of the residual anywhere on the drawn window, checked
 * in `scripts/validate-certify.ts` — so the field combs into two bundles and the
 * watershed between them is visible as the line where neighbouring trails part.
 * The two black markers are where the bundles land: the solutions.
 *
 * **The moving point** is one descent run, live. Click anywhere on the surface
 * to start it there.
 *
 * **Optionally** (toggle), the curves `{F₁ = 0}` in burgundy and `{F₂ = 1}` in
 * gold, traced on the surface: each equation alone cuts a curve out of `S`, and
 * solving both means standing where they cross. It is the most direct answer to
 * "why exactly two solutions" — but it is off by default, because the curves
 * depend on the coordinates chosen on the target ℝ². Rotate that plane and you
 * get two different curves through the same two points. The crossings are
 * canonical; the curves are a picture of one basis.
 *
 * ## The two legs of a step
 *
 * Descent on a *constrained* problem cannot simply follow `−∇φ`, since that
 * points off the surface. Each step is instead:
 *
 *   • **predict** (teal) — project `∇φ` onto the tangent plane and step along
 *     it. A straight line, so it leaves the curved surface.
 *   • **correct** (orange dot) — Newton along the normal, back onto `S`.
 *
 * The orange dots mark where the predictor landed, before correction. They sit
 * *off* the surface, and how far off is the point: the correction is second
 * order in the step length — measured at `0.13 · leg²` for this surface in
 * `scripts/validate-certify.ts` — so at a sane step size it is a fraction of a
 * percent of the leg, and the two-leg zigzag is invisible without the readout.
 * Turn the step size up and the dots visibly lift off. That smallness is why
 * the idiom works at all.
 *
 * ## The handoff
 *
 * Descent converges linearly: it crawls in and never arrives. Once the residual
 * is small enough the demo switches to **Newton on the square system**
 *
 *     G = (g, F₁, F₂ − 1) : ℝ³ → ℝ³,
 *
 * whose zeros are exactly the solutions. Note what that reframing does — being
 * on the surface stops being a constraint enforced by retraction and becomes
 * one of the three equations. The residual column that appears in the readout,
 * `1e-1 → 1e-3 → 1e-6 → 1e-12 → 1e-16`, is quadratic convergence: four steps,
 * from a rough guess to machine precision.
 *
 * And machine precision is where this demo stops and its sequel starts. Nothing
 * here is a proof. A residual of `2e-16` says the arithmetic is consistent with
 * a solution nearby, not that one exists. Turning that into a theorem is the
 * job of an interval certificate.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { App } from '@/app/App';
import { marchingSquares, chainSegments, type Vec2 } from '@/math/geometry';
import { projectedGradientFlow, projectedGradientStep } from '@/math/implicit';
import { newtonStep } from '@/math/rootfind';
import {
  CHART,
  F,
  SOLUTIONS,
  TARGET,
  chartAreaElement,
  fromWorld,
  lift,
  objective,
  residual,
  squareSystem,
  surface,
  systemResidual,
  toWorld,
} from '../_shared/fermatSystem';

// --- Palette ----------------------------------------------------------------
//
// The warm-neutral family the m3/m4 demos use, with the surface pushed cool so
// the two answer-curves (warm, saturated) sit on top of it rather than in it.

const BG = 0xf0ede8;
const RESIDUAL_NEAR = 0x33505e; // deep slate — the equations nearly hold
const RESIDUAL_FAR = 0xdfe4e4; // pale — badly violated
const CURVE_F1 = 0x7a1f2c; // burgundy — {F₁ = 0}
const CURVE_F2 = 0xc79025; // gold — {F₂ = 1}
const INK = 0x22262b; // solutions, the moving point, Newton beads
const TRAIL = 0x8c7b62; // sepia — the swarm of descent trails
const PREDICT = 0x2e8b87; // teal — the tangential leg
const CORRECT = 0xe0793a; // orange — where the predictor landed, off the surface

// --- Tuning -----------------------------------------------------------------

const SURFACE_SEGMENTS = 170;
const CONTOUR_GRID = 300;

/** Residual below which the demo stops descending and switches to Newton. */
const HANDOFF = 0.05;

/** Descent steps per second, and seconds per Newton step. Watchable pacing. */
const DESCENT_RATE = 18;
const NEWTON_PERIOD = 0.45;

/** Seconds to hold a finished solve before starting a new one. */
const HOLD = 2.2;

/** Cap on the geometric length of one predictor leg. */
const MAX_LEG = 0.6;

let stepSize = 0.05; // slider-controlled multiplier on the projected gradient
let showLegs = true;

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(4.6, 3.4, 5.2);
app.controls.target.set(0.4, 0.15, 0.35);
app.controls.update();
app.backgrounds.setColor(BG);

app.scene.add(new THREE.AmbientLight(0xfff3e0, 0.5));

const key = new THREE.DirectionalLight(0xffffff, 1.9);
key.position.set(5, 7, 4);
app.scene.add(key);

const fill = new THREE.DirectionalLight(0xffe6c4, 0.65);
fill.position.set(-6, 2, 5);
app.scene.add(fill);

const rim = new THREE.DirectionalLight(0xfff8ec, 0.55);
rim.position.set(-3, 5, -4);
app.scene.add(rim);

// --- The surface, shaded by the residual ------------------------------------
//
// Meshed through the graph chart z = ∛(1 − x³ − y³), which is exact for this
// cubic and costs one cube root per vertex. The algorithms below never use it.

const surfaceGeometry = (() => {
  const n = SURFACE_SEGMENTS;
  const positions = new Float32Array((n + 1) * (n + 1) * 3);
  const colors = new Float32Array((n + 1) * (n + 1) * 3);
  const indices: number[] = [];

  const near = new THREE.Color(RESIDUAL_NEAR);
  const far = new THREE.Color(RESIDUAL_FAR);
  const scratch = new THREE.Color();

  for (let i = 0; i <= n; i++) {
    const x = CHART.xMin + ((CHART.xMax - CHART.xMin) * i) / n;
    for (let j = 0; j <= n; j++) {
      const y = CHART.yMin + ((CHART.yMax - CHART.yMin) * j) / n;
      const p = lift(x, y);
      const k = (i * (n + 1) + j) * 3;

      const world = toWorld(p);
      positions[k] = world.x;
      positions[k + 1] = world.y;
      positions[k + 2] = world.z;

      // Log scale: the residual runs over three decades across the window, and
      // linear shading would show one dark speck and a flat field.
      const t = Math.min(1, Math.max(0, (Math.log10(residual(p)) + 1.5) / 3));
      scratch.copy(near).lerp(far, t);
      colors[k] = scratch.r;
      colors[k + 1] = scratch.g;
      colors[k + 2] = scratch.b;
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (n + 1) + j;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
})();

const surfaceMesh = new THREE.Mesh(
  surfaceGeometry,
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
  }),
);
app.scene.add(surfaceMesh);

// --- The two curves whose crossings are the answer --------------------------

/**
 * A point of `S` in world coordinates, nudged out along the surface normal.
 *
 * A tube whose centreline lies exactly on the surface is half-buried in it, and
 * at a grazing angle disappears into the shading entirely. Lifting the
 * centreline by a little under the tube radius floats it clear. Applied only to
 * curves and trails — never to the markers or the predictor legs, whose exact
 * positions are the thing being shown.
 *
 * `∇g = 3(x², y², z²)` has non-negative components everywhere, so the normal
 * always points into the same octant and one sign of offset works over the
 * whole surface.
 */
function raised(p: number[], offset: number): THREE.Vector3 {
  const n = surface.unitNormal(p);
  return toWorld([p[0] + offset * n[0], p[1] + offset * n[1], p[2] + offset * n[2]]);
}

const CURVE_LIFT = 0.016;
const TRAIL_LIFT = 0.008;

/** Trace `{ component = level }` on the surface, as world-space polylines. */
function levelCurve(component: 0 | 1, level: number): THREE.Vector3[][] {
  const n = CONTOUR_GRID;
  const values: number[] = [];
  for (let j = 0; j < n; j++) {
    const y = CHART.yMin + ((CHART.yMax - CHART.yMin) * j) / (n - 1);
    for (let i = 0; i < n; i++) {
      const x = CHART.xMin + ((CHART.xMax - CHART.xMin) * i) / (n - 1);
      values.push(F.value(lift(x, y))[component]);
    }
  }

  const segments = marchingSquares({ nx: n, ny: n, values, ...CHART }, level);
  return chainSegments(segments).map((polyline: Vec2[]) =>
    polyline.map(([x, y]) => raised(lift(x, y), CURVE_LIFT)),
  );
}

/**
 * A polyline as a tube.
 *
 * Consecutive duplicates are dropped — `CatmullRomCurve3` divides by the
 * spacing and produces NaN geometry on a repeat — and a polyline that comes
 * back to its start is rebuilt as a genuinely closed curve so the seam does not
 * show.
 */
function tubeGeometry(
  points: THREE.Vector3[],
  radius: number,
  radialSegments = 8,
): THREE.TubeGeometry | null {
  const cleaned: THREE.Vector3[] = [];
  for (const p of points) {
    if (!cleaned.length || cleaned[cleaned.length - 1].distanceTo(p) > 1e-7) cleaned.push(p);
  }
  if (cleaned.length < 2) return null;

  let closed = false;
  if (cleaned.length > 3 && cleaned[0].distanceTo(cleaned[cleaned.length - 1]) < 1e-7) {
    cleaned.pop();
    closed = true;
  }

  const curve = new THREE.CatmullRomCurve3(cleaned, closed);
  const divisions = Math.min(2000, Math.max(16, cleaned.length * 2));
  return new THREE.TubeGeometry(curve, divisions, radius, radialSegments, closed);
}

function tube(points: THREE.Vector3[], radius: number, material: THREE.Material): THREE.Mesh | null {
  const geometry = tubeGeometry(points, radius);
  return geometry ? new THREE.Mesh(geometry, material) : null;
}

const curveMaterialF1 = new THREE.MeshStandardMaterial({ color: CURVE_F1, roughness: 0.45, metalness: 0.05 });
const curveMaterialF2 = new THREE.MeshStandardMaterial({ color: CURVE_F2, roughness: 0.45, metalness: 0.05 });

// Off by default: the two curves are an artifact of the coordinates chosen on
// the target ℝ², not of the problem. Their crossings are canonical; the curves
// themselves are not. Kept behind a toggle because they are still the clearest
// single answer to "why exactly two solutions".
const curveGroup = new THREE.Group();
curveGroup.visible = false;
app.scene.add(curveGroup);

for (const polyline of levelCurve(0, TARGET[0])) {
  const mesh = tube(polyline, 0.022, curveMaterialF1);
  if (mesh) curveGroup.add(mesh);
}
for (const polyline of levelCurve(1, TARGET[1])) {
  const mesh = tube(polyline, 0.022, curveMaterialF2);
  if (mesh) curveGroup.add(mesh);
}

// --- The solutions ----------------------------------------------------------

const solutionMaterial = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.35, metalness: 0.1 });
for (const s of SOLUTIONS) {
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.058, 24, 24), solutionMaterial);
  marker.position.copy(toWorld(s));
  app.scene.add(marker);
}

// --- The swarm: where every other starting point goes -----------------------
//
// This is the picture: a dense field of descent paths, combed into the two
// wells. The basins, the watershed between them, and the way the flow turns as
// it crosses the surface are all in here — none of it depending on how the
// target plane happens to be coordinatized.

const SWARM_OPTIONS = { stepSize: 0.05, maxStepLength: 0.12, maxSteps: 2000 };

/** How many descent paths to integrate at load. */
const SWARM_SEEDS = 576;

/**
 * Seeds spread uniformly over the *surface*, not over the chart.
 *
 * Spacing them evenly in `(x, y)` is the convenient thing and the wrong thing:
 * the graph is stretched by up to 10⁴ along `x³ + y³ = 1`, where the surface
 * stands vertical over the chart, so a chart-even lattice leaves a conspicuous
 * bare band exactly there. The density has to come from the geometry instead.
 *
 * The area element is unbounded, so there is nothing to reject-sample against.
 * Instead this builds a cumulative distribution over cells — each cell's
 * *integral* is finite however singular the density inside it — and draws from
 * it, stratified so the draws are spread through the distribution rather than
 * bunched in it.
 *
 * Sampling by area gets the *density* right but not the *spacing*: independent
 * draws land on top of each other now and then, which wastes a trail. Each seed
 * is therefore the farthest-from-its-neighbours of `CANDIDATES` tries
 * (Mitchell's best-candidate), which costs about 20 ms and tightens the spacing
 * on the surface from 0.012–0.417 to 0.075–0.289. Past six candidates it stops
 * paying.
 *
 * Deterministic, so the picture is identical on every reload.
 */
function areaUniformSeeds(count: number, rand: () => number): number[][] {
  const CELLS = 300;
  const CANDIDATES = 6;
  const cellX = (CHART.xMax - CHART.xMin) / CELLS;
  const cellY = (CHART.yMax - CHART.yMin) / CELLS;

  const cumulative = new Float64Array(CELLS * CELLS);
  let total = 0;
  for (let i = 0; i < CELLS; i++) {
    for (let j = 0; j < CELLS; j++) {
      // Four sub-samples, so a cell straddling the vertical band is not judged
      // by whether its single midpoint happened to land near the cliff.
      let sum = 0;
      let n = 0;
      for (const a of [0.25, 0.75]) {
        for (const b of [0.25, 0.75]) {
          const w = chartAreaElement(CHART.xMin + cellX * (i + a), CHART.yMin + cellY * (j + b));
          if (Number.isFinite(w)) {
            sum += w;
            n++;
          }
        }
      }
      total += n > 0 ? sum / n : 0;
      cumulative[i * CELLS + j] = total;
    }
  }

  /** One draw from the area-weighted distribution, within stratum `k`. */
  const drawFrom = (k: number): number[] => {
    const target = (total * (k + rand())) / count;

    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < target) lo = mid + 1;
      else hi = mid;
    }

    const i = Math.floor(lo / CELLS);
    const j = lo % CELLS;
    return lift(CHART.xMin + cellX * (i + rand()), CHART.yMin + cellY * (j + rand()));
  };

  const seeds: number[][] = [];
  for (let k = 0; k < count; k++) {
    let best: number[] | null = null;
    let bestDistance = -1;

    for (let c = 0; c < CANDIDATES; c++) {
      const candidate = drawFrom(k);

      let nearest = Infinity;
      for (const other of seeds) {
        const d = Math.hypot(
          candidate[0] - other[0],
          candidate[1] - other[1],
          candidate[2] - other[2],
        );
        if (d < nearest) nearest = d;
      }

      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = candidate;
      }
    }

    if (best) seeds.push(best);
  }

  return seeds;
}

{
  let seed = 20260815;
  const rand = () => ((seed = (1103515245 * seed + 12345) % 2147483648) / 2147483648);

  const geometries: THREE.BufferGeometry[] = [];

  for (const start of areaUniformSeeds(SWARM_SEEDS, rand)) {
    const flow = projectedGradientFlow(surface, objective, start, SWARM_OPTIONS);

    // Stop the trail where it arrives, rather than letting it pile up into a
    // blob while the last few digits converge.
    let end = flow.points.findIndex((p) => residual(p) < 0.02);
    if (end < 0) end = flow.points.length - 1;

    // A seed that starts inside a well makes a stub, not a trail. Dropping it
    // on length rather than on distance to a solution avoids punching a
    // conspicuous circular hole around each one.
    if (end < 4) continue;

    const stride = Math.max(1, Math.ceil((end + 1) / 60));
    const points: THREE.Vector3[] = [];
    for (let k = 0; k <= end; k += stride) points.push(raised(flow.points[k], TRAIL_LIFT));

    const geometry = tubeGeometry(points, 0.006, 5);
    if (geometry) geometries.push(geometry);
  }

  // One draw call for the whole field rather than several hundred.
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();

  if (merged) {
    app.scene.add(
      new THREE.Mesh(
        merged,
        new THREE.MeshStandardMaterial({
          color: TRAIL,
          roughness: 0.8,
          transparent: true,
          opacity: 0.42,
        }),
      ),
    );
  }
}

// --- The live descent -------------------------------------------------------

type Phase = 'descent' | 'newton' | 'done';

const heroMaterial = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.3, metalness: 0.15 });
const heroTrailMaterial = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.55 });
const beadMaterial = new THREE.MeshStandardMaterial({ color: CORRECT, roughness: 0.35, metalness: 0.1 });

// One shared geometry for the Newton beads, so clearing the group between runs
// does not orphan a geometry per bead.
const beadGeometry = new THREE.SphereGeometry(0.032, 16, 16);

const marble = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 24), heroMaterial);
app.scene.add(marble);

const trailGroup = new THREE.Group();
const beadGroup = new THREE.Group();
app.scene.add(trailGroup, beadGroup);

/** The last few predictor legs, as instanced cylinders. */
const LEG_HISTORY = 40;
const legMesh = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.011, 0.011, 1, 8, 1),
  new THREE.MeshStandardMaterial({ color: PREDICT, roughness: 0.5 }),
  LEG_HISTORY,
);
legMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
legMesh.frustumCulled = false;
app.scene.add(legMesh);

/** Where each predictor leg landed — off the surface, by `0.13 · leg²`. */
const markMesh = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.019, 12, 12),
  new THREE.MeshStandardMaterial({ color: CORRECT, roughness: 0.4 }),
  LEG_HISTORY,
);
markMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
markMesh.frustumCulled = false;
app.scene.add(markMesh);

/** Trail length the tube geometry was last built for; -1 forces a rebuild. */
let trailLength = -1;

const state = {
  phase: 'descent' as Phase,
  point: lift(-1.35, 1.55),
  trail: [] as number[][],
  legs: [] as { from: number[]; predicted: number[]; to: number[] }[],
  steps: 0,
  lastPredictor: 0,
  lastCorrector: 0,
  newtonResiduals: [] as number[],
  accumulator: 0,
  holdFor: 0,
};

function reseed(x: number, y: number): void {
  state.phase = 'descent';
  state.point = surface.retract(lift(x, y));
  state.trail = [state.point.slice()];
  state.legs = [];
  state.steps = 0;
  state.lastPredictor = 0;
  state.lastCorrector = 0;
  state.newtonResiduals = [];
  state.accumulator = 0;
  state.holdFor = 0;
  beadGroup.clear();
  trailLength = -1;
}

reseed(-1.35, 1.55);

const _yAxis = new THREE.Vector3(0, 1, 0);
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

/** Place instance `i` of a unit-height cylinder along the segment `a → b`. */
function placeLeg(mesh: THREE.InstancedMesh, i: number, a: THREE.Vector3, b: THREE.Vector3): void {
  _dir.subVectors(b, a);
  const length = _dir.length();
  if (length < 1e-9) {
    _matrix.makeScale(0, 0, 0);
    mesh.setMatrixAt(i, _matrix);
    return;
  }
  _mid.addVectors(a, b).multiplyScalar(0.5);
  _quat.setFromUnitVectors(_yAxis, _dir.divideScalar(length));
  _scale.set(1, length, 1);
  _matrix.compose(_mid, _quat, _scale);
  mesh.setMatrixAt(i, _matrix);
}

function refreshLegs(): void {
  const shown = showLegs ? state.legs.slice(-LEG_HISTORY) : [];
  for (let i = 0; i < LEG_HISTORY; i++) {
    const leg = shown[i];
    if (!leg) {
      _matrix.makeScale(0, 0, 0);
      legMesh.setMatrixAt(i, _matrix);
      markMesh.setMatrixAt(i, _matrix);
      continue;
    }
    _from.copy(toWorld(leg.from));
    _to.copy(toWorld(leg.predicted));
    placeLeg(legMesh, i, _from, _to);
    _matrix.makeTranslation(_to.x, _to.y, _to.z);
    markMesh.setMatrixAt(i, _matrix);
  }
  legMesh.instanceMatrix.needsUpdate = true;
  markMesh.instanceMatrix.needsUpdate = true;
}

/**
 * Rebuild the live trail, but only when it has actually grown — the tube is a
 * fresh `BufferGeometry` each time, and rebuilding one every frame while the
 * point sits still would leak geometry for as long as the demo runs.
 */
function refreshTrail(): void {
  if (state.trail.length === trailLength) return;
  trailLength = state.trail.length;

  for (const child of trailGroup.children) (child as THREE.Mesh).geometry.dispose();
  trailGroup.clear();
  if (state.trail.length < 2) return;

  const stride = Math.max(1, Math.ceil(state.trail.length / 300));
  const points: THREE.Vector3[] = [];
  for (let k = 0; k < state.trail.length; k += stride) points.push(raised(state.trail[k], TRAIL_LIFT));
  points.push(raised(state.trail[state.trail.length - 1], TRAIL_LIFT));

  const mesh = tube(points, 0.017, heroTrailMaterial);
  if (mesh) trailGroup.add(mesh);
}

function descendOnce(): void {
  const step = projectedGradientStep(surface, objective, state.point, {
    stepSize,
    maxStepLength: MAX_LEG,
  });

  state.lastPredictor = Math.hypot(
    step.predicted[0] - step.from[0],
    step.predicted[1] - step.from[1],
    step.predicted[2] - step.from[2],
  );
  state.lastCorrector = Math.hypot(
    step.to[0] - step.predicted[0],
    step.to[1] - step.predicted[1],
    step.to[2] - step.predicted[2],
  );

  state.point = step.to;
  state.trail.push(step.to.slice());
  state.legs.push({ from: step.from, predicted: step.predicted, to: step.to });
  state.steps++;

  // Normally the handoff happens because the descent got close. The other two
  // conditions are insurance: a seed landing exactly on the separatrix would
  // creep toward the saddle of φ and never arrive, and there is nothing to
  // watch in a point that has stopped moving. Newton is handed the problem
  // either way — from a saddle it usually still finds a root, and if its
  // Jacobian is singular there `newtonOnce` ends the run cleanly.
  const stalled = state.lastPredictor === 0;
  if (residual(state.point) < HANDOFF || stalled || state.steps > 1200) {
    state.phase = 'newton';
    state.newtonResiduals = [systemResidual(state.point)];
    state.accumulator = 0;
  }
}

function newtonOnce(): void {
  const next = newtonStep(squareSystem, state.point);
  if (next === null) {
    state.phase = 'done';
    state.holdFor = HOLD;
    return;
  }

  state.point = next;
  state.trail.push(next.slice());
  state.newtonResiduals.push(systemResidual(next));

  const bead = new THREE.Mesh(beadGeometry, beadMaterial);
  bead.position.copy(toWorld(next));
  beadGroup.add(bead);

  const last = state.newtonResiduals[state.newtonResiduals.length - 1];
  if (last < 1e-14 || state.newtonResiduals.length > 8) {
    state.phase = 'done';
    state.holdFor = HOLD;
  }
}

// --- Readout and controls ---------------------------------------------------

const style = document.createElement('style');
style.textContent = `
  .panel {
    position: absolute; bottom: 16px; right: 16px;
    max-width: 33%; min-width: 210px; padding: 8px 10px;
    z-index: 10; pointer-events: auto;
    font: 12px/1.7 ui-monospace, monospace; color: #5A5148;
  }
  .panel label { display: block; margin-bottom: 2px; }
  .thin-slider {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 5px; margin: 0 0 8px;
    background: transparent; outline: none; cursor: pointer;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
  }
  .thin-slider::-webkit-slider-runnable-track {
    height: 5px; background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.45); border-radius: 999px; box-sizing: border-box;
  }
  .thin-slider::-moz-range-track {
    height: 5px; background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.45); border-radius: 999px; box-sizing: border-box;
  }
  .thin-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 14px; height: 14px; margin-top: -5px;
    background: #fff; border: 1.5px solid rgba(0, 0, 0, 0.8);
    border-radius: 50%; box-sizing: border-box; cursor: pointer;
  }
  .thin-slider::-moz-range-thumb {
    width: 14px; height: 14px;
    background: #fff; border: 1.5px solid rgba(0, 0, 0, 0.8);
    border-radius: 50%; box-sizing: border-box; cursor: pointer;
  }
  .readout {
    position: absolute; bottom: 16px; left: 16px; z-index: 10;
    font: 12px/1.7 ui-monospace, monospace; color: #5A5148;
    font-variant-numeric: tabular-nums;
  }
  .readout .head { color: #2C2C2C; }
  .hint { opacity: 0.65; }
`;
document.head.appendChild(style);

const panel = document.createElement('div');
panel.className = 'panel';
panel.innerHTML = `
  <label>step size <span id="step-value">${stepSize.toFixed(3)}</span></label>
  <input id="step" type="range" class="thin-slider" min="0.01" max="0.40" step="0.005" value="${stepSize}" />
  <label><input id="legs" type="checkbox" checked /> show predictor / corrector</label>
  <label><input id="curves" type="checkbox" /> show {F₁ = 0} and {F₂ = 1}</label>
  <div class="hint">click the surface to start there</div>
`;
document.body.appendChild(panel);

const stepValue = panel.querySelector<HTMLSpanElement>('#step-value')!;
panel.querySelector<HTMLInputElement>('#step')!.addEventListener('input', (e) => {
  stepSize = parseFloat((e.target as HTMLInputElement).value);
  stepValue.textContent = stepSize.toFixed(3);
});
panel.querySelector<HTMLInputElement>('#legs')!.addEventListener('change', (e) => {
  showLegs = (e.target as HTMLInputElement).checked;
  refreshLegs();
});
panel.querySelector<HTMLInputElement>('#curves')!.addEventListener('change', (e) => {
  curveGroup.visible = (e.target as HTMLInputElement).checked;
});

const readout = document.createElement('div');
readout.className = 'readout';
document.body.appendChild(readout);

function updateReadout(): void {
  if (state.phase === 'descent') {
    const ratio = state.lastPredictor > 0 ? state.lastCorrector / state.lastPredictor : 0;
    readout.innerHTML = [
      `<span class="head">projected gradient descent</span>`,
      `step ${state.steps} &nbsp; ‖F − c‖ = ${residual(state.point).toExponential(2)}`,
      `predictor ${state.lastPredictor.toFixed(4)} &nbsp; corrector ${state.lastCorrector.toFixed(5)}`,
      `<span class="hint">the correction is ${(100 * ratio).toFixed(2)}% of the step — it is O(step²)</span>`,
    ].join('<br>');
    return;
  }

  const column = state.newtonResiduals.map((r) => r.toExponential(1)).join(' → ');
  if (state.phase === 'newton') {
    readout.innerHTML = [
      `<span class="head">Newton on G = (g, F₁, F₂ − 1)</span>`,
      `after ${state.steps} descent steps`,
      `‖G‖ &nbsp; ${column}`,
    ].join('<br>');
    return;
  }

  readout.innerHTML = [
    `<span class="head">solved to machine precision</span>`,
    `‖G‖ &nbsp; ${column}`,
    `<span class="hint">a numerical claim, not a proof —</span>`,
    `<span class="hint">that needs an interval certificate</span>`,
  ].join('<br>');
}

// --- Click to start a descent there -----------------------------------------
//
// A plain click rather than a DragBehavior grab: a press on the surface must
// still orbit the camera, and only a press that does not turn into a drag
// counts as picking a seed.

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const canvas = app.renderManager.renderer.domElement;
let pressedAt: { x: number; y: number; time: number } | null = null;

canvas.addEventListener('pointerdown', (event) => {
  pressedAt = { x: event.clientX, y: event.clientY, time: event.timeStamp };
});

canvas.addEventListener('pointerup', (event) => {
  if (!pressedAt) return;
  const moved = Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y);
  const held = event.timeStamp - pressedAt.time;
  pressedAt = null;
  if (moved > 6 || held > 500) return; // that was an orbit, not a click

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, app.camera);

  const hit = raycaster.intersectObject(surfaceMesh, false)[0];
  if (!hit) return;

  const [x, y] = fromWorld(hit.point);
  reseed(
    Math.min(CHART.xMax - 0.05, Math.max(CHART.xMin + 0.05, x)),
    Math.min(CHART.yMax - 0.05, Math.max(CHART.yMin + 0.05, y)),
  );
});

// --- Go ---------------------------------------------------------------------

app.addAnimateCallback((_elapsed, delta) => {
  const dt = Math.min(delta, 0.1); // a backgrounded tab must not fast-forward

  if (state.phase === 'descent') {
    state.accumulator += dt * DESCENT_RATE;
    let budget = 6; // cap the catch-up after a stall
    while (state.accumulator >= 1 && budget-- > 0 && state.phase === 'descent') {
      state.accumulator -= 1;
      descendOnce();
    }
    state.accumulator = Math.min(state.accumulator, 1);
  } else if (state.phase === 'newton') {
    state.accumulator += dt;
    if (state.accumulator >= NEWTON_PERIOD) {
      state.accumulator = 0;
      newtonOnce();
    }
  } else {
    state.holdFor -= dt;
    if (state.holdFor <= 0) {
      // Start again somewhere else, so the demo keeps showing new descents.
      const x = CHART.xMin + 0.2 + Math.random() * (CHART.xMax - CHART.xMin - 0.4);
      const y = CHART.yMin + 0.2 + Math.random() * (CHART.yMax - CHART.yMin - 0.4);
      reseed(x, y);
    }
  }

  marble.position.copy(toWorld(state.point));
  refreshTrail();
  refreshLegs();
  updateReadout();
});

app.start();
