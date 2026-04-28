/**
 * Rotation non-commutativity — SO(3) is non-abelian.
 *
 * Two identical boxes, side by side. Both receive the same pair of
 * rotations — one about `ê_x` by angle `θ₁`, one about `ê_y` by angle
 * `θ₂` — but in opposite orders:
 *
 *   Left  (XthenY):   R_L = exp(θ₂·ê_y) · exp(θ₁·ê_x)
 *   Right (YthenX):   R_R = exp(θ₁·ê_x) · exp(θ₂·ê_y)
 *
 * If `θ₁ = 0` or `θ₂ = 0` the two products agree — that's the trivial
 * commuting case. For any nontrivial pair they differ, and the
 * discrepancy `R_L · R_R⁻¹` is a genuine rotation about an axis given
 * by the commutator `[ê_x, ê_y] = ê_z` (to leading order in small
 * angles, the discrepancy angle is `θ₁ · θ₂`, about `ê_z`).
 *
 * Drag both sliders. At `θ₁ = θ₂ = π/2` the boxes end up in visibly
 * different orientations; the readout shows how far apart they are.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SO3, so3ToMatrix4 } from '@/math';
import { Matrix } from '@/math/linear-algebra';

// ── State ───────────────────────────────────────────────────────────

let theta1 = Math.PI / 2;  // about ê_x
let theta2 = Math.PI / 2;  // about ê_y

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 2.2, 6);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.backgrounds.setColor(0xf4f4f6);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(3, 5, 4);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-2, -1, 3);
app.scene.add(fill);

// Two frames: left (XthenY), right (YthenX). Each is a box + body-frame arrows.

const BOX_SIZE = new THREE.Vector3(1.6, 0.9, 0.4);
const LEFT_POS  = new THREE.Vector3(-1.9, 0, 0);
const RIGHT_POS = new THREE.Vector3( 1.9, 0, 0);

function makeBody(color: number): THREE.Group {
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;

  g.add(new THREE.Mesh(
    new THREE.BoxGeometry(BOX_SIZE.x, BOX_SIZE.y, BOX_SIZE.z),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 }),
  ));

  const L = 1.2, H = 0.22;
  g.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), L, 0xff4444, H, H * 0.6));
  g.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), L, 0x44aa55, H, H * 0.6));
  g.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), L, 0x4477cc, H, H * 0.6));

  return g;
}

const bodyL = makeBody(0xc8d2e0);
const bodyR = makeBody(0xc8d2e0);
app.scene.add(bodyL);
app.scene.add(bodyR);

// ── Fixed world-frame reference axes (between the two boxes) ────────

const refGroup = new THREE.Group();
refGroup.position.set(0, -1.5, 0);
app.scene.add(refGroup);

const REF_LEN = 0.9, REF_HEAD = 0.17;
refGroup.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), REF_LEN, 0xff4444, REF_HEAD, REF_HEAD * 0.6));
refGroup.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), REF_LEN, 0x44aa55, REF_HEAD, REF_HEAD * 0.6));

// ── Update ──────────────────────────────────────────────────────────

function placeBody(group: THREE.Group, R: Matrix, pos: THREE.Vector3) {
  so3ToMatrix4(R, group.matrix);
  group.matrix.setPosition(pos);
}

function update() {
  const Rx = SO3.exp([theta1, 0, 0]);
  const Ry = SO3.exp([0, theta2, 0]);

  // Left: first exp(θ₁·ê_x), then exp(θ₂·ê_y) ⇒ R_L = R_y · R_x.
  const R_L = Ry.multiply(Rx);
  // Right: first exp(θ₂·ê_y), then exp(θ₁·ê_x) ⇒ R_R = R_x · R_y.
  const R_R = Rx.multiply(Ry);

  placeBody(bodyL, R_L, LEFT_POS);
  placeBody(bodyR, R_R, RIGHT_POS);

  // Discrepancy: R_L · R_R⁻¹. The log gives an axis-angle representation
  // whose magnitude is the angular distance between the two frames.
  const diff = R_L.multiply(R_R.transpose());
  const aa = SO3.log(diff);
  const diffAngle = Math.hypot(aa[0], aa[1], aa[2]);

  readoutDiff.textContent = `${diffAngle.toFixed(3)} rad  (${(diffAngle * 180 / Math.PI).toFixed(1)}°)`;
  if (diffAngle > 1e-6) {
    const ax = aa.map((x) => x / diffAngle);
    readoutAxis.textContent = `(${ax[0].toFixed(2)}, ${ax[1].toFixed(2)}, ${ax[2].toFixed(2)})`;
  } else {
    readoutAxis.textContent = '—  (identity)';
  }
}

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#222;font:11px/1.3 monospace;' +
  'background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:220px;z-index:10;' +
  'box-shadow:0 1px 3px rgba(0,0,0,0.12);';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>θ₁ (about ê_x, red)</span><span id="e-t1-val">${theta1.toFixed(2)}</span>
  </label>
  <input id="e-t1" type="range" min="-3.14" max="3.14" step="0.01" value="${theta1}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>θ₂ (about ê_y, green)</span><span id="e-t2-val">${theta2.toFixed(2)}</span>
  </label>
  <input id="e-t2" type="range" min="-3.14" max="3.14" step="0.01" value="${theta2}" style="height:14px;" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#555;margin-top:4px;">
    <span>|R_L · R_R⁻¹|</span><span id="e-diff">—</span>
    <span>axis</span><span id="e-axis">—</span>
  </div>
  <div style="font-size:10px;color:#777;margin-top:4px;line-height:1.4;">
    left:  exp(θ₂·ê_y) · exp(θ₁·ê_x) — x then y<br>
    right: exp(θ₁·ê_x) · exp(θ₂·ê_y) — y then x<br>
    agree iff θ₁ = 0 or θ₂ = 0.
  </div>
`;
document.body.appendChild(panel);

const readoutDiff = panel.querySelector<HTMLSpanElement>('#e-diff')!;
const readoutAxis = panel.querySelector<HTMLSpanElement>('#e-axis')!;

function bindSlider(id: string, valId: string, onChange: (v: number) => void) {
  const s = panel.querySelector<HTMLInputElement>(`#${id}`)!;
  const r = panel.querySelector<HTMLSpanElement>(`#${valId}`)!;
  s.addEventListener('input', () => {
    const v = parseFloat(s.value);
    r.textContent = v.toFixed(2);
    onChange(v);
    update();
  });
}
bindSlider('e-t1', 'e-t1-val', (v) => { theta1 = v; });
bindSlider('e-t2', 'e-t2-val', (v) => { theta2 = v; });

update();
app.start();
