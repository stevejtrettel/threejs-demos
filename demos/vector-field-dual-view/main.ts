/**
 * Vector field + flow — dual view, single computation.
 *
 * `f: R² → R`, `f = cos(u + φ) + cos(ω·v)`.
 * The gradient `∇f = (−sin(u+φ), −ω·sin(ω·v))` is a vector field on the
 * plane — that's the thing we integrate. It lives in parameter space, not
 * on any surface.
 *
 * We then *display* the same integrated trajectories two ways:
 *   - on a flat rectangle (the honest drawing — the field literally lives
 *     in the plane)
 *   - lifted onto the graph `z = f(u, v)` (a visualization convenience)
 *
 * Architecture:
 *   one GradientField  (flat Euclidean, one instance)
 *   one FlowCurve per start point (does the integration)
 *   two CurveLines per start (render on each surface)
 *
 * Each FlowCurve re-integrates once per cascade; topological ordering
 * ensures both CurveLines always see fresh points.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import { App } from '@/app/App';
import {
  FunctionGraph,
  FlatPatch,
  SurfaceMesh,
  GradientField,
  FlowCurve,
  CurveOnSurface,
  CurveLine,
  FieldArrows,
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

// --- Surfaces (domain-sharing) ----------------------------------------------

const graph = new FunctionGraph(height, { xyScale: 1, zScale: 1 });
const flat = new FlatPatch({
  domain: { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 2 * Math.PI },
  height: -4,
});

// --- The gradient field — in the plane, not on any surface ------------------
// GradientField takes a MetricPatch only because the pushforward pipeline
// for `FieldArrows` needs partials. By passing `flat` (whose metric is the
// identity), we get the honest Euclidean gradient.

const grad = new GradientField(height, flat, { descend: true });

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: true });
app.camera.position.set(Math.PI, 4, Math.PI + 12);
app.controls.target.set(Math.PI, -1, Math.PI);
app.controls.update();
app.backgrounds.setColor(0xf3f4f6);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 3);
key.position.set(6, 10, 4);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 1);
fill.position.set(-4, 2, -6);
app.scene.add(fill);

// --- Graph view surface + arrows --------------------------------------------

app.scene.add(new SurfaceMesh(graph, {
  color: 0xb0c4de,
  uSegments: 80,
  vSegments: 80,
}));
app.scene.add(new FieldArrows(graph, grad, {
  uSegments: 14,
  vSegments: 14,
  color: 0x1a3a7a,
}));

// --- Flat view surface + arrows ---------------------------------------------

app.scene.add(new SurfaceMesh(flat, {
  color: 0xe8e8ee,
  uSegments: 2,
  vSegments: 2,
}));
app.scene.add(new FieldArrows(flat, grad, {
  uSegments: 14,
  vSegments: 14,
  color: 0xcc3322,
}));

// --- Shared trajectories, drawn twice ---------------------------------------

const STEPS = 600;
const N = 5;
for (let i = 1; i <= N; i++) {
  for (let j = 1; j <= N; j++) {
    const curve = new FlowCurve(grad, {
      initialPosition: [
        (i / (N + 1)) * 2 * Math.PI,
        (j / (N + 1)) * 2 * Math.PI,
      ],
      stepSize: 0.02,
      steps: STEPS,
    });

    app.scene.add(new CurveLine({ curve: new CurveOnSurface(curve, graph).curve, color: 0xff5500 }));
    app.scene.add(new CurveLine({ curve: new CurveOnSurface(curve, flat ).curve, color: 0xff5500 }));
  }
}

// --- Morph animation --------------------------------------------------------

app.addAnimateCallback((elapsed) => {
  height.params.set('phase', 0.8 * Math.sin(0.4 * elapsed));
  height.params.set('omega', 1 + 0.4 * Math.sin(0.25 * elapsed));
});

app.start();
