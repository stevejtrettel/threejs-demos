/**
 * Hopf Torus Export Demo
 *
 * Renders a Hopf torus (preimage of a closed curve on S² under the Hopf
 * fibration) and exports it as a watertight quad-mesh OBJ.
 *
 * The on-screen quad wireframe is built from the SAME grid that gets
 * exported, so what you see is what you get. Use `[` / `]` to lower / raise
 * the mesh resolution, and press `e` (or click the button) to download
 * `hopf-torus.obj` at the current resolution.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { HopfTorus, fromSpherical } from '@/math/hopf';
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';
import { downloadQuadOBJ } from '@/math/mesh';

// --- Selectable mesh resolutions (quads per direction) ---
const RESOLUTIONS = [12, 16, 24, 32, 48, 64, 96, 100, 150, 200];
let resIndex = 6; // start at 96×96 (doubled from 48)
const res = () => RESOLUTIONS[resIndex];

// --- App setup ---

const app = new App({ antialias: true });

app.camera.position.set(0, 3, 5);
app.controls.target.set(0, 0, 0);

app.scene.background = new THREE.Color(0x111111);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
app.scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
backLight.position.set(-5, -3, -5);
app.scene.add(backLight);

// --- Hopf torus from a non-trivial curve on S² ---

const hopf = new HopfTorus({
  curve: fromSpherical(t => ({
    theta: t,
    phi: Math.PI / 3 + 0.25 * Math.sin(7 * t),
  })),
});

// --- Glass surface + quad wireframe, rebuilt on resolution change ---
// The torus closes seamlessly in both u and v (toroidalCoords is 2π-periodic
// in both fiber and curve directions), so the grid wraps with no seam.

let surface: SurfaceMesh | null = null;
let wireframe: THREE.LineSegments | null = null;

function buildQuadWireframe(n: number): THREE.LineSegments {
  // Vertices on the n×n closed grid (no duplicated seam).
  const verts: THREE.Vector3[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      verts.push(hopf.evaluate(i / n, j / n));
    }
  }
  const idx = (i: number, j: number) => j * n + i;

  // Two edges per grid point (to next i, to next j), wrapping mod n —
  // exactly the edges of the exported quads.
  const positions: number[] = [];
  const pushEdge = (a: number, b: number) => {
    positions.push(verts[a].x, verts[a].y, verts[a].z);
    positions.push(verts[b].x, verts[b].y, verts[b].z);
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      pushEdge(idx(i, j), idx((i + 1) % n, j));
      pushEdge(idx(i, j), idx(i, (j + 1) % n));
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geom,
    new THREE.LineBasicMaterial({ color: 0x2266dd }),
  );
}

function rebuild() {
  const n = res();

  if (surface) {
    app.scene.remove(surface);
    surface.dispose?.();
  }
  surface = new SurfaceMesh(hopf, {
    uSegments: n,
    vSegments: n,
    color: 0xc9eaff,
    transmission: 0.85,
    roughness: 0.05,
    metalness: 0,
  });
  app.scene.add(surface);

  if (wireframe) {
    app.scene.remove(wireframe);
    wireframe.geometry.dispose();
    (wireframe.material as THREE.Material).dispose();
  }
  wireframe = buildQuadWireframe(n);
  app.scene.add(wireframe);

  updateLabel();
}

// --- Export at the current resolution ---

function exportOBJ() {
  downloadQuadOBJ(hopf, 'hopf-torus.obj', {
    uSegments: res(),
    vSegments: res(),
    closedU: true,
    closedV: true,
  });
}

// --- UI ---

const ui = document.createElement('div');
ui.style.cssText =
  'position:fixed;top:16px;left:16px;color:#ddd;font:14px/1.5 monospace;' +
  'background:rgba(0,0,0,0.55);padding:10px 12px;border-radius:6px;';
document.body.appendChild(ui);

const info = document.createElement('div');
ui.appendChild(info);

const btn = document.createElement('button');
btn.textContent = 'Export OBJ (e)';
btn.style.cssText =
  'margin-top:6px;font:13px monospace;padding:4px 10px;cursor:pointer;' +
  'background:#4287f5;color:#fff;border:none;border-radius:4px;';
btn.addEventListener('click', exportOBJ);
ui.appendChild(btn);

function updateLabel() {
  const n = res();
  info.innerHTML =
    `Hopf torus &mdash; quad OBJ export<br>` +
    `resolution: ${n} &times; ${n} quads &nbsp;<span style="color:#888">[ ] to change</span>`;
}

// --- Keyboard ---

window.addEventListener('keydown', (e) => {
  if (e.key === 'e' || e.key === 'E') {
    exportOBJ();
  } else if (e.key === '[') {
    resIndex = Math.max(0, resIndex - 1);
    rebuild();
  } else if (e.key === ']') {
    resIndex = Math.min(RESOLUTIONS.length - 1, resIndex + 1);
    rebuild();
  }
});

rebuild();
app.start();
