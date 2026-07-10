/**
 * Translation surface — domain ↔ embedding, two panels.
 *
 * Left:  the flat L-shaped domain (three unit squares in the plane).
 * Right: the embedded genus-2 surface (loaded fine config).
 *
 * Both panels render the SAME mesh (same flat (u,v) per vertex, same faces);
 * only the positions differ — flat (u,v,0) on the left, the saved embedding on
 * the right. A single shader, keyed on (u,v), drives both, so anything we draw
 * in the flat domain (straight-line flows, horizontal/vertical foliations, …)
 * shows up consistently on the surface.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { createSurfaceShader } from '@/shaders/SurfaceShader';
import { buildLSurface } from '../translation-surface-relax/buildLSurface';
// `?url` makes vite emit the JSON as an asset and rewrite the URL — works in
// both dev and the relative-base production build (a plain /demos/... fetch
// path is neither copied nor correctly relative once built).
import CONFIG_URL from './fine-config.json?url';

// ── Foliation tuning (edit here) ─────────────────────────────────────────
const DENSITY = 5;     // stripes per period (line spacing = 1/(DENSITY·|(a,b)|))
const MAX_DENOM = 8;   // complexity cap on the snapped rational direction (a,b)

interface Config { N: number; weldedCount: number; coneVertex: number; positions: number[] }

async function init(): Promise<void> {
  const cfg: Config = await fetch(CONFIG_URL).then((r) => {
    if (!r.ok) throw new Error(`could not load ${CONFIG_URL}`);
    return r.json();
  });
  const L = buildLSurface(cfg.N);
  const R = L.render;

  // ── Geometries: shared uv + index, two position sets ────────────────────
  // Flat domain positions: (u−1, v−1, 0) — recenters the L on the origin.
  const flatPos = new Float32Array(R.count * 3);
  for (let r = 0; r < R.count; r++) {
    flatPos[3 * r] = R.uv[2 * r] - 1;
    flatPos[3 * r + 1] = R.uv[2 * r + 1] - 1;
    flatPos[3 * r + 2] = 0;
  }
  // Embedding positions (centered on the centroid).
  const c = [0, 0, 0];
  for (let w = 0; w < cfg.weldedCount; w++) for (let d = 0; d < 3; d++) c[d] += cfg.positions[3 * w + d];
  for (let d = 0; d < 3; d++) c[d] /= cfg.weldedCount;
  const surfPos = new Float32Array(R.count * 3);
  for (let r = 0; r < R.count; r++) {
    const w = R.weldOf[r];
    surfPos[3 * r] = cfg.positions[3 * w] - c[0];
    surfPos[3 * r + 1] = cfg.positions[3 * w + 1] - c[1];
    surfPos[3 * r + 2] = cfg.positions[3 * w + 2] - c[2];
  }

  const makeGeo = (pos: Float32Array): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    g.setIndex(R.indices);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(R.uv.slice(), 2));
    g.computeVertexNormals();
    return g;
  };
  const flatGeo = makeGeo(flatPos);
  const surfGeo = makeGeo(surfPos);

  // ── Shared shader: square base + a static linear foliation ──────────────
  // The foliation is the parallel-line family in direction (cos θ, sin θ);
  // its lines are the level sets of the perpendicular functional
  //   fol = −sin θ · u + cos θ · v        (θ=0 ⇒ horizontal lines, const v).
  const colorGLSL = `
    vec3 colA = vec3(0.55, 0.78, 0.76);
    vec3 colB = vec3(0.92, 0.62, 0.60);
    vec3 colC = vec3(0.62, 0.72, 0.86);
    vec3 base = (uv.x <= 1.0) ? (uv.y <= 1.0 ? colA : colC) : colB;

    // faint square boundaries (integer u, v) so the L structure still reads
    vec2 fb = abs(fract(uv) - 0.5);
    float border = smoothstep(0.47, 0.5, max(fb.x, fb.y));
    base = mix(base, base * 0.7, 0.5 * border);

    // static foliation lines
    float fol = -sin(uAngle) * uv.x + cos(uAngle) * uv.y;
    float s = fol / uSpacing;
    float ff = fract(s);
    float dist = min(ff, 1.0 - ff);          // 0 at a line, →0.5 between
    float aa = fwidth(s);
    float line = 1.0 - smoothstep(0.06, 0.06 + aa, dist);

    return mix(base, vec3(0.10), line);
  `;
  const shader = createSurfaceShader({
    color: colorGLSL,
    uniforms: { uAngle: { value: 0 }, uSpacing: { value: 0.12 } },
  });
  const uvTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  uvTex.needsUpdate = true;
  const common = {
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    uniforms: shader.uniforms,     // shared object → both panels animate in sync
    side: THREE.DoubleSide,
    map: uvTex,
  };
  // Flat panel: unlit (a clean diagram). Surface panel: physically lit.
  const flatMat = new CustomShaderMaterial({ baseMaterial: THREE.MeshBasicMaterial, ...common });
  const surfMat = new CustomShaderMaterial({ baseMaterial: THREE.MeshPhysicalMaterial, ...common, roughness: 0.75, metalness: 0.0, clearcoat: 0.0, envMapIntensity: 0.45 });

  // ── Renderer + two scenes/cameras ───────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf0efe9);
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block; position:fixed; inset:0;';

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const leftScene = new THREE.Scene();
  leftScene.add(new THREE.Mesh(flatGeo, flatMat));

  const rightScene = new THREE.Scene();
  rightScene.environment = envTex;
  rightScene.add(new THREE.Mesh(surfGeo, surfMat));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4, 5, 3);
  rightScene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

  const leftCam = new THREE.OrthographicCamera(-1.4, 1.4, 1.4, -1.4, -10, 10);
  leftCam.position.set(0, 0, 5);
  const rightCam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  rightCam.position.set(6, 4.8, 7.2);   // slightly zoomed out

  // Panel chrome (positioned by applyLayout): an orbit-capture div over the
  // surface panel, two labels, and a divider.
  const surfDiv = document.createElement('div');
  surfDiv.style.cssText = 'position:fixed; z-index:2;';
  document.body.appendChild(surfDiv);
  const controls = new OrbitControls(rightCam, surfDiv);
  controls.enableDamping = true;

  const mkLabel = (text: string): HTMLDivElement => {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = 'position:fixed; z-index:3; font:13px/1.4 ui-monospace,monospace; color:#2c2c2c; opacity:0.65; pointer-events:none;';
    document.body.appendChild(d);
    return d;
  };
  const flatLabel = mkLabel('flat L domain');
  const surfLabel = mkLabel('embedded genus-2 surface');
  const divider = document.createElement('div');
  document.body.appendChild(divider);

  // ── Controls (plain DOM sliders) ────────────────────────────────────────
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed; left:14px; bottom:14px; z-index:3; display:flex; flex-direction:column; gap:8px;' +
    'font:12px/1.4 ui-monospace,monospace; color:#2c2c2c; background:rgba(247,245,240,0.85); padding:10px 12px; border-radius:8px;';
  document.body.appendChild(panel);
  function slider(text: string, min: number, max: number, step: number, value: number, fmt: (v: number) => string, onInput: (v: number) => void): void {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex; flex-direction:column; gap:3px;';
    const cap = document.createElement('span');
    const input = document.createElement('input');
    input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
    input.style.width = '200px';
    const show = (v: number): void => { cap.textContent = text ? `${text} = ${fmt(v)}` : fmt(v); };
    show(value);
    input.addEventListener('input', () => { const v = parseFloat(input.value); show(v); onInput(v); });
    row.append(cap, input);
    panel.appendChild(row);
  }
  // Snap the angle to the best primitive rational direction (a,b) with
  // |a|,|b| ≤ MAX_DENOM; the slider reports only the resulting slope.
  const gcd = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
  function snap(angleDeg: number): { a: number; b: number } {
    const th = (angleDeg * Math.PI) / 180, dx = Math.cos(th), dy = Math.sin(th);
    let bestA = 1, bestB = 0, bestDot = -2;
    for (let a = -MAX_DENOM; a <= MAX_DENOM; a++) for (let b = -MAX_DENOM; b <= MAX_DENOM; b++) {
      if ((a === 0 && b === 0) || gcd(a, b) !== 1) continue;
      const dot = (a * dx + b * dy) / Math.hypot(a, b);
      if (dot > bestDot) { bestDot = dot; bestA = a; bestB = b; }
    }
    if (bestA < 0 || (bestA === 0 && bestB < 0)) { bestA = -bestA; bestB = -bestB; }
    return { a: bestA, b: bestB };
  }
  const slopeStr = (d: { a: number; b: number }): string => (d.a === 0 ? '∞' : d.b === 0 ? '0' : `${d.b}/${d.a}`);
  const apply = (angleDeg: number): void => {
    const d = snap(angleDeg);
    shader.uniforms.uAngle.value = Math.atan2(d.b, d.a);
    shader.uniforms.uSpacing.value = 1 / (DENSITY * Math.hypot(d.a, d.b));
  };
  slider('', 0, 180, 1, 0, (v) => `slope = ${slopeStr(snap(v))}`, apply);
  apply(0);

  // ── Layout + render loop ────────────────────────────────────────────────
  // Two panels: flat domain + surface. Side-by-side on landscape, stacked
  // (flat on top) on portrait/mobile. Rects are in pixels with GL's y-up
  // origin (bottom-left) for setViewport/setScissor.
  type Rect = { x: number; y: number; w: number; h: number };
  let flatRect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let surfRect: Rect = { x: 0, y: 0, w: 1, h: 1 };

  function applyLayout(): void {
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H);
    if (H > W) {                                        // portrait → stack
      const hh = Math.round(H / 2);
      flatRect = { x: 0, y: hh, w: W, h: H - hh };      // flat on top
      surfRect = { x: 0, y: 0, w: W, h: hh };
    } else {                                            // landscape → side by side
      const hw = Math.round(W / 2);
      flatRect = { x: 0, y: 0, w: hw, h: H };
      surfRect = { x: hw, y: 0, w: W - hw, h: H };
    }

    // flat: orthographic, fit a 2·half square to the panel aspect
    const fa = flatRect.w / flatRect.h, half = 1.4;
    if (fa >= 1) { leftCam.left = -half * fa; leftCam.right = half * fa; leftCam.top = half; leftCam.bottom = -half; }
    else { leftCam.left = -half; leftCam.right = half; leftCam.top = half / fa; leftCam.bottom = -half / fa; }
    leftCam.updateProjectionMatrix();
    rightCam.aspect = surfRect.w / surfRect.h;
    rightCam.updateProjectionMatrix();

    // DOM chrome: convert GL y-up rect to CSS top.
    const cssTop = (r: Rect): number => H - (r.y + r.h);
    surfDiv.style.left = `${surfRect.x}px`; surfDiv.style.top = `${cssTop(surfRect)}px`;
    surfDiv.style.width = `${surfRect.w}px`; surfDiv.style.height = `${surfRect.h}px`;
    const place = (el: HTMLDivElement, r: Rect): void => {
      el.style.left = `${r.x + r.w / 2}px`; el.style.top = `${cssTop(r) + 12}px`; el.style.transform = 'translateX(-50%)';
    };
    place(flatLabel, flatRect); place(surfLabel, surfRect);
    divider.style.cssText = H > W
      ? `position:fixed; z-index:3; left:0; top:${cssTop(surfRect)}px; width:100%; height:1px; background:rgba(0,0,0,0.15);`
      : `position:fixed; z-index:3; top:0; left:${flatRect.w}px; width:1px; height:100%; background:rgba(0,0,0,0.15);`;
  }
  window.addEventListener('resize', applyLayout);
  applyLayout();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.setScissorTest(true);
    renderer.setViewport(flatRect.x, flatRect.y, flatRect.w, flatRect.h);
    renderer.setScissor(flatRect.x, flatRect.y, flatRect.w, flatRect.h);
    renderer.render(leftScene, leftCam);
    renderer.setViewport(surfRect.x, surfRect.y, surfRect.w, surfRect.h);
    renderer.setScissor(surfRect.x, surfRect.y, surfRect.w, surfRect.h);
    renderer.render(rightScene, rightCam);
  });
}

init().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed; inset:0; display:flex; align-items:center; justify-content:center; font:14px ui-monospace,monospace; color:#a33;';
  div.textContent = String(err.message ?? err);
  document.body.appendChild(div);
});
