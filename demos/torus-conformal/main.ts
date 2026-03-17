/**
 * Conformal Torus — Clifford torus folding
 *
 * Rolls a flat square into a Clifford torus (stereographic projection
 * from S³). The induced metric is conformally flat, so the grid
 * squares stay square throughout the entire animation.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { RollUpMesh } from '@/math/surfaces/RollUpMesh';
import type { DifferentialSurface, SurfaceDomain, SurfacePartials, FirstFundamentalForm } from '@/math/surfaces/types';

const TWO_PI = 2 * Math.PI;
const S = 1 / Math.SQRT2;

// --- Clifford torus: (cos u, sin u, cos v, sin v)/√2 ∈ S³ → stereo proj ---

const clifford: DifferentialSurface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const x1 = S * Math.cos(u);
    const x2 = S * Math.sin(u);
    const x3 = S * Math.cos(v);
    const x4 = S * Math.sin(v);
    const d = 1 / (1 - x4);
    return new THREE.Vector3(x1 * d, x2 * d, x3 * d);
  },

  getDomain(): SurfaceDomain {
    return { uMin: 0, uMax: TWO_PI, vMin: 0, vMax: TWO_PI };
  },

  computeNormal(u: number, v: number): THREE.Vector3 {
    const h = 1e-4;
    const du = this.evaluate(u + h, v).sub(this.evaluate(u - h, v));
    const dv = this.evaluate(u, v + h).sub(this.evaluate(u, v - h));
    return new THREE.Vector3().crossVectors(du, dv).normalize();
  },

  computePartials(u: number, v: number): SurfacePartials {
    const h = 1e-4;
    const du = this.evaluate(u + h, v).sub(this.evaluate(u - h, v)).divideScalar(2 * h);
    const dv = this.evaluate(u, v + h).sub(this.evaluate(u, v - h)).divideScalar(2 * h);
    return { du, dv };
  },

  computeMetric(u: number, v: number): FirstFundamentalForm {
    const { du, dv } = this.computePartials(u, v);
    return { E: du.dot(du), F: du.dot(dv), G: dv.dot(dv) };
  },
};

// --- Scene ---

const app = new App({ antialias: true, debug: true });
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

// --- Roll-up mesh ---

const mesh = new RollUpMesh(clifford, { uSegments: 64, vSegments: 64 });
app.scene.add(mesh);

// --- Animation ---

const PERIOD = 15;
const CAM_DIST = 40;
const CAM_HEIGHT = 16;

app.addAnimateCallback((elapsed) => {
  mesh.setTau(0.5 - 0.5 * Math.cos(TWO_PI * elapsed / PERIOD));

  const angle = TWO_PI * elapsed / PERIOD;
  app.camera.position.set(
    CAM_DIST * Math.cos(angle),
    CAM_HEIGHT,
    CAM_DIST * Math.sin(angle),
  );
  app.controls.target.set(0, 0, 0);
  app.controls.update();
});

app.start();
