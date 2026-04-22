/**
 * Vector field + flow — gradient descent on a morphing height surface.
 *
 * The scalar field `f(u, v; ω, φ) = cos(u + φ) + cos(ω · v)` is parametric.
 * Both params animate per frame; the reactive cascade re-integrates each
 * `FlowCurve` and re-renders every `CurveLine` in topological order.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import { App } from '@/app/App';
import {
  FunctionGraph,
  SurfaceMesh,
  GradientField,
  FlowCurve,
  CurveOnSurface,
  CurveLine,
} from '@/math';
import type { Parametric } from '@/math/types';
import { ScalarField2D, type Hessian2D } from '@/math/functions';

// --- Parametric scalar field ------------------------------------------------

class BumpyField extends ScalarField2D implements Parametric {
  readonly params = new Params(this);

  declare phase: number;
  declare omega: number;

  constructor(options: { phase?: number; omega?: number } = {}) {
    super();
    this.params
      .define('phase', options.phase ?? 0, { triggers: 'rebuild' })
      .define('omega', options.omega ?? 1, { triggers: 'rebuild' });
  }

  evaluateAt(u: number, v: number): number {
    return Math.cos(u + this.phase) + Math.cos(this.omega * v);
  }

  partialsAt(u: number, v: number): [number, number] {
    return [-Math.sin(u + this.phase), -this.omega * Math.sin(this.omega * v)];
  }

  hessianAt(u: number, v: number): Hessian2D {
    return [
      -Math.cos(u + this.phase),
      0,
      -this.omega * this.omega * Math.cos(this.omega * v),
    ];
  }

  domain2D() {
    return { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 2 * Math.PI };
  }
}

const height = new BumpyField({ phase: 0, omega: 1 });

// --- Surface ----------------------------------------------------------------

const surface = new FunctionGraph(height, { xyScale: 1, zScale: 1 });

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: true });
app.camera.position.set(Math.PI, 8, Math.PI + 10);
app.controls.target.set(Math.PI, 0, Math.PI);
app.controls.update();
app.backgrounds.setColor(0xf0f2f6);

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(6, 10, 4);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const mesh = new SurfaceMesh(surface, {
  color: 0xb0c4de,
  uSegments: 80,
  vSegments: 80,
});
app.scene.add(mesh);

// --- Gradient flow ----------------------------------------------------------

const grad = new GradientField(height, surface, { descend: true });

const STEPS = 600;
const N = 6;
for (let i = 1; i <= N; i++) {
  for (let j = 1; j <= N; j++) {
    const curve = new FlowCurve(grad, {
      initialPosition: [
        (i / (N + 1)) * 2 * Math.PI,
        (j / (N + 1)) * 2 * Math.PI,
      ],
      steps: STEPS,
      stepSize: 0.02,
    });
    app.scene.add(new CurveLine({ curve: new CurveOnSurface(curve, surface).curve, color: 0xff4400 }));
  }
}

// --- Morph animation --------------------------------------------------------

app.addAnimateCallback((elapsed) => {
  height.params.set('phase', 0.8 * Math.sin(0.4 * elapsed));
  height.params.set('omega', 1 + 0.4 * Math.sin(0.25 * elapsed));
});

app.start();
