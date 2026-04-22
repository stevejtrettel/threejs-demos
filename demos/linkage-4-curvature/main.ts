/**
 * Curvature-colored config-space sphere for the 4-rod linkage.
 *
 * The configuration sphere's Gaussian curvature is computed on a 256×256
 * (φ, t) grid via the Brioschi formula applied to the pullback metric
 * (kinetic-energy form on the chain pushed down through psi4). The grid
 * is uploaded as a DataTexture; a custom fragment shader samples it and
 * applies the viridis colormap.
 *
 * The pullback metric has coordinate singularities at the poles (φ = ±π/2)
 * and along the sigma-flip meridians (t = 0, π). Cells falling in narrow
 * bands around these get tagged NaN and colored neutral gray in the shader.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- Angle parameterization (for the T³-embedded view) ---

function psi4(phi: number, t: number, L: number): [number, number, number, number] {
  const alpha4 = Math.acos((L * L - 8) / (2 * L));
  const theta1 = alpha4 * Math.sin(phi);
  const c1 = Math.cos(theta1), s1 = Math.sin(theta1);
  const d = Math.sqrt(L * L - 2 * L * c1 + 1);
  const gamma4 = Math.atan2(-s1, L - c1);

  const alpha3 = Math.acos((d * d - 3) / (2 * d));
  const sub_phi1 = alpha3 * Math.cos(t);
  const sub_c1 = Math.cos(sub_phi1), sub_s1 = Math.sin(sub_phi1);
  const d_sub = Math.sqrt(d * d - 2 * d * sub_c1 + 1);
  const beta3 = Math.acos(d_sub / 2);
  const gamma3 = Math.atan2(-sub_s1, d - sub_c1);
  const sigma = Math.sin(t) >= 0 ? 1 : -1;

  const theta2 = gamma4 + sub_phi1;
  const theta3 = gamma4 + gamma3 + sigma * beta3;
  const theta4 = gamma4 + gamma3 - sigma * beta3;

  return [theta1, theta2, theta3, theta4];
}

// --- Pullback metric (copied from the geodesic demo) ---

// Set to true to sanity-check the Brioschi pipeline against the round metric
// (K = 1 everywhere). Flip back to false for the real physical metric.
const USE_ROUND_METRIC = false;

function pullbackMetric(
  phi: number,
  t: number,
  L: number,
): { E: number; F: number; G: number } {
  if (USE_ROUND_METRIC) {
    const c = Math.cos(phi);
    return { E: 1, F: 0, G: c * c };
  }
  const alpha4 = Math.acos((L * L - 8) / (2 * L));
  const A = alpha4 * Math.cos(phi);
  const theta1 = alpha4 * Math.sin(phi);
  const c1 = Math.cos(theta1), s1 = Math.sin(theta1);
  const d = Math.sqrt(L * L - 2 * L * c1 + 1);
  const d_prime = (L * s1) / d;
  const gamma4 = Math.atan2(-s1, L - c1);
  const gamma4_prime = (1 - L * c1) / (d * d);
  const delta = theta1 - gamma4;

  const alpha3 = Math.acos((d * d - 3) / (2 * d));
  const sinAlpha3 = Math.sin(alpha3);
  const alpha3_prime_d = -(d * d + 3) / (2 * d * d * sinAlpha3);

  const phi1 = alpha3 * Math.cos(t);
  const sPhi1 = Math.sin(phi1), cPhi1 = Math.cos(phi1);
  const dPhi1_dt = -alpha3 * Math.sin(t);
  const dPhi1_dd = alpha3_prime_d * Math.cos(t);

  const d_sub = Math.sqrt(d * d - 2 * d * cPhi1 + 1);
  const dDsub_dt = (d * sPhi1 * dPhi1_dt) / d_sub;
  const dDsub_dd = ((d - cPhi1) + d * sPhi1 * dPhi1_dd) / d_sub;

  const beta3 = Math.acos(d_sub / 2);
  const sinBeta3 = Math.sin(beta3);
  const dBeta3_dt = -dDsub_dt / (2 * sinBeta3);
  const dBeta3_dd = -dDsub_dd / (2 * sinBeta3);

  const dGamma3_dt = ((1 - d * cPhi1) / (d_sub * d_sub)) * dPhi1_dt;
  const dGamma3_dd = (sPhi1 + (1 - d * cPhi1) * dPhi1_dd) / (d_sub * d_sub);

  const sigma = Math.sin(t) >= 0 ? 1 : -1;
  const gamma3 = Math.atan2(-sPhi1, d - cPhi1);
  const phi2 = gamma3 + sigma * beta3;

  const dPhi2_dt = dGamma3_dt + sigma * dBeta3_dt;
  const dPhi2_dd = dGamma3_dd + sigma * dBeta3_dd;

  const B1 = gamma4_prime + d_prime * dPhi1_dd;
  const B2 = gamma4_prime + d_prime * dPhi2_dd;
  const C1 = dPhi1_dt;
  const C2 = dPhi2_dt;

  const cPhi1mPhi2 = Math.cos(phi1 - phi2);
  const cDmPhi1 = Math.cos(delta - phi1);
  const cDmPhi2 = Math.cos(delta - phi2);

  const G_tt = 2 * C1 * C1 + 2 * C1 * C2 * cPhi1mPhi2 + C2 * C2;

  const F_pt =
    A *
    (C1 * (2 * cDmPhi1 + 2 * B1 + B2 * cPhi1mPhi2) +
      C2 * (cDmPhi2 + B1 * cPhi1mPhi2 + B2));

  const E_pp =
    A * A *
    (3 +
      4 * B1 * cDmPhi1 +
      2 * B2 * cDmPhi2 +
      2 * B1 * B1 +
      2 * B1 * B2 * cPhi1mPhi2 +
      B2 * B2);

  return { E: E_pp, F: F_pt, G: G_tt };
}

// --- Brioschi Gaussian curvature ---
//
// K = (1/(EG − F²)²) · [ det(M1) − det(M2) ]
// M1, M2 as in the plan. Partials by central finite differences on a 3×3 stencil.

const H = 1e-3;

function sample(phi: number, t: number, L: number) {
  return pullbackMetric(phi, t, L);
}

function curvatureAt(phi: number, t: number, L: number): number {
  // 3x3 stencil around (phi, t). g[i+1][j+1] = metric at (phi + i*H, t + j*H).
  const g: Array<Array<{ E: number; F: number; G: number }>> = [[], [], []];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      g[i + 1].push(sample(phi + i * H, t + j * H, L));
    }
  }
  const get = (i: number, j: number) => g[i + 1][j + 1];

  const E = get(0, 0).E;
  const F = get(0, 0).F;
  const G = get(0, 0).G;

  const inv2H = 1 / (2 * H);
  const invH2 = 1 / (H * H);
  const inv4H2 = 1 / (4 * H * H);

  // First partials (central).
  const E_phi = (get(1, 0).E - get(-1, 0).E) * inv2H;
  const E_t = (get(0, 1).E - get(0, -1).E) * inv2H;
  const F_phi = (get(1, 0).F - get(-1, 0).F) * inv2H;
  const F_t = (get(0, 1).F - get(0, -1).F) * inv2H;
  const G_phi = (get(1, 0).G - get(-1, 0).G) * inv2H;
  const G_t = (get(0, 1).G - get(0, -1).G) * inv2H;

  // Second partials.
  const E_tt = (get(0, 1).E - 2 * E + get(0, -1).E) * invH2;
  const G_phiphi = (get(1, 0).G - 2 * G + get(-1, 0).G) * invH2;
  // Mixed: F_φt from 4 corners.
  const F_phit =
    (get(1, 1).F - get(1, -1).F - get(-1, 1).F + get(-1, -1).F) * inv4H2;

  // Determinants.
  const a11 = -0.5 * E_tt + F_phit - 0.5 * G_phiphi;
  const a12 = 0.5 * E_phi;
  const a13 = F_phi - 0.5 * E_t;
  const a21 = F_t - 0.5 * G_phi;
  const a22 = E;
  const a23 = F;
  const a31 = 0.5 * G_t;
  const a32 = F;
  const a33 = G;
  const det1 =
    a11 * (a22 * a33 - a23 * a32) -
    a12 * (a21 * a33 - a23 * a31) +
    a13 * (a21 * a32 - a22 * a31);

  const b12 = 0.5 * E_t;
  const b13 = 0.5 * G_phi;
  const b22 = E;
  const b23 = F;
  const b32 = F;
  const b33 = G;
  const det2 =
    0 - b12 * (b12 * b33 - b13 * b32) + b13 * (b12 * b23 - b13 * b22);
  // det( [[0, b12, b13], [b12, b22, b23], [b13, b32, b33]] ) expanded along row 0

  const denom = (E * G - F * F);
  const K = (det1 - det2) / (denom * denom);
  return K;
}

// --- Grid sampling → DataTexture ---

const GRID_N = 256;
// Skip curvature near the singular bands: ±π/2 for phi, 0 and π for t.
const SING_MARGIN = 0.02;

function buildCurvatureGrid(L: number): {
  data: Float32Array;
  scale: number;
  min: number;
  max: number;
} {
  const data = new Float32Array(GRID_N * GRID_N);
  const samples: number[] = [];

  for (let j = 0; j < GRID_N; j++) {
    // v axis = t, [0, 2π]. Half-cell shift so we never sample exactly
    // at t = 0 or t = π, where sinBeta3 = 0 would give 0/0 in the metric.
    const tVal = (2 * Math.PI * (j + 0.5)) / GRID_N;

    for (let i = 0; i < GRID_N; i++) {
      // u axis = phi, [-π/2, π/2]
      const phi = -Math.PI / 2 + (Math.PI * i) / (GRID_N - 1);
      const phiSingular = Math.abs(Math.abs(phi) - Math.PI / 2) < SING_MARGIN;

      let K: number;
      if (phiSingular) {
        K = NaN;
      } else {
        K = curvatureAt(phi, tVal, L);
        if (!Number.isFinite(K)) K = NaN;
      }
      data[j * GRID_N + i] = K;
      if (Number.isFinite(K)) samples.push(K);
    }
  }

  // Diverging scale: take the 98th percentile of |K| so extreme spikes near
  // singularities don't compress the useful range. K = 0 sits at the middle
  // of the palette.
  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(samples.length * 0.02)] ?? 0;
  const hi = samples[Math.floor(samples.length * 0.98)] ?? 0;
  const abs = samples.map((v) => Math.abs(v)).sort((a, b) => a - b);
  const scale = abs[Math.floor(abs.length * 0.98)] ?? 1;

  // Outlier suppression: the pullback metric has σ-flip singular meridians
  // whose central-difference stencils produce isolated huge spikes. Replace
  // any cell whose |K| exceeds OUTLIER_FACTOR × scale (or that's non-finite)
  // with the median of its finite, in-range 3×3 neighborhood. A couple of
  // passes propagate the fill inward if the band is multiple cells wide.
  const OUTLIER_FACTOR = 3;
  const outThresh = OUTLIER_FACTOR * scale;
  const isBad = (v: number) => !Number.isFinite(v) || Math.abs(v) > outThresh;

  for (let pass = 0; pass < 3; pass++) {
    const copy = Float32Array.from(data);
    for (let j = 0; j < GRID_N; j++) {
      for (let i = 0; i < GRID_N; i++) {
        const idx = j * GRID_N + i;
        if (!isBad(copy[idx])) continue;
        const good: number[] = [];
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            if (di === 0 && dj === 0) continue;
            const ii = i + di;
            const jj = j + dj;
            if (ii < 0 || ii >= GRID_N || jj < 0 || jj >= GRID_N) continue;
            const v = copy[jj * GRID_N + ii];
            if (!isBad(v)) good.push(v);
          }
        }
        if (good.length === 0) continue;
        good.sort((a, b) => a - b);
        data[idx] = good[Math.floor(good.length / 2)];
      }
    }
  }

  return { data, scale: scale || 1, min: lo, max: hi };
}

function makeCurvatureTexture(data: Float32Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    data,
    GRID_N,
    GRID_N,
    THREE.RedFormat,
    THREE.FloatType,
  );
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 0, 6);
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(0xf4f4f4);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(2, 3, 5);
app.scene.add(key);

// --- Sphere ---

const SPHERE_R = 2.0;

const sphereSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      SPHERE_R * Math.cos(u) * Math.cos(v),
      SPHERE_R * Math.cos(u) * Math.sin(v),
      SPHERE_R * Math.sin(u),
    );
  },
  getDomain(): SurfaceDomain {
    return { uMin: -Math.PI / 2, uMax: Math.PI / 2, vMin: 0, vMax: 2 * Math.PI };
  },
};

// --- Shader ---

const fragmentShader = `
uniform sampler2D uK;
uniform float uKScale;

void main() {
  float k = texture2D(uK, vMapUv).r;
  if (!(k == k)) {
    // NaN → neutral gray
    csm_DiffuseColor = vec4(0.6, 0.6, 0.6, 1.0);
    return;
  }
  float s = clamp(k / uKScale, -1.0, 1.0);
  vec3 white = vec3(1.0, 1.0, 1.0);
  vec3 red   = vec3(0.82, 0.18, 0.18);
  vec3 blue  = vec3(0.18, 0.35, 0.82);
  vec3 color = s >= 0.0 ? mix(white, red, s) : mix(white, blue, -s);
  csm_DiffuseColor = vec4(color, 1.0);
}
`;

let L = 3.0;
const { data: initialData, scale: initScale, min: initMin, max: initMax } =
  buildCurvatureGrid(L);

const uniforms: Record<string, { value: any }> = {
  uK: { value: makeCurvatureTexture(initialData) },
  uKScale: { value: initScale },
};

const sphereMesh = new SurfaceMesh(sphereSurface, {
  uSegments: 96,
  vSegments: 192,
  roughness: 0.4,
  metalness: 0.05,
  fragmentShader,
  uniforms,
});
app.scene.add(sphereMesh);

// --- Embedded view: same (φ, t) parameterization, but evaluated through
// psi4 into (θ₁, θ₂, θ₃) ⊂ T³. Shares the same curvature texture (which is
// indexed by (φ, t), so the same uv). Visibility toggled by the radio below.

const embeddedSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const [a, b, c] = psi4(u, v, L);
    return new THREE.Vector3(a, b, c);
  },
  getDomain(): SurfaceDomain {
    return { uMin: -Math.PI / 2, uMax: Math.PI / 2, vMin: 0, vMax: 2 * Math.PI };
  },
};

const embeddedMesh = new SurfaceMesh(embeddedSurface, {
  uSegments: 96,
  vSegments: 192,
  roughness: 0.4,
  metalness: 0.05,
  fragmentShader,
  uniforms,
});
embeddedMesh.visible = false;
app.scene.add(embeddedMesh);

// Wireframe cube [-π, π]³ to frame the T³ embedding.
const cubeEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(
    new THREE.BoxGeometry(2 * Math.PI, 2 * Math.PI, 2 * Math.PI),
  ),
  new THREE.LineBasicMaterial({ color: 0xaaaaaa }),
);
cubeEdges.visible = false;
app.scene.add(cubeEdges);

// --- L slider ---

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:16px;left:16px;color:#333;font:14px/1.4 monospace;' +
  'background:rgba(255,255,255,0.9);padding:10px 14px;border-radius:6px;' +
  'display:flex;flex-direction:column;gap:6px;min-width:240px;z-index:10;';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>L</span>
    <span id="lc-L-value">${L.toFixed(2)}</span>
  </label>
  <input id="lc-L" type="range" min="2" max="4" step="0.01" value="${L}" />
  <label style="display:flex;justify-content:space-between;gap:8px;font-size:12px;">
    <span>K range</span>
    <span id="lc-K-range"></span>
  </label>
  <div style="display:flex;gap:10px;font-size:12px;">
    <label><input type="radio" name="lc-view" value="abstract" checked /> abstract</label>
    <label><input type="radio" name="lc-view" value="embedded" /> embedded (T³)</label>
  </div>
`;
document.body.appendChild(panel);

const slider = panel.querySelector<HTMLInputElement>('#lc-L')!;
const readout = panel.querySelector<HTMLSpanElement>('#lc-L-value')!;
const kRangeReadout = panel.querySelector<HTMLSpanElement>('#lc-K-range')!;

function updateRangeReadout(min: number, max: number) {
  kRangeReadout.textContent = `[${min.toFixed(2)}, ${max.toFixed(2)}]`;
}
updateRangeReadout(initMin, initMax);

function setL(newL: number) {
  L = newL;
  const { data, scale, min, max } = buildCurvatureGrid(L);
  (uniforms.uK.value as THREE.DataTexture).dispose();
  uniforms.uK.value = makeCurvatureTexture(data);
  uniforms.uKScale.value = scale;
  updateRangeReadout(min, max);
  // Embedded geometry depends on L via psi4; rebuild it.
  embeddedMesh.rebuild();
}

slider.addEventListener('input', () => {
  const v = parseFloat(slider.value);
  readout.textContent = v.toFixed(2);
  setL(v);
});

panel.querySelectorAll<HTMLInputElement>('input[name="lc-view"]').forEach((r) => {
  r.addEventListener('change', () => {
    const embedded = r.value === 'embedded' && r.checked;
    const abstract = r.value === 'abstract' && r.checked;
    if (embedded) {
      sphereMesh.visible = false;
      embeddedMesh.visible = true;
      cubeEdges.visible = true;
    } else if (abstract) {
      sphereMesh.visible = true;
      embeddedMesh.visible = false;
      cubeEdges.visible = false;
    }
  });
});

app.start();

(window as any).setL = setL;
(window as any).curvatureAt = curvatureAt;
