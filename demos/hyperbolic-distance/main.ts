/**
 * Hyperbolic distance and geodesics on `ℍ²`.
 *
 * The upper half plane carries the metric `ds² = (dx² + dy²) / y²`.
 * Geodesics are either **vertical lines** (when `x_P = x_Q`) or
 * **semicircles centered on the real axis** (otherwise, perpendicular
 * to the boundary). Distance has the closed form
 *
 *   d(P, Q) = arccosh(1 + ‖P − Q‖² / (2 · y_P · y_Q))
 *
 * The big takeaway: **points near the real axis are infinitely far away
 * in the hyperbolic metric.** Drag a point down toward the boundary —
 * Euclidean distance shrinks, hyperbolic distance explodes.
 *
 * Drag P (red) and Q (blue) anywhere in the upper half plane. The
 * geodesic between them and both distance readouts update live.
 */

import * as THREE from 'three';
import { App } from '@/app/App';

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 1.6, 6.5);
app.controls.target.set(0, 1.6, 0);
app.controls.update();
app.controls.controls.enableRotate = false;
app.backgrounds.setColor(0xfafbfc);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.95));

const STAGE = new THREE.Group();
app.scene.add(STAGE);

// Real axis (boundary of ℍ²).
STAGE.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-4.5, 0, 0),
    new THREE.Vector3( 4.5, 0, 0),
  ]),
  new THREE.LineBasicMaterial({ color: 0x222222 }),
));

// Faint reference geodesics (vertical + semicircular).
function buildBackgroundGeodesics() {
  const mat = new THREE.LineBasicMaterial({ color: 0xd5d8e0 });
  const segments = 64;

  for (const x of [-2, -1, 0, 1, 2]) {
    STAGE.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.001, 0),
        new THREE.Vector3(x, 4, 0),
      ]),
      mat,
    ));
  }
  for (const { center, radius } of [
    { center: -1.5, radius: 0.7 },
    { center:  0.0, radius: 1.0 },
    { center:  1.5, radius: 0.7 },
    { center: -1.0, radius: 1.5 },
    { center:  1.0, radius: 1.5 },
  ]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const phi = Math.PI * (i / segments);
      pts.push(new THREE.Vector3(
        center + radius * Math.cos(phi),
        radius * Math.sin(phi),
        0,
      ));
    }
    STAGE.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
}
buildBackgroundGeodesics();

// ── State ──────────────────────────────────────────────────────────

let P: [number, number] = [-1.0, 1.0];
let Q: [number, number] = [ 1.0, 1.0];

// ── Visual elements ────────────────────────────────────────────────

const pDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.13, 24),
  new THREE.MeshBasicMaterial({ color: 0xdd3344 }),
);
const qDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.13, 24),
  new THREE.MeshBasicMaterial({ color: 0x3366cc }),
);
STAGE.add(pDot);
STAGE.add(qDot);

const geodesicLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xee9922, linewidth: 2 }),
);
STAGE.add(geodesicLine);

// ── Geodesic construction ──────────────────────────────────────────

function buildGeodesicPoints(P: [number, number], Q: [number, number], n = 96): THREE.Vector3[] {
  const [xp, yp] = P, [xq, yq] = Q;

  // Vertical case.
  if (Math.abs(xp - xq) < 1e-9) {
    return [
      new THREE.Vector3(xp, Math.min(yp, yq), 0),
      new THREE.Vector3(xp, Math.max(yp, yq), 0),
    ];
  }

  // Semicircle case. Center c on real axis with |c − P|² = |c − Q|².
  //   (xp − c)² + yp² = (xq − c)² + yq²
  //   ⇒ c = (xp² + yp² − xq² − yq²) / (2(xp − xq))
  const c = (xp * xp + yp * yp - xq * xq - yq * yq) / (2 * (xp - xq));
  const r = Math.hypot(xp - c, yp);

  // Walk angles from P's angle to Q's angle along the upper semicircle.
  const tP = Math.atan2(yp, xp - c);   // ∈ (0, π)
  const tQ = Math.atan2(yq, xq - c);   // ∈ (0, π)
  const a0 = Math.min(tP, tQ);
  const a1 = Math.max(tP, tQ);

  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push(new THREE.Vector3(c + r * Math.cos(t), r * Math.sin(t), 0));
  }
  return pts;
}

// ── Distance ───────────────────────────────────────────────────────

function hyperbolicDistance(P: [number, number], Q: [number, number]): number {
  const dx = P[0] - Q[0];
  const dy = P[1] - Q[1];
  const arg = 1 + (dx * dx + dy * dy) / (2 * P[1] * Q[1]);
  return Math.acosh(arg);
}

function euclideanDistance(P: [number, number], Q: [number, number]): number {
  return Math.hypot(P[0] - Q[0], P[1] - Q[1]);
}

// ── Update ──────────────────────────────────────────────────────────

function update() {
  pDot.position.set(P[0], P[1], 0.001);
  qDot.position.set(Q[0], Q[1], 0.001);

  const pts = buildGeodesicPoints(P, Q);
  geodesicLine.geometry.dispose();
  geodesicLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);

  const dH = hyperbolicDistance(P, Q);
  const dE = euclideanDistance(P, Q);

  readoutHyp.textContent = isFinite(dH) ? dH.toFixed(3) : '∞';
  readoutEuc.textContent = dE.toFixed(3);
  readoutP.textContent = `(${P[0].toFixed(2)}, ${P[1].toFixed(2)})`;
  readoutQ.textContent = `(${Q[0].toFixed(2)}, ${Q[1].toFixed(2)})`;
}

// ── Drag interaction ───────────────────────────────────────────────

const canvas = app.renderManager.renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// Invisible plane in the z = 0 plane spans a generous area.
const interactionPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshBasicMaterial({ visible: false }),
);
interactionPlane.position.set(0, 4, 0);   // centered above origin so the whole ℍ² area is covered
STAGE.add(interactionPlane);

let dragging: 'P' | 'Q' | null = null;

function setNdc(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickPlane(): [number, number] | null {
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(interactionPlane);
  if (!hits.length) return null;
  return [hits[0].point.x, hits[0].point.y];
}

function distSq(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

const PICK_RADIUS_SQ = 0.04;   // ~0.2 units in world space

canvas.addEventListener('pointerdown', (e) => {
  setNdc(e);
  const click = pickPlane();
  if (!click) return;

  const dP = distSq(click, P);
  const dQ = distSq(click, Q);
  if (Math.min(dP, dQ) > PICK_RADIUS_SQ) return;   // didn't hit a point

  dragging = dP < dQ ? 'P' : 'Q';
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  setNdc(e);
  const click = pickPlane();
  if (!click) return;

  // Clamp to the upper half plane (with a tiny floor so y > 0 strictly).
  const newP: [number, number] = [click[0], Math.max(click[1], 0.02)];
  if (dragging === 'P') P = newP;
  else                  Q = newP;
  update();
});

canvas.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = null;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  dragging = null;
  app.controls.controls.enabled = true;
});

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#222;font:11px/1.3 monospace;' +
  'background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:230px;z-index:10;' +
  'box-shadow:0 1px 3px rgba(0,0,0,0.12);';
panel.innerHTML = `
  <div style="font-weight:bold;">Hyperbolic distance</div>
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:11px;color:#444;margin-top:4px;">
    <span><span style="color:#dd3344;">P</span></span><span id="hd-P">—</span>
    <span><span style="color:#3366cc;">Q</span></span><span id="hd-Q">—</span>
    <span style="color:#222;font-weight:bold;">d_hyp(P,Q)</span><span id="hd-hyp" style="font-weight:bold;">—</span>
    <span>d_euc(P,Q)</span><span id="hd-euc">—</span>
  </div>
  <div style="font-size:10px;color:#888;margin-top:6px;line-height:1.5;">
    Drag <span style="color:#dd3344;">P</span> or <span style="color:#3366cc;">Q</span>.
    Drag a point near the real axis — Euclidean distance shrinks, hyperbolic
    distance grows without bound. The orange curve is the unique geodesic
    between them.
  </div>
`;
document.body.appendChild(panel);

const readoutP   = panel.querySelector<HTMLSpanElement>('#hd-P')!;
const readoutQ   = panel.querySelector<HTMLSpanElement>('#hd-Q')!;
const readoutHyp = panel.querySelector<HTMLSpanElement>('#hd-hyp')!;
const readoutEuc = panel.querySelector<HTMLSpanElement>('#hd-euc')!;

// ── Boot ────────────────────────────────────────────────────────────

update();
app.start();
