/**
 * Hyperbolic Cylinder
 *
 * A surface of revolution with constant Gaussian curvature K = -1.
 * Profile ODE:  r'' = +r,  y' = sqrt(1 - r'²).
 * Gives r(s) = a·cosh(s), a neck that flares into trumpets.
 *
 * The surface is isometric to a strip of width 2·arcsinh(1/a)
 * in the hyperbolic plane. The shader maps through Fermi
 * coordinates to the upper half-plane, where a tiling is drawn.
 */

import { App } from '@/app/App';
import { SurfaceMesh, integrate } from '@/math';
import { NumericalCurve } from '@/math/curves/NumericalCurve';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import * as THREE from 'three';

import hyperbolicFrag from './hyperbolic-strip.frag.glsl?raw';

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 2, 5);
app.controls.target.set(0, 0, 0);

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(5, Math.tan(20 * Math.PI / 180) * 5, 0);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
app.backgrounds.setColor(0x0a0a1a);

// --- Profile curve (solved numerically) ---

// K = -1 profile ODE:  state = [r, r', y]
const deriv = ([r, rp]: number[]) => [rp, r, Math.sqrt(Math.max(0, 1 - rp * rp))];

function solveProfile(a: number) {
  const sMax = Math.asinh(1 / a);
  const { states } = integrate({
    deriv,
    initial: [a, 0, 0],
    dt: (sMax * 0.999) / 200,
    steps: 200,
  });

  // Mirror top half to get the full profile
  const topHalf = states.map(
    ([r, , y]) => new THREE.Vector3(Math.max(0, r), y, 0),
  );
  const bottomHalf = topHalf
    .slice(1).reverse()
    .map((p) => new THREE.Vector3(p.x, -p.y, 0));

  return { points: [...bottomHalf, ...topHalf], a, sMax };
}

const initial = solveProfile(0.5);

const profileCurve = new NumericalCurve({
  points: initial.points,
  closed: false,
  curveType: 'catmullrom',
  tension: 0.5,
});

// --- Surface of revolution ---

const surface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const p = profileCurve.evaluate(v);
    return new THREE.Vector3(
      p.x * Math.cos(u),
      p.y,
      -p.x * Math.sin(u),
    );
  },
  getDomain(): SurfaceDomain {
    return { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 1 };
  },
};

const mesh = new SurfaceMesh(surface, {
  roughness: 0.8,
  metalness: 0.0,
  uSegments: 96,
  vSegments: 48,
  fragmentShader: hyperbolicFrag,
  uniforms: {
    uA: { value: initial.a },
    uSMax: { value: initial.sMax },
  },
});

app.scene.add(mesh);

// --- Rebuild for a given waist radius a ---

function setA(a: number) {
  const { points, sMax } = solveProfile(a);
  profileCurve.updatePoints(points);
  mesh.uniforms.uA.value = a;
  mesh.uniforms.uSMax.value = sMax;
  mesh.rebuild();
}

// --- Slider ---

app.overlay.addSlider({
  label: 'a',
  min: 0.1, max: 2.0, step: 0.01, value: 0.5,
  format: (v) => `a = ${v.toFixed(2)}  (strip width = ${(2 * Math.asinh(1 / v)).toFixed(2)})`,
  onChange: setA,
});

// --- Animate ---

app.addAnimateCallback((time) => { mesh.rotation.y = time * 0.1; });
app.start();
