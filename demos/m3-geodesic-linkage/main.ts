/**
 * m3-geodesic-linkage — physical motion of the 3-rod linkage.
 *
 * Same two-panel layout as m3-parametric-linkage (configuration circle left,
 * 3-rod chain right), but the ball is not sliding round at constant angular
 * rate. It is following a *geodesic of the kinetic-energy metric*: the actual
 * unforced motion of the mechanism, coasting with no applied force.
 *
 * ## What the metric is
 *
 * The configuration space M³_L is a circle, so there is only one path to take
 * and the whole content of "geodesic" is the *pacing*. Give the two moving
 * joints unit masses; the kinetic energy of a motion ṫ is
 *
 *     2T = |ṗ₁|² + |ṗ₂|² = h(t) ṫ²
 *
 * and it turns out that
 *
 *     h(t) = θ₁′² + θ₃′²
 *
 * where θ₁ and θ₃ are the angles of the two rods attached to the pins. The
 * reason is immediate once seen: each moving joint hangs at unit distance from
 * a *pinned* point — p₁ = e^{iθ₁} about the origin and p₂ = L − e^{iθ₃} about
 * (L, 0) — so each joint's speed is exactly its rod's angular rate, and the
 * middle rod's angle never enters. Equivalently: M³_L is a curve in the flat
 * torus of rod angles, and the kinetic-energy metric is the flat metric it
 * inherits from that torus.
 *
 * ## Why there is no integrator here
 *
 * In one dimension the geodesic equation has the first integral h ṫ², so it
 * needs no stepping: the motion is uniform in arclength, and
 *
 *     dt/dτ = v / √(h(t)).
 *
 * `MetricCircle` carries that arclength coordinate, which is why the speed can
 * never drift no matter how long the demo runs. (`GeodesicIntegrator` is for
 * surfaces and refuses dim ≠ 2 anyway.)
 *
 * The ticks around the circle are spaced equally in *metric* arclength: where
 * they crowd together the linkage is heavy and the ball crawls, where they
 * spread out it races. Drag the ball and release to kick it; the speed you
 * release with is the speed it keeps. Verified in scripts/validate-m3.ts.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { fitView } from '@/scene/fitView';
import { MetricCircle, type CircleGeodesic } from '@/math/manifolds';
import { DragBehavior } from '@/interaction/DragBehavior';

// --- Palette (shared with the other m3/m4 demos) ----------------------------

const BG = 0xF0EDE8;
const BURGUNDY = 0x7A1F2C;
const SILVER = 0xBCB6AC;
const SEPIA = 0x8C7B62;

// --- ψ³_L in rod-angle form -------------------------------------------------
//
// Taken from m3-parametric-torus rather than the position form used by
// m3-parametric-linkage: the position form divides by the amplitude ν, whose
// 0/0 limit at cos t = 0 it mishandles, and the angles are what the metric
// wants anyway.

function psi3Angles(t: number, L: number): [number, number, number] {
  const alpha = Math.acos((L * L - 3) / (2 * L));
  const theta = alpha * Math.sin(t);
  const sigma = Math.cos(t) >= 0 ? 1 : -1;
  const d = Math.sqrt(L * L - 2 * L * Math.cos(theta) + 1);
  const R = Math.atan2(-Math.sin(theta), L - Math.cos(theta));
  const beta = Math.acos(Math.min(1, d / 2));
  return [R + sigma * beta, R - sigma * beta, theta];
}

/** Joint positions, with the chain centred on the origin for presentation. */
function joints(t: number, L: number): { p1: [number, number]; p2: [number, number] } {
  const [th1, , th3] = psi3Angles(t, L);
  const dx = -L / 2;
  return {
    p1: [Math.cos(th1) + dx, Math.sin(th1)],
    p2: [L - Math.cos(th3) + dx, -Math.sin(th3)],
  };
}

/** sin(x)/x, continued to 1 at the origin. */
const sinc = (x: number) => (Math.abs(x) < 1e-8 ? 1 : Math.sin(x) / x);

/**
 * h(t) = θ₃′² + θ₁′², the kinetic-energy metric.
 *
 * The delicate term is w = σθ₃′/ν, which is 0/0 at both straightened
 * configurations. Written directly as α|cos t| / √(2L cos θ − L² + 3) the
 * denominator is an O(1e-12) difference of O(1) terms there and loses every
 * significant digit. Using 2L(cos θ − cos α) = 4L sin A sin B with
 * A = (α+θ)/2 and B = (α−θ)/2, together with cos²t = (α² − θ²)/α², the whole
 * ratio cancels analytically down to w² = (A/sin A)(B/sin B)/L — exact,
 * branch-free, and stable at both ends.
 */
function metric3(t: number, L: number): number {
  const alpha = Math.acos((L * L - 3) / (2 * L));
  const theta = alpha * Math.sin(t);
  const dtheta = alpha * Math.cos(t);                 // θ₃′
  const ctheta = Math.cos(theta);
  const stheta = Math.sin(theta);
  const r = Math.sqrt(L * L - 2 * L * ctheta + 1);    // |p₂|

  const w = Math.sqrt(1 / (L * sinc((alpha + theta) / 2) * sinc((alpha - theta) / 2)));
  const dth1 = ((1 - L * ctheta) / (r * r)) * dtheta - (L * stheta / r) * w;
  return dtheta * dtheta + dth1 * dth1;
}

// --- State ------------------------------------------------------------------

let L = 1.5;   // small enough that the pacing is dramatic — see the readout
const INITIAL_SPEED = 2.2;
const MIN_SPEED = 0.25;
const MAX_SPEED = 14;

let circle = new MetricCircle({ metric: (t) => metric3(t, L) });
let motion: CircleGeodesic = circle.geodesic(0, INITIAL_SPEED);

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 5);
app.controls.target.set(0, 0, 0);
// Blog iframes are narrower than the window this was laid out in, and a
// fixed camera would let the two panels run off the sides. Extents cover
// the widest linkage the L slider allows, so the framing is stable as L
// moves; on a viewport wide enough for the intended framing this is a
// no-op.
fitView(app.camera, app.controls.target, { halfWidth: 6.8, halfHeight: 2.0 });
app.controls.controls.enabled = false;   // 2D scene
app.backgrounds.setColor(BG);

app.scene.add(new THREE.AmbientLight(0xfff3e0, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(4, 5, 6);
app.scene.add(key);

const fill = new THREE.DirectionalLight(0xffe6c4, 0.7);
fill.position.set(-5, -2, 4);
app.scene.add(fill);

const rim = new THREE.DirectionalLight(0xfff8ec, 0.6);
rim.position.set(-2, 4, -3);
app.scene.add(rim);

const rodMat = new THREE.MeshPhysicalMaterial({
  color: SILVER, roughness: 0.32, metalness: 0.85,
  clearcoat: 0.4, clearcoatRoughness: 0.25,
});
const burgundyMat = new THREE.MeshPhysicalMaterial({
  color: BURGUNDY, roughness: 0.22, metalness: 0.05,
  clearcoat: 0.8, clearcoatRoughness: 0.18,
});
const tickMat = new THREE.MeshPhysicalMaterial({
  color: SEPIA, roughness: 0.45, metalness: 0.1,
});

// === LEFT PANEL: the configuration circle ===

const CIRCLE_R = 1.4;
const circleGroup = new THREE.Group();
circleGroup.position.set(-3.2, 0, 0);
app.scene.add(circleGroup);

const ring = new THREE.Mesh(new THREE.TorusGeometry(CIRCLE_R, 0.045, 12, 128), rodMat);
circleGroup.add(ring);

const circleBall = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), burgundyMat);
circleGroup.add(circleBall);

// The drawn ring is only a few pixels wide, which makes it a fussy thing to
// grab. This invisible fatter torus is what picking actually tests against, so
// anywhere near the ring counts as a grab.
const grabRing = new THREE.Mesh(
  new THREE.TorusGeometry(CIRCLE_R, 0.28, 8, 64),
  new THREE.MeshBasicMaterial({ visible: false }),
);
circleGroup.add(grabRing);

/**
 * Ticks at equal metric arclength.
 *
 * This is the metric made visible. The circle is drawn round, but the ball is
 * not moving round it uniformly — it covers equal *arclength* per unit time, so
 * it takes the same time between any two neighbouring ticks however unevenly
 * they are spaced. Bunched ticks are where the linkage is heavy.
 */
const TICK_COUNT = 48;
const tickGroup = new THREE.Group();
circleGroup.add(tickGroup);

const tickGeo = new THREE.BoxGeometry(0.02, 0.19, 0.02);

function rebuildTicks(): void {
  for (const child of tickGroup.children) (child as THREE.Mesh).geometry.dispose?.();
  tickGroup.clear();
  for (const t of circle.equallySpaced(TICK_COUNT)) {
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.set(CIRCLE_R * Math.cos(t), CIRCLE_R * Math.sin(t), 0);
    tick.rotation.z = t - Math.PI / 2;
    tickGroup.add(tick);
  }
}

// === RIGHT PANEL: the 3-rod chain ===

const CHAIN_SCALE = 1.6;
const chainGroup = new THREE.Group();
chainGroup.position.set(2.6, 0, 0);
chainGroup.scale.setScalar(CHAIN_SCALE);
app.scene.add(chainGroup);

const ROD_RADIUS = 0.05;
const rodGeo = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, 1, 16, 1);
const rod1 = new THREE.Mesh(rodGeo, rodMat);
const rod2 = new THREE.Mesh(rodGeo, rodMat);
const rod3 = new THREE.Mesh(rodGeo, rodMat);
chainGroup.add(rod1, rod2, rod3);

const pinGeo = new THREE.SphereGeometry(0.13, 24, 24);
const jointGeo = new THREE.SphereGeometry(0.10, 24, 24);
const pinA = new THREE.Mesh(pinGeo, burgundyMat);
const pinB = new THREE.Mesh(pinGeo, burgundyMat);
const joint1 = new THREE.Mesh(jointGeo, burgundyMat);
const joint2 = new THREE.Mesh(jointGeo, burgundyMat);
chainGroup.add(pinA, pinB, joint1, joint2);

const _yAxis = new THREE.Vector3(0, 1, 0);
function placeRod(rod: THREE.Mesh, ax: number, ay: number, bx: number, by: number): void {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  rod.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  rod.scale.set(1, len, 1);
  rod.quaternion.setFromUnitVectors(_yAxis, new THREE.Vector3(dx / len, dy / len, 0));
}

// --- Update -----------------------------------------------------------------

function update(): void {
  const t = motion.t;

  circleBall.position.set(CIRCLE_R * Math.cos(t), CIRCLE_R * Math.sin(t), 0);

  const { p1, p2 } = joints(t, L);
  const ax = -L / 2, bx = L / 2;
  pinA.position.set(ax, 0, 0);
  pinB.position.set(bx, 0, 0);
  joint1.position.set(p1[0], p1[1], 0);
  joint2.position.set(p2[0], p2[1], 0);

  placeRod(rod1, ax, 0, p1[0], p1[1]);
  placeRod(rod2, p1[0], p1[1], p2[0], p2[1]);
  placeRod(rod3, p2[0], p2[1], bx, 0);
}

function rebuildMetric(): void {
  const t = motion.t;
  const v = motion.speed;
  circle = new MetricCircle({ metric: (x) => metric3(x, L) });
  motion = circle.geodesic(t, v);
  rebuildTicks();
  updateReadout();
}

// --- Kick it ----------------------------------------------------------------

// Drag the ball round the circle; the rate you release at becomes the metric
// speed it keeps. Unlike m4-geodesic-linkage this does not normalize the kick away —
// on a circle the direction is already decided, so the magnitude is the only
// thing a push can contribute.

const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hit = new THREE.Vector3();

/** Speed at the moment of grabbing, so a press that is not a kick can restore it. */
let speedBeforeGrab = INITIAL_SPEED;

type Sample = { time: number; t: number };
const samples: Sample[] = [];
const SAMPLES_KEPT = 5;

function angleFrom(raycaster: THREE.Raycaster): number | null {
  if (!raycaster.ray.intersectPlane(planeZ, hit)) return null;
  const local = circleGroup.worldToLocal(hit.clone());
  return Math.atan2(local.y, local.x);
}

const drag = new DragBehavior<true>({
  camera: app.camera,
  domElement: app.renderManager.renderer.domElement,

  onDragStart: ({ raycaster, event }) => {
    if (!raycaster.intersectObjects([grabRing, circleBall], false).length) return null;
    const angle = angleFrom(raycaster);
    if (angle === null) return null;
    samples.length = 0;
    samples.push({ time: event.timeStamp, t: angle });
    speedBeforeGrab = Math.abs(motion.speed);
    motion.speed = 0;
    motion.setParameter(angle);
    update();
    return true;
  },

  onDrag: (_h, { raycaster, event }) => {
    const angle = angleFrom(raycaster);
    if (angle === null) return;
    motion.setParameter(angle);
    samples.push({ time: event.timeStamp, t: angle });
    if (samples.length > SAMPLES_KEPT) samples.shift();
    update();
  },

  onDragEnd: () => {
    // A press that produced no usable motion is a reposition, not a kick, so it
    // resumes at the speed it had rather than stopping. Leaving it at zero
    // would mean a single stray click on the ring kills the demo for good — a
    // dead end a reader has no way out of.
    const resume = () => {
      motion.speed = speedBeforeGrab || INITIAL_SPEED;
      updateReadout();
    };
    if (samples.length < 2) return resume();
    const first = samples[0];
    const last = samples[samples.length - 1];
    const wall = (last.time - first.time) / 1000;
    if (wall <= 0) return resume();

    // Shorter arc, so a drag across the ±π seam does not read as a huge jump.
    let dt = last.t - first.t;
    if (dt > Math.PI) dt -= 2 * Math.PI;
    if (dt < -Math.PI) dt += 2 * Math.PI;

    // Convert the parameter rate the reader released at into a metric speed —
    // the conserved quantity — so the kick means the same thing wherever on the
    // circle it was given.
    const v = circle.speedOf(last.t, dt / wall);
    const magnitude = Math.min(Math.max(Math.abs(v), MIN_SPEED), MAX_SPEED);
    motion.speed = v < 0 ? -magnitude : magnitude;
    updateReadout();
  },
});

// --- UI ---------------------------------------------------------------------

const style = document.createElement('style');
style.textContent = `
  .slider-wrapper {
    position: absolute; bottom: 16px; right: 16px; left: auto;
    max-width: 33%; min-width: 200px; padding: 8px 10px;
    background: transparent; pointer-events: auto; z-index: 10;
  }
  .thin-slider {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 5px; margin: 0;
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
  .thin-slider:focus { outline: none; }
  .readout {
    position: absolute; bottom: 16px; left: 16px; z-index: 10;
    font: 12px/1.6 ui-monospace, monospace; color: #5A5148;
    font-variant-numeric: tabular-nums;
  }
`;
document.head.appendChild(style);

const sliderWrap = document.createElement('div');
sliderWrap.className = 'slider-wrapper';
sliderWrap.innerHTML = `<input id="psi3-L" type="range" class="thin-slider"
  min="1.05" max="2.95" step="0.01" value="${L}" />`;
document.body.appendChild(sliderWrap);

sliderWrap.querySelector<HTMLInputElement>('#psi3-L')!.addEventListener('input', (e) => {
  L = parseFloat((e.target as HTMLInputElement).value);
  rebuildMetric();
});

const readout = document.createElement('div');
readout.className = 'readout';
document.body.appendChild(readout);

function updateReadout(): void {
  // The spread of √h is exactly how unevenly the ball paces the circle, so it
  // says up front how much there is to see at this L.
  let lo = Infinity;
  let hi = 0;
  for (let i = 0; i < 720; i++) {
    const s = circle.speed((i / 720) * 2 * Math.PI);
    lo = Math.min(lo, s);
    hi = Math.max(hi, s);
  }
  readout.innerHTML = [
    `L = ${L.toFixed(2)}`,
    `metric circumference ${circle.circumference.toFixed(2)}`,
    `pacing varies ${(hi / lo).toFixed(1)}×`,
    `speed ${Math.abs(motion.speed).toFixed(2)}`,
  ].join('<br>');
}

// --- Go ---------------------------------------------------------------------

app.addAnimateCallback((_time, delta) => {
  // One multiply on the arclength coordinate — the closed-form geodesic flow.
  if (motion.speed !== 0) motion.advance(delta);
  update();
});

rebuildTicks();
updateReadout();
update();
app.start();

window.addEventListener('beforeunload', () => drag.dispose());
