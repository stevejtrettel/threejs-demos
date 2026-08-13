/**
 * Refine — upsample a saved coarse L-surface embedding to a fine mesh and
 * smooth it into a nice genus-2 surface.
 *
 *   1. Load the relaxed coarse config (default N=10) saved by the relax demo.
 *   2. Build a fine mesh (FINE_N, e.g. 100) and seed it by bilinearly
 *      interpolating the coarse embedding at each fine vertex's flat (u,v).
 *   3. Taubin-smooth (shrink-free Laplacian) to remove the coarse faceting.
 *
 * The coarse embedding is already an embedded genus-2 surface, so the fine
 * seed is embedded too; gentle smoothing keeps it that way while polishing it.
 */

import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { App } from '@/app/App';
import { HalfEdgeMesh } from '@/math/mesh/HalfEdgeMesh';
import { Embedding } from '@/math/mesh/Embedding';
import { createSurfaceShader } from '@/shaders/SurfaceShader';
import { type LSurface } from '../translation-surface-relax/buildLSurface';
import { SURFACES, currentSurface, configPath, surfaceDropdown } from '../translation-surface-relax/surfaces';
import studioHDR from '@assets/hdri/studio.hdr';

const SURF = currentSurface();
const FINE_N = SURFACES[SURF].fineN;
const build = SURFACES[SURF].build;
const COARSE_URL = '/' + configPath('relaxed', SURF);

interface CoarseConfig { N: number; weldedCount: number; positions: number[] }

// Coarse position field: bilinear interpolation of the coarse welded positions
// at a flat (square, u, v). Continuous across gluings because shared edge
// vertices are welded (identical from either side).
function makeCoarseField(coarse: LSurface, cfg: CoarseConfig) {
  const Nc = coarse.N;
  const stride = (Nc + 1) * (Nc + 1);
  const weld = (s: number, i: number, j: number): number => coarse.render.weldOf[s * stride + j * (Nc + 1) + i];
  const P = cfg.positions;
  const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
  return (square: number, u: number, v: number, out: Float32Array): void => {
    let gu: number, gv: number;
    if (square === 0) { gu = u * Nc; gv = v * Nc; }          // A
    else if (square === 1) { gu = (u - 1) * Nc; gv = v * Nc; } // B
    else { gu = u * Nc; gv = (v - 1) * Nc; }                  // C
    const i0 = clamp(Math.floor(gu), 0, Nc - 1);
    const j0 = clamp(Math.floor(gv), 0, Nc - 1);
    const fu = clamp(gu - i0, 0, 1), fv = clamp(gv - j0, 0, 1);
    const w00 = weld(square, i0, j0), w10 = weld(square, i0 + 1, j0);
    const w01 = weld(square, i0, j0 + 1), w11 = weld(square, i0 + 1, j0 + 1);
    for (let d = 0; d < 3; d++) {
      const a = P[3 * w00 + d] * (1 - fu) + P[3 * w10 + d] * fu;
      const b = P[3 * w01 + d] * (1 - fu) + P[3 * w11 + d] * fu;
      out[d] = a * (1 - fv) + b * fv;
    }
  };
}

async function init(): Promise<void> {
  const cfg: CoarseConfig = await fetch(COARSE_URL).then((r) => {
    if (!r.ok) throw new Error(`could not load ${COARSE_URL} — save a config from the relax demo first`);
    return r.json();
  });

  const coarse = build(cfg.N);
  const field = makeCoarseField(coarse, cfg);

  const fine = build(FINE_N);
  const mesh = HalfEdgeMesh.fromSoup(fine.weldedCount, fine.faces);
  // eslint-disable-next-line no-console
  console.log(`fine: N=${FINE_N}, ${fine.weldedCount} verts, χ=${mesh.eulerCharacteristic()} (from coarse N=${cfg.N})`);

  // Seed: one representative (square,u,v) per fine welded vertex → coarse field.
  const seed = new Float32Array(3 * fine.weldedCount);
  const filled = new Uint8Array(fine.weldedCount);
  const tmp = new Float32Array(3);
  for (let r = 0; r < fine.render.count; r++) {
    const w = fine.render.weldOf[r];
    if (filled[w]) continue;
    filled[w] = 1;
    field(fine.render.square[r], fine.render.uv[2 * r], fine.render.uv[2 * r + 1], tmp);
    seed[3 * w] = tmp[0]; seed[3 * w + 1] = tmp[1]; seed[3 * w + 2] = tmp[2];
  }
  const emb = new Embedding(mesh, { positions: seed });

  // Welded adjacency for Taubin smoothing.
  const adj: number[][] = Array.from({ length: fine.weldedCount }, () => []);
  const seenE = new Set<number>();
  for (const f of fine.faces) for (let k = 0; k < 4; k++) {
    const a = f[k], b = f[(k + 1) % 4];
    const key = a < b ? a * 1e7 + b : b * 1e7 + a;
    if (seenE.has(key)) continue;
    seenE.add(key);
    adj[a].push(b); adj[b].push(a);
  }

  // Taubin smoothing: a positive (λ) then negative (μ) Laplacian pass — smooths
  // without the shrinkage of plain Laplacian smoothing.
  const scratch = new Float32Array(3 * fine.weldedCount);
  function smoothPass(factor: number): void {
    const pos = emb.positions;
    for (let w = 0; w < fine.weldedCount; w++) {
      const nb = adj[w];
      let sx = 0, sy = 0, sz = 0;
      for (const m of nb) { sx += pos[3 * m]; sy += pos[3 * m + 1]; sz += pos[3 * m + 2]; }
      const c = nb.length || 1;
      scratch[3 * w] = pos[3 * w] + factor * (sx / c - pos[3 * w]);
      scratch[3 * w + 1] = pos[3 * w + 1] + factor * (sy / c - pos[3 * w + 1]);
      scratch[3 * w + 2] = pos[3 * w + 2] + factor * (sz / c - pos[3 * w + 2]);
    }
    emb.positions.set(scratch);
  }
  const P = { lambda: 0.33, mu: -0.34, passes: 1 };
  const taubin = (): void => { smoothPass(P.lambda); smoothPass(P.mu); };

  // ── Render mesh ─────────────────────────────────────────────────────────
  const geo = new THREE.BufferGeometry();
  geo.setIndex(fine.render.indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(fine.render.count * 3), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(fine.render.uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(fine.render.count * 3), 3));
  function syncRender(): void {
    const arr = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let r = 0; r < fine.render.count; r++) {
      const w = fine.render.weldOf[r];
      arr[3 * r] = emb.positions[3 * w];
      arr[3 * r + 1] = emb.positions[3 * w + 1];
      arr[3 * r + 2] = emb.positions[3 * w + 2];
    }
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  const colorGLSL = `
    vec2 cell = floor(uv);
    float chk = mod(cell.x + cell.y, 2.0);
    vec3 base = mix(vec3(0.42, 0.62, 0.72), vec3(0.78, 0.62, 0.40), chk);
    vec2 f = abs(fract(uv) - 0.5);
    float edge = smoothstep(0.45, 0.5, max(f.x, f.y));
    vec3 col = base * (1.0 - 0.5 * edge);
    col += 0.16 * vec3(coordGrid(uv, 1.0));
    return col;
  `;
  const shader = createSurfaceShader({ color: colorGLSL });
  const uvTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  uvTex.needsUpdate = true;
  const material = new CustomShaderMaterial({
    baseMaterial: THREE.MeshPhysicalMaterial,
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    uniforms: shader.uniforms,
    side: THREE.DoubleSide,
    map: uvTex,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.3,
  });

  const app = new App({ antialias: true, debug: true });
  app.camera.fov = 30;
  app.camera.updateProjectionMatrix();
  app.camera.position.set(5, 4, 6);
  app.controls.target.set(0, 0, 0);
  app.controls.update();
  app.backgrounds.loadHDR(studioHDR, { asEnvironment: true, asBackground: false, intensity: 1.4 });
  app.backgrounds.setColor(0xf0efe9);
  app.scene.add(new THREE.DirectionalLight(0xffffff, 2.2).translateX(4).translateY(5).translateZ(3));
  app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  app.scene.add(new THREE.Mesh(geo, material));
  syncRender();

  // ── Controls ──────────────────────────────────────────────────────────────
  let running = true;
  app.overlay.addSlider({
    label: 'Smooth λ', min: 0, max: 0.8, step: 0.01, value: P.lambda,
    format: (v: number) => `λ = ${v.toFixed(2)}`, onChange: (v: number) => { P.lambda = v; },
  });
  app.overlay.addSlider({
    label: 'Passes', min: 0, max: 8, step: 1, value: P.passes,
    format: (v: number) => `${v} passes/frame`, onChange: (v: number) => { P.passes = v; },
  });

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'save fine config';
  saveBtn.style.cssText =
    'position:fixed; top:12px; right:12px; z-index:10; padding:8px 14px; font:13px/1 ui-monospace,monospace;' +
    'color:#2c2c2c; background:#f7f5f0; border:1px solid rgba(0,0,0,0.2); border-radius:6px; cursor:pointer;';
  saveBtn.addEventListener('click', async () => {
    const body = JSON.stringify({
      N: FINE_N, weldedCount: fine.weldedCount, coneVertex: fine.coneVertex,
      savePath: configPath('fine', SURF),
      positions: Array.from(emb.positions),
    });
    try {
      const j = await fetch('/__save-lsurface', { method: 'POST', headers: { 'content-type': 'application/json' }, body }).then((r) => r.json());
      saveBtn.textContent = j.ok ? `saved → ${j.path}` : 'save failed';
    } catch {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
      a.download = `fine-config-${SURF}.json`; a.click(); URL.revokeObjectURL(a.href);
      saveBtn.textContent = 'downloaded';
    }
    setTimeout(() => (saveBtn.textContent = 'save fine config'), 2500);
  });
  document.body.appendChild(saveBtn);

  const dropdown = surfaceDropdown();
  dropdown.style.cssText += 'position:fixed; top:12px; left:12px; z-index:10;';
  document.body.appendChild(dropdown);

  window.addEventListener('keydown', (e) => { if (e.key === ' ') running = !running; });

  app.addAnimateCallback(() => {
    if (running) for (let p = 0; p < P.passes; p++) taubin();
    syncRender();
  });
  app.start();
}

init().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed; inset:0; display:flex; align-items:center; justify-content:center; font:14px ui-monospace,monospace; color:#a33; padding:24px; text-align:center;';
  div.textContent = String(err.message ?? err);
  document.body.appendChild(div);
});
