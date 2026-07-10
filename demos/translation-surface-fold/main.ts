/**
 * Translation surface fold — the L-surface (H(2)) folding into genus 2.
 *
 * The "L" is three unit squares
 *     A = [0,1]×[0,1]   B = [1,2]×[0,1]   C = [0,1]×[1,2]
 * with opposite sides identified by translation:
 *     g1: bottom-A (y=0) ↔ top-C   (y=2)   — vertical (0,2)
 *     g2: bottom-B (y=0) ↔ top-B   (y=1)   — vertical (0,1)
 *     g3: left-A   (x=0) ↔ right-B (x=2)   — horizontal (2,0)
 *     g4: left-C   (x=0) ↔ right-C (x=1)   — horizontal (1,0)
 * This is the genus-2 surface in stratum H(2): one cone point of angle 6π.
 *
 * STAGE 1 (this build): the vertical cylinder decomposition.
 *   - left column A∪C  (circumference 2)  →  fat tube,  radius 1/π
 *   - right square B    (circumference 1)  →  thin tube, radius 1/2π
 * Each is an isometric strip→cylinder roll driven by τ∈[0,1] (g1, g2).
 * The remaining gluings g3, g4 — the half-rim routing that closes the genus
 * and forms the cone point — are STAGE 2/3, tuned next.
 *
 * The surface is textured by its flat (u,v) coordinates so the three squares
 * and the unit grid stay legible through the fold.
 */

import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { App } from '@/app/App';
import { createSurfaceShader } from '@/shaders/SurfaceShader';

// ── The L, as three squares sampled on a grid ────────────────────────────

interface Square {
  uMin: number; uMax: number;
  vMin: number; vMax: number;
}

const SQUARES: Square[] = [
  { uMin: 0, uMax: 1, vMin: 0, vMax: 1 }, // A  bottom-left
  { uMin: 1, uMax: 2, vMin: 0, vMax: 1 }, // B  bottom-right
  { uMin: 0, uMax: 1, vMin: 1, vMax: 2 }, // C  top-left
];

const RES = 48;            // grid cells per unit square edge
const TAU_MIN = 1e-3;      // avoid the 1/τ singularity at the flat state

const R_FAT = 1 / Math.PI;        // left column: circumference 2
const R_THIN = 1 / (2 * Math.PI); // right square: circumference 1

// Live-tuned Stage-2 parameters (wired to sliders below).
const P = {
  closeFat: 1.0,    // how far the fat tube revolves toward a closed torus (×2π)
  Rmajor: 0.62,     // major radius of the fat torus (> R_FAT to keep a hole)
  gap: 0.9,         // angle the green (A) arc lags behind blue, opening the mouth
  bulge: 0.45,      // how far B bulges out of the mouth to form the handle
};

// Mouth profile on the green (A) arc, v∈[0,1]: zero at BOTH junctions v=0 and
// v=1 (where green meets blue — those stay fused), peaking at the middle v=0.5.
// So the wedge opens strictly between the two green lips and never unpairs blue.
const greenWeight = (v: number) => { const s = Math.sin(Math.PI * v); return v < 1 ? s * s : 0; };

const smooth = (x: number) => x * x * (3 - 2 * x);

// Bend a straight tube (axis +X, from u0, length len) into a circular arc of
// total angle Θ in the X–Z plane. (a, b) = cross-section offset from centerline
// in (Y, Z); `h` = centerline height. Θ→0 recovers the straight tube in place.
function bend(
  u: number, u0: number, len: number,
  a: number, b: number, h: number, Theta: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const cx = u0 + len / 2;
  const s = u - cx;
  if (Math.abs(Theta) < 1e-4) { out.set(cx + s, a, h + b); return out; }
  const rho = len / Theta;
  const phi = s / rho;
  out.set(cx + (rho - b) * Math.sin(phi), a, h + rho * (1 - Math.cos(phi)) + b * Math.cos(phi));
  return out;
}

// ── Fat-tube revolve, as a true rotational bend ──────────────────────────
// The fat tube's axis (u∈[0,1]) bends around a major circle in the z=R_FAT
// plane. The cross-section rides a moving frame (genuine rotation — no lerp,
// so no crumpling/self-intersection). Major angle Θ = 2π·closeFat·w sweeps the
// tube up; radius ρ = max(Rmajor, 1/Θ) keeps it isometric while gently curling,
// then holds Rmajor fixed as it closes so the donut hole stays open.
let _Theta = 0;        // total major sweep angle (blue arc)
let _rho = Infinity;   // major radius
let _gap = 0;          // green-arc lag angle (mouth opening), ramped in
let _straight = true;  // Θ ≈ 0 ⇒ Stage-1 straight tube

// Rigid carry frame of the fat tube's u=1 end; B is glued there and rides it.
const _R = new THREE.Matrix3();
const _p0 = new THREE.Vector3(1, 0, R_FAT);   // fat u=1 centerline, straight
const _p1 = new THREE.Vector3();
const _ex = new THREE.Vector3();
const _ey = new THREE.Vector3();
const _ez = new THREE.Vector3();

// Red-handle frame: centroids of the two green lips and a cross-section basis.
const _Nc = new THREE.Vector3();   // near lip (u=1) centroid
const _Fc = new THREE.Vector3();   // far  lip (u=0) centroid
const _axis = new THREE.Vector3(); // handle axis (Nc → Fc)
const _n1 = new THREE.Vector3();   // outward, ⟂ axis (also the bulge direction)
const _n2 = new THREE.Vector3();   // axis × n1
const _c = new THREE.Vector3();

function updateCarry(tau: number): void {
  const w = smooth(Math.max(Math.min(tau - 1, 1), 0));
  _Theta = 2 * Math.PI * P.closeFat * w;
  _gap = P.gap * w;
  _straight = _Theta < 1e-4;
  if (_straight) { _rho = Infinity; _p0.set(1, 0, R_FAT); _p1.set(1, 0, R_FAT); _R.identity(); return; }
  _rho = Math.max(P.Rmajor, 1 / _Theta);
  const phe = _Theta;                                   // major angle at u=1
  _ex.set(Math.cos(phe), Math.sin(phe), 0);             // tangent
  _ey.set(-Math.sin(phe), Math.cos(phe), 0);            // inward normal (toward center)
  _ez.set(0, 0, 1);                                     // up
  _R.set(_ex.x, _ey.x, _ez.x, _ex.y, _ey.y, _ez.y, _ex.z, _ey.z, _ez.z);
  _p0.set(1, 0, R_FAT);
  _p1.set(_rho * Math.sin(phe), _rho * (1 - Math.cos(phe)), R_FAT);

  // Red-handle frame from the two green lips (sampled centroids).
  _Nc.set(0, 0, 0); _Fc.set(0, 0, 0);
  for (let i = 0; i <= 6; i++) {
    foldFat(1, i / 6, 1, _c); _Nc.add(_c);
    foldFat(0, i / 6, 1, _c); _Fc.add(_c);
  }
  _Nc.multiplyScalar(1 / 7); _Fc.multiplyScalar(1 / 7);
  _axis.subVectors(_Fc, _Nc).normalize();
  _n1.addVectors(_Nc, _Fc).multiplyScalar(0.5);   // lip midpoint …
  _n1.y -= _rho; _n1.z -= R_FAT;                   // … minus donut center O ⇒ outward
  _n1.addScaledVector(_axis, -_n1.dot(_axis)).normalize();  // make it ⟂ axis
  _n2.crossVectors(_axis, _n1);
}

// Fat tube / torus point. u∈[0,1] axis, v∈[0,2] cross-section. Used both for
// the fat surface itself and to read off the two green mouth-lips that B glues
// to (its u=1 rim and u=0 rim).
function foldFat(u: number, v: number, roll: number, out: THREE.Vector3): THREE.Vector3 {
  const r = R_FAT / roll;
  const alpha = Math.PI * roll * v;
  const a = r * Math.sin(alpha);
  const bz = -r * Math.cos(alpha);
  if (_straight) { out.set(u, a, r + bz); return out; }
  // blue (v∈[1,2]) sweeps the full Θ and fuses; green (v∈[0,1]) lags by _gap·u,
  // opening the mouth.
  const phi = u * (_Theta - _gap * greenWeight(v));
  const sinp = Math.sin(phi), cosp = Math.cos(phi);
  // a>0 pushes OUTWARD (green on the outside, blue fuses on the inside), so the
  // mouth faces open space and the red handle bulges out cleanly.
  out.set((_rho + a) * sinp, _rho * (1 - cosp) - a * cosp, R_FAT + bz);
  return out;
}

// Full fold. τ∈[0,1]: roll each vertical cylinder into a tube (Stage 1, g1/g2).
// τ∈[1,2]: revolve the fat tube into a torus (mouth open on green) and sew B in
// as a tube bridging the two green lips — gluing B's free edge to the green edge
// (g3) — bulging outward to form the second handle (Stage 2).
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _near = new THREE.Vector3();
const _far = new THREE.Vector3();
const _mem = new THREE.Vector3();
const _tmp = new THREE.Vector3();
function fold(u: number, v: number, tau: number, out: THREE.Vector3): THREE.Vector3 {
  const roll = Math.max(Math.min(tau, 1), TAU_MIN);
  const w = smooth(Math.max(Math.min(tau - 1, 1), 0));   // Stage-2 (glue flat)

  if (u <= 1) {
    foldFat(u, v, roll, out);
    return out;
  }

  // right square B. Stage 1: carried thin tube (continuity with the roll).
  const r = R_THIN / roll;
  const beta = 2 * Math.PI * roll * v;
  bend(u, 1, 1, r * Math.sin(beta), -r * Math.cos(beta), r, 0, _q);
  _q.sub(_p0).applyMatrix3(_R).add(_p1);
  if (w <= 1e-6) { out.copy(_q); return out; }

  // Stage 2: glue red FLAT as a membrane — its u-edges lie on the two green
  // lips (s=0 → u=1 lip / A|B seam, s=1 → u=0 lip / g3); v-edges still free.
  const s = u - 1;
  foldFat(1, v, roll, _near);
  foldFat(0, v, roll, _far);
  _mem.lerpVectors(_near, _far, s);

  const c = smooth(Math.max(Math.min(tau - 2, 1), 0));   // Stage-3 (stretch g2)
  if (c <= 1e-6) { out.lerpVectors(_q, _mem, w); return out; }

  // Stage 3: stretch the free v-edges together (g2), rolling red into the tube.
  _p.lerpVectors(_Nc, _Fc, s);                           // centerline Nc → Fc
  _p.addScaledVector(_n1, P.bulge * Math.sin(Math.PI * s));
  const ang = 2 * Math.PI * v;                           // circular cross-section
  _p.addScaledVector(_n1, R_THIN * Math.cos(ang));
  _p.addScaledVector(_n2, R_THIN * Math.sin(ang));

  _tmp.lerpVectors(_q, _mem, w);
  out.lerpVectors(_tmp, _p, c);
  return out;
}

// ── Mesh: one BufferGeometry over all three squares ──────────────────────

class FoldSurface extends THREE.Mesh {
  private us: Float32Array;
  private vs: Float32Array;

  constructor(material: THREE.Material) {
    super();

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const usArr: number[] = [];
    const vsArr: number[] = [];

    let base = 0;
    for (const sq of SQUARES) {
      for (let i = 0; i <= RES; i++) {
        const v = sq.vMin + (sq.vMax - sq.vMin) * (i / RES);
        for (let j = 0; j <= RES; j++) {
          const u = sq.uMin + (sq.uMax - sq.uMin) * (j / RES);
          positions.push(0, 0, 0);
          uvs.push(u, v);     // raw flat coordinates, in [0,2]
          usArr.push(u);
          vsArr.push(v);
        }
      }
      for (let i = 0; i < RES; i++) {
        for (let j = 0; j < RES; j++) {
          const a = base + i * (RES + 1) + j;
          const b = base + (i + 1) * (RES + 1) + j;
          const c = base + i * (RES + 1) + (j + 1);
          const d = base + (i + 1) * (RES + 1) + (j + 1);
          indices.push(a, c, b, b, c, d);
        }
      }
      base += (RES + 1) * (RES + 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
    this.geometry = geo;
    this.material = material;

    this.us = new Float32Array(usArr);
    this.vs = new Float32Array(vsArr);

    this.setTau(0);
  }

  setTau(tau: number): void {
    updateCarry(tau);
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < this.us.length; k++) {
      fold(this.us[k], this.vs[k], tau, _p);
      pos.setXYZ(k, _p.x, _p.y, _p.z);
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

// ── Shader: colour by flat (u,v) ─────────────────────────────────────────

const colorGLSL = `
  vec3 colA = vec3(0.24, 0.58, 0.56);  // teal  — square A
  vec3 colB = vec3(0.80, 0.31, 0.29);  // red   — square B
  vec3 colC = vec3(0.30, 0.45, 0.69);  // blue  — square C
  vec3 base = (uv.x <= 1.0)
    ? (uv.y <= 1.0 ? colA : colC)
    : colB;

  // dark lines at integer (u,v): square boundaries + saddle connections
  vec2 f = abs(fract(uv) - 0.5);
  float edge = smoothstep(0.44, 0.5, max(f.x, f.y));
  vec3 col = base * (1.0 - 0.65 * edge);

  // fine grid texture
  col += 0.25 * vec3(coordGrid(uv, 1.0));
  return col;
`;

const shader = createSurfaceShader({ color: colorGLSL });

const uvEnableTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
uvEnableTex.needsUpdate = true;

const material = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  vertexShader: shader.vertexShader,
  fragmentShader: shader.fragmentShader,
  uniforms: shader.uniforms,
  side: THREE.DoubleSide,
  map: uvEnableTex,
  roughness: 0.35,
  metalness: 0.0,
  clearcoat: 0.4,
});

// ── Scene ────────────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: true });
app.camera.fov = 28;
app.camera.updateProjectionMatrix();
app.camera.position.set(1, 2.2, 4.2);
app.controls.target.set(1, 0.4, 0.3);
app.controls.update();

app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: false,
  intensity: 1.4,
});
app.backgrounds.setColor(0xf0efe9);

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 5, 3);
app.scene.add(key);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const surface = new FoldSurface(material);
app.scene.add(surface);

// ── Controls ──────────────────────────────────────────────────────────────

let animate = false;
let tau = 2;

app.overlay.addSlider({
  label: 'Fold',
  min: 0, max: 3, step: 0.001, value: tau,
  format: (v: number) => `τ = ${v.toFixed(2)}  (1 tubes · 2 red flat · 3 red tube)`,
  onChange: (v: number) => { animate = false; tau = v; surface.setTau(v); },
});

const reTune = () => surface.setTau(tau);
app.overlay.addSlider({
  label: 'Close fat', min: 0, max: 1, step: 0.001, value: P.closeFat,
  format: (v: number) => `close fat = ${v.toFixed(2)}`,
  onChange: (v: number) => { P.closeFat = v; reTune(); },
});
app.overlay.addSlider({
  label: 'Major radius', min: 0.32, max: 1.5, step: 0.001, value: P.Rmajor,
  format: (v: number) => `major R = ${v.toFixed(2)}`,
  onChange: (v: number) => { P.Rmajor = v; reTune(); },
});
app.overlay.addSlider({
  label: 'Gap', min: 0, max: 2.4, step: 0.001, value: P.gap,
  format: (v: number) => `gap = ${v.toFixed(2)} rad`,
  onChange: (v: number) => { P.gap = v; reTune(); },
});
app.overlay.addSlider({
  label: 'Bulge', min: 0, max: 1.5, step: 0.001, value: P.bulge,
  format: (v: number) => `bulge = ${v.toFixed(2)}`,
  onChange: (v: number) => { P.bulge = v; reTune(); },
});

surface.setTau(tau);

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') animate = !animate;
});

// auto fold / hold / unfold loop over the full τ∈[0,3] range
const FOLD = 8, HOLD = 2;
const PERIOD = 2 * (FOLD + HOLD);
app.addAnimateCallback((elapsed: number) => {
  if (!animate) { surface.setTau(tau); return; }
  const phase = elapsed % PERIOD;
  if (phase < FOLD) tau = 1.5 * (1 - Math.cos(Math.PI * phase / FOLD));          // 0 → 3
  else if (phase < FOLD + HOLD) tau = 3;
  else if (phase < 2 * FOLD + HOLD) tau = 1.5 * (1 + Math.cos(Math.PI * (phase - FOLD - HOLD) / FOLD)); // 3 → 0
  else tau = 0;
  surface.setTau(tau);
});

app.start();
