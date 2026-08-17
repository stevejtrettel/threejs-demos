/**
 * Hopf Preimage — interactive
 *
 * Draw a curve on S² and watch its preimage under the Hopf fibration appear in
 * ℝ³. The preimage of a point is a circle, of an arc an annular strip, and of a
 * closed loop a torus — the whole point being that you can deform the loop and
 * see the torus follow.
 *
 * Everything is modeless; what you press on decides what happens:
 *
 *   base sphere, empty  drag traces a new curve, click appends a control point
 *   a control point     drag moves it
 *   the curve itself    drag inserts a control point there and moves it
 *   the preimage        drag rotates the *window*, not the camera (see below)
 *   empty space         orbits the camera, as usual
 *
 * ## Rotating the preimage
 *
 * Drawing S³ in ℝ³ needs a stereographic projection, and the fiber through the
 * projection point becomes a straight line through infinity. That line looks
 * like a distinguished fiber but is nothing of the sort — it is an artifact of
 * where the window sits. Dragging the preimage moves the window through SU(2),
 * which acts on ℝ³ by *Möbius* transformations rather than rigid ones: circles
 * stay circles, but radii change and the straight fiber becomes an ordinary one
 * while some other fiber straightens out. The curve on S² is never touched.
 *
 * The one thing that does move on the base is the marker for the blow-up: the
 * base point whose fiber is currently running to infinity. Steer the curve near
 * it and the surface gets clipped; rotate the window to move it out of the way.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { HopfChart, baseAngles } from '@/math/hopf/HopfChart';
import { SphericalPath } from '@/math/spherical/SphericalPath';
import { LiveSurfaceMesh } from '@/math/surfaces/LiveSurfaceMesh';
import { DragBehavior } from '@/interaction/DragBehavior';
import { pickSphere } from '@/interaction/pickSphere';

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });

app.scene.background = new THREE.Color(0xeeeeee);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(5, 10, 7);
app.scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
fillLight.position.set(-5, -3, -5);
app.scene.add(fillLight);

// A narrow field of view keeps both panels large without the perspective
// stretch that a wide one puts on the sphere at the edge of frame.
app.camera.fov = 35;
app.camera.position.set(4.25, 5.5, 14.5);
app.camera.updateProjectionMatrix();
app.controls.target.set(4.25, 0, 0);
app.controls.update();

// --- Model ------------------------------------------------------------------

// The cutoff trades the size of the excised region against how far the surface
// sprawls: a fiber's radius grows as 4/(angle to the blow-up), so a cutoff R
// hides a disk of angular radius about 4/R. At 6.5 that is ~35°, small enough
// that a well-placed curve never touches it and large enough that the surface
// stays clear of the base sphere.
const chart = new HopfChart({ cutoffRadius: 6.5 });

// The untouched window puts the blow-up at h = (0, 0, 1), which faces the
// camera — the worst place for it, since that is exactly where a curve gets
// drawn. Start with the window turned so it sits on the far side of the base
// sphere, leaving the whole visible face safe to draw on.
chart.rotate(new THREE.Vector3(1, 0, 0), Math.PI);

/** Angular radius of the region around the blow-up where clipping begins. */
const DANGER_ANGLE = 4 / chart.cutoffRadius;

// A tilted loop to open on: closed, well clear of the blow-up at (0, 0, 1).
const path = new SphericalPath({
  closed: true,
  controls: [
    new THREE.Vector3(1, 0, -0.35),
    new THREE.Vector3(0.1, 1, -0.5),
    new THREE.Vector3(-1, 0.2, -0.3),
    new THREE.Vector3(-0.1, -1, -0.55),
  ],
});

// Far enough out that the preimage cannot reach the sphere even at full cutoff,
// and big enough to draw on comfortably.
const BASE_POS = new THREE.Vector3(9.5, 0, 0);
const BASE_RADIUS = 2;
const toWorld = (p: THREE.Vector3, out?: THREE.Vector3): THREE.Vector3 =>
  (out ?? new THREE.Vector3()).copy(p).multiplyScalar(BASE_RADIUS).add(BASE_POS);

// --- Preimage surface -------------------------------------------------------

const surfaceMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xaaccee,
  roughness: 0.25,
  metalness: 0.1,
  clearcoat: 0.6,
  side: THREE.DoubleSide,
});

const preimage = new LiveSurfaceMesh(chart.preimage(path), {
  uSegments: 128,
  vSegments: 96,
  wrapU: true,
  wrapV: path.closed,
  material: surfaceMaterial,
});
app.scene.add(preimage);

// --- Fibers of the control points -------------------------------------------

// One tube per control point, coloured around the hue circle so a fiber can be
// matched to the dot it belongs to. Fibers are rebuilt whenever the path or the
// window changes; there are only a handful, so rebuilding the tubes outright is
// cheaper than any scheme for updating them in place.
const fiberGroup = new THREE.Group();
app.scene.add(fiberGroup);

const fiberColor = (i: number, n: number) =>
  new THREE.Color().setHSL(n ? (i / n) * 0.85 : 0, 0.55, 0.5);

const fiberMaterials: THREE.MeshStandardMaterial[] = [];
function fiberMaterial(i: number, n: number): THREE.MeshStandardMaterial {
  if (!fiberMaterials[i]) {
    fiberMaterials[i] = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.1 });
  }
  fiberMaterials[i].color.copy(fiberColor(i, n));
  return fiberMaterials[i];
}

function rebuildFibers(): void {
  for (const child of fiberGroup.children) (child as THREE.Mesh).geometry.dispose();
  fiberGroup.clear();

  const n = path.count;
  for (let i = 0; i < n; i++) {
    const { theta, phi } = baseAngles(path.controlAt(i));
    const material = fiberMaterial(i, n);
    for (const run of chart.fiberRuns(theta, phi, 220)) {
      if (run.length < 2) continue;
      // A run that closes on itself is a whole fiber; the rest are clipped arcs.
      const closed = run[0].distanceTo(run[run.length - 1]) < 1e-6;
      const points = closed ? run.slice(0, -1) : run;
      if (points.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(points, closed);
      fiberGroup.add(new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.min(points.length * 2, 400), 0.035, 8, closed),
        material,
      ));
    }
  }
}

// --- Base sphere ------------------------------------------------------------

const baseGroup = new THREE.Group();
app.scene.add(baseGroup);

const baseSphere = new THREE.Mesh(
  new THREE.SphereGeometry(BASE_RADIUS, 48, 48),
  new THREE.MeshPhysicalMaterial({
    color: 0xddddff,
    transparent: true,
    transmission: 0.85,
    ior: 1.1,
    thickness: 0.4,
    roughness: 0.1,
    clearcoat: 1,
    metalness: 0,
  }),
);
baseSphere.position.copy(BASE_POS);
baseSphere.renderOrder = 1;
baseGroup.add(baseSphere);

/**
 * Whether the points are joined into a curve.
 *
 * Off, they are just a finite set on S², and the preimage of a finite set is a
 * finite set of fibers — a Hopf link of disjoint circles, every pair linked
 * exactly once. On, the curve joining them sweeps those fibers into the surface
 * between. Turning it off is the cleanest way to see the linking, which the
 * surface otherwise hides.
 */
let connected = true;

// The curve drawn on the base, and a dot per control point.
const curveMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4 });
const dotGeometry = new THREE.SphereGeometry(0.095, 20, 20);

let curveMesh: THREE.Mesh | null = null;
const dotGroup = new THREE.Group();
baseGroup.add(dotGroup);

function rebuildBaseCurve(): void {
  if (curveMesh) {
    curveMesh.geometry.dispose();
    baseGroup.remove(curveMesh);
    curveMesh = null;
  }
  if (connected && path.hasCurve) {
    const points = path.polyline().map((p) => toWorld(p));
    // The polyline repeats its first point when closed; TubeGeometry adds the
    // closing span itself, so drop the duplicate.
    if (path.closed) points.pop();
    const curve = new THREE.CatmullRomCurve3(points, path.closed);
    curveMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, points.length, 0.022, 8, path.closed),
      curveMaterial,
    );
    curveMesh.renderOrder = 2;
    baseGroup.add(curveMesh);
  }

  for (const child of dotGroup.children) (child as THREE.Mesh).geometry.dispose?.();
  dotGroup.clear();
  for (let i = 0; i < path.count; i++) {
    const dot = new THREE.Mesh(dotGeometry, new THREE.MeshStandardMaterial({
      color: fiberColor(i, path.count), roughness: 0.3, metalness: 0.1,
    }));
    dot.position.copy(toWorld(path.controlAt(i)));
    dot.renderOrder = 3;
    dotGroup.add(dot);
  }
}

// Marker for the base point whose fiber currently runs to infinity.
const singularMarker = new THREE.Mesh(
  new THREE.TorusGeometry(0.13, 0.028, 10, 28),
  new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4 }),
);
singularMarker.renderOrder = 3;
baseGroup.add(singularMarker);

const singular = new THREE.Vector3();
function updateSingularMarker(): void {
  chart.singularBase(singular);
  singularMarker.position.copy(toWorld(singular));
  // Lay the ring flat against the sphere.
  singularMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), singular);
}

// --- Refresh ----------------------------------------------------------------

let pathRevision = -1;
let chartRevision = -1;
let connectedShown: boolean | null = null;

function refresh(): void {
  const pathChanged = path.revision !== pathRevision;
  const chartChanged = chart.revision !== chartRevision;
  const connectChanged = connected !== connectedShown;
  if (!pathChanged && !chartChanged && !connectChanged) return;
  pathRevision = path.revision;
  chartRevision = chart.revision;
  connectedShown = connected;

  preimage.visible = connected && path.hasCurve;
  if (preimage.visible) {
    // wrapV follows the path: a closed loop makes the preimage a torus, seamless
    // in both directions, while an arc leaves genuine boundary fibers.
    preimage.setSurface(chart.preimage(path), { v: path.closed });
  }

  rebuildFibers();
  if (pathChanged || connectChanged) rebuildBaseCurve();
  if (chartChanged) updateSingularMarker();
  updateReadout();
}

// --- Interaction ------------------------------------------------------------

type Grab =
  | { kind: 'control'; index: number }
  | { kind: 'stroke'; points: THREE.Vector3[] }
  | { kind: 'window'; x: number; y: number };

const GRAB_ANGLE = 0.14;      // radians on the base sphere counted as "on" a dot
const CURVE_ANGLE = 0.07;     // ... and as "on" the curve
const ROTATE_SPEED = 0.006;   // radians per pixel when turning the window

const picked = new THREE.Vector3();
const axis = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const cameraUp = new THREE.Vector3();

/** Picked point on the base sphere, as a unit vector in base coordinates. */
function pickBase(raycaster: THREE.Raycaster): { point: THREE.Vector3; hit: boolean } {
  const { point, hit } = pickSphere(raycaster, BASE_POS, BASE_RADIUS, picked);
  return { point: point.clone().sub(BASE_POS).normalize(), hit };
}

const drag = new DragBehavior<Grab>({
  camera: app.camera,
  domElement: app.renderManager.renderer.domElement,
  controls: app.controls.controls,

  onDragStart: ({ raycaster, event }) => {
    const { point, hit } = pickBase(raycaster);
    if (hit) {
      const control = path.nearestControl(point, GRAB_ANGLE);
      if (control >= 0) return { kind: 'control', index: control };

      // Only when there is a drawn curve to grab.
      if (connected) {
        const onCurve = path.project(point);
        if (onCurve && onCurve.angle < CURVE_ANGLE) {
          return { kind: 'control', index: path.insert(onCurve.index + 1, point) };
        }
      }
      return { kind: 'stroke', points: [point] };
    }

    // Not on the base sphere — grabbing the preimage turns the window. The
    // fibers count too, so the window is still reachable with the surface off.
    const targets: THREE.Object3D[] = preimage.visible ? [preimage, fiberGroup] : [fiberGroup];
    if (raycaster.intersectObjects(targets, true).length) {
      return { kind: 'window', x: event.clientX, y: event.clientY };
    }
    return null; // fall through to the camera
  },

  onDrag: (grab, { raycaster, event }) => {
    if (grab.kind === 'control') {
      path.move(grab.index, pickBase(raycaster).point);
    } else if (grab.kind === 'stroke') {
      const point = pickBase(raycaster).point;
      // Skip samples that barely moved; they only add noise for the decimator.
      const last = grab.points[grab.points.length - 1];
      if (point.angleTo(last) > 0.01) {
        grab.points.push(point);
        path.setFromStroke(grab.points, 0.045, path.closed ? 3 : 2);
      }
    } else {
      // Screen motion → a rotation of the base about the camera's own axes, so
      // the picture turns the way the pointer pushes it.
      const dx = event.clientX - grab.x;
      const dy = event.clientY - grab.y;
      grab.x = event.clientX;
      grab.y = event.clientY;

      app.camera.matrixWorld.extractBasis(cameraRight, cameraUp, axis);
      if (dx) chart.rotate(cameraUp, -dx * ROTATE_SPEED);
      if (dy) chart.rotate(cameraRight, -dy * ROTATE_SPEED);
    }
    refresh();
  },

  onClick: (grab) => {
    // A press that never moved: on empty sphere it appends a control point, on
    // an existing one it does nothing (the drag already handled the move).
    if (grab.kind !== 'stroke') return;
    path.append(grab.points[0]);
    refresh();
  },

  onDragEnd: (grab) => {
    // A stroke too short to be a deliberate curve is treated as a click instead,
    // so a slightly shaky press never wipes the existing curve.
    if (grab.kind === 'stroke' && grab.points.length > 1 && grab.points.length < 6) {
      path.setFromStroke([], 0);
      path.append(grab.points[0]);
    }
    refresh();
  },
});

// --- UI ---------------------------------------------------------------------

const panel = document.createElement('div');
panel.style.cssText = [
  'position:fixed', 'left:16px', 'bottom:16px', 'z-index:10',
  'display:flex', 'flex-direction:column', 'gap:8px',
  'padding:12px 14px', 'border-radius:8px',
  'background:rgba(255,255,255,0.82)', 'backdrop-filter:blur(6px)',
  'border:1px solid rgba(0,0,0,0.12)',
  'font:12px/1.5 ui-monospace, monospace', 'color:#2c2c2c',
  'max-width:280px',
].join(';');
document.body.appendChild(panel);

const help = document.createElement('div');
help.style.cssText = 'opacity:0.65';
help.innerHTML = [
  'drag sphere — trace a curve',
  'click sphere — add a point',
  'drag a point — move it',
  'drag preimage — turn the window',
  'connect off — just the fibers',
].join('<br>');
panel.appendChild(help);

const readout = document.createElement('div');
readout.style.cssText = 'font-variant-numeric:tabular-nums';
panel.appendChild(readout);

const row = document.createElement('div');
row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
panel.appendChild(row);

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = [
    'padding:4px 9px', 'font:inherit', 'cursor:pointer',
    'background:#fff', 'color:inherit',
    'border:1px solid rgba(0,0,0,0.2)', 'border-radius:5px',
  ].join(';');
  b.onclick = onClick;
  row.appendChild(b);
  return b;
}

const connectButton = button('connect: on', () => {
  connected = !connected;
  connectButton.textContent = `connect: ${connected ? 'on' : 'off'}`;
  refresh();
});

const closedButton = button('closed: on', () => {
  path.closed = !path.closed;
  closedButton.textContent = `closed: ${path.closed ? 'on' : 'off'}`;
  refresh();
});

button('clear', () => {
  path.clear();
  refresh();
});

button('reset window', () => {
  chart.reset();
  refresh();
});

const warning = document.createElement('div');
warning.style.cssText = 'color:#bb2222;min-height:0';
panel.insertBefore(warning, row);

function updateReadout(): void {
  const parts = [`${path.count} points`];
  if (!connected) {
    // Disjoint fibers: every pair of distinct Hopf fibers links exactly once.
    const pairs = (path.count * (path.count - 1)) / 2;
    parts.push(pairs ? `${pairs} linked pairs` : 'click the sphere to add points');
  } else if (path.closed && path.hasCurve) {
    // In units of 4π the enclosed area is the fraction of the sphere, which is
    // also what sets how many times the preimage torus twists.
    parts.push(`area ${(Math.abs(path.enclosedArea()) / (4 * Math.PI)).toFixed(3)} × 4π`);
  } else if (!path.hasCurve) {
    parts.push(path.closed ? 'need 3 for a loop' : 'need 2 for an arc');
  }
  readout.textContent = parts.join('  ·  ');

  // How close the curve runs to the blow-up. Inside DANGER_ANGLE the preimage
  // is being clipped, and the fix is to turn the window rather than redraw.
  let closest = Infinity;
  if (connected && path.hasCurve) {
    for (const p of path.polyline()) closest = Math.min(closest, p.angleTo(singular));
  }
  for (let i = 0; i < path.count; i++) {
    closest = Math.min(closest, path.controlAt(i).angleTo(singular));
  }
  warning.textContent = closest < DANGER_ANGLE
    ? `clipped — drag ${connected ? 'the preimage' : 'a fiber'} to turn the window`
    : '';
}

// --- Go ---------------------------------------------------------------------

refresh();
app.start();

window.addEventListener('beforeunload', () => drag.dispose());
