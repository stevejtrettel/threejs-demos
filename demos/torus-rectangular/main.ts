/**
 * Rectangular Conformal Torus — rolling up a √2 rectangle
 *
 * A flat torus in S³ with radii a = √(2/3), b = 1/√3 (so a/b = √2),
 * stereographically projected to R³. The induced metric is conformally
 * flat, so grid squares stay square — but the fundamental domain is
 * a √2 rectangle, not a square.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { RollUpMesh } from '@/math/surfaces/RollUpMesh';
import type { DifferentialSurface, SurfaceDomain, SurfacePartials } from '@/math/surfaces/types';
import { boundsFromSurfaceDomain } from '@/math/surfaces/types';
import type { ManifoldDomain } from '@/math/manifolds';
import { Matrix } from '@/math/linear-algebra';

const TWO_PI = 2 * Math.PI;

// Flat torus in S³: (a cos u, a sin u, b cos v, b sin v) with a²+b²=1
// Aspect ratio a/b = √2 → a = √(2/3), b = 1/√3
const a = Math.sqrt(2 / 3);
const b = Math.sqrt(1 / 3);

const rectTorus: DifferentialSurface = {
  dim: 2,

  evaluate(u: number, v: number): THREE.Vector3 {
    const x1 = a * Math.cos(u);
    const x2 = a * Math.sin(u);
    const x3 = b * Math.cos(v);
    const x4 = b * Math.sin(v);
    const d = 1 / (1 - x4);
    return new THREE.Vector3(x1 * d, x2 * d, x3 * d);
  },

  getDomain(): SurfaceDomain {
    return { uMin: 0, uMax: TWO_PI, vMin: 0, vMax: TWO_PI };
  },

  getDomainBounds(): ManifoldDomain {
    return boundsFromSurfaceDomain(this.getDomain());
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

  computeMetric(p: number[]): Matrix {
    const { du, dv } = this.computePartials(p[0], p[1]);
    const E = du.dot(du), F = du.dot(dv), G = dv.dot(dv);
    const m = new Matrix(2, 2);
    m.data[0] = E; m.data[1] = F; m.data[2] = F; m.data[3] = G;
    return m;
  },
};

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

// --- Roll-up mesh ---

const mesh = new RollUpMesh(rectTorus, {
  squareDomain: false,
  uSegments: 64,
  vSegments: 64,
});
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
