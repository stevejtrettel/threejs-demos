/**
 * Hopf Torus Folding — switchable curves
 *
 * Rolls a flat parallelogram into a Hopf torus via stereographic projection.
 * Press 1/2/3 to switch between different S² curves.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { HopfTorus, fromSpherical } from '@/math/hopf';
import { RollUpMesh } from '@/math/surfaces/RollUpMesh';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

const TWO_PI = 2 * Math.PI;

// --- Curve library ---

type SphericalCurve = (t: number) => { phi: number; theta: number };

const curves: { name: string; fn: SphericalCurve }[] = [
  {
    name: 'Hexagonal (n=3)',
    fn: (t) => {
      const a = 0.276, b = 1.9, n = 3;
      return {
        phi: Math.PI / 2 + a * b * Math.cos(n * t),
        theta: t + a * Math.sin(2 * n * t),
      };
    },
  },
  {
    name: 'Heptagonal A (n=7)',
    fn: (t) => {
      const a = 0.1179, b = 3.89, n = 7;
      return {
        phi: Math.PI / 2 + a * b * Math.cos(n * t),
        theta: t + a * Math.sin(2 * n * t),
      };
    },
  },
  {
    name: 'Hendecagonal (n=11)',
    fn: (t) => {
      const a = 0.07, b = 5.705, n = 11;
      return {
        phi: Math.PI / 2 + a * b * Math.cos(n * t),
        theta: t + a * Math.sin(2 * n * t),
      };
    },
  },
];

// --- Build surface from curve index ---

function buildSurface(index: number): { surface: Surface; name: string } {
  const { name, fn } = curves[index];
  const hopf = new HopfTorus({ curve: fromSpherical(fn) });

  const e1 = new THREE.Vector2(hopf.fiberPeriod, 0);
  const e2 = hopf.edgeGenerator;

  console.log(`[${name}] lattice tau:`, hopf.lattice.tau());
  console.log(`[${name}] e1:`, e1, 'e2:', e2);

  const surface: Surface = {
    evaluate(u: number, v: number): THREE.Vector3 {
      const pt = new THREE.Vector2(
        u * e1.x + v * e2.x,
        u * e1.y + v * e2.y,
      );
      return hopf.isometricImage(pt);
    },
    getDomain(): SurfaceDomain {
      return { uMin: -0.5, uMax: 0.5, vMin: -0.5, vMax: 0.5 };
    },
  };

  return { surface, name };
}

// --- Scene ---

const app = new App({ antialias: true });
app.camera.fov = 20;
app.camera.updateProjectionMatrix();
app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: false,
  intensity: 1.5,
});
app.backgrounds.setColor(0xf0f0f0);

app.camera.position.set(8, 14, 24);
app.controls.target.set(0, 0, 0);
app.controls.update();

// --- Label ---

const label = document.createElement('div');
label.style.cssText = 'position:fixed;top:16px;left:16px;color:#333;font:14px/1.4 monospace;background:rgba(255,255,255,0.85);padding:6px 10px;border-radius:4px;pointer-events:none;display:none;';
document.body.appendChild(label);

function updateLabel(name: string) {
  label.textContent = `${name}  [press 1-${curves.length} to switch]`;
}

// --- Active mesh ---

let currentIndex = 0;
let mesh: RollUpMesh;

function switchCurve(index: number) {
  if (index === currentIndex && mesh) return;
  currentIndex = index;

  if (mesh) {
    app.scene.remove(mesh);
    mesh.dispose();
  }

  const { surface, name } = buildSurface(index);
  mesh = new RollUpMesh(surface, {
    squareDomain: false,
    uSegments: 256,
    vSegments: 256,
  });
  app.scene.add(mesh);
  updateLabel(name);
}

switchCurve(2);

// --- Keyboard ---

window.addEventListener('keydown', (e) => {
  const num = parseInt(e.key);
  if (num >= 1 && num <= curves.length) {
    switchCurve(num - 1);
  }
});

// --- Animation ---

const FOLD_UP = 5;
const HOLD = 5;
const FOLD_DOWN = 5;
const PERIOD = FOLD_UP + HOLD + FOLD_DOWN;
const CAM_DIST = 40;
const CAM_HEIGHT = 16;

app.addAnimateCallback((elapsed) => {
  const phase = elapsed % PERIOD;
  let tau: number;
  if (phase < FOLD_UP) {
    tau = 0.5 - 0.5 * Math.cos(Math.PI * phase / FOLD_UP);
  } else if (phase < FOLD_UP + HOLD) {
    tau = 1.0;
  } else {
    const t = (phase - FOLD_UP - HOLD) / FOLD_DOWN;
    tau = 0.5 + 0.5 * Math.cos(Math.PI * t);
  }
  mesh.setTau(tau);

  // Tilt mesh 90° around X as it folds up
  mesh.rotation.x = tau * (-Math.PI / 2);

  const angle = TWO_PI * (elapsed % PERIOD) / PERIOD;
  app.camera.position.set(
    CAM_DIST * Math.cos(angle),
    CAM_HEIGHT,
    CAM_DIST * Math.sin(angle),
  );
  app.controls.target.set(0, 0, 0);
  app.controls.update();
});

app.start();
