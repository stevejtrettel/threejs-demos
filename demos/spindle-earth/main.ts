/**
 * Spindle Earth
 *
 * A surface of revolution with constant Gaussian curvature K = +1.
 * Profile ODE:  r'' = -r,  y' = sqrt(1 - r'²).
 * The cone angle α controls the shape:
 *   α = π/2  →  round sphere  (full earth texture)
 *   α < π/2  →  spindle       (wedge of earth, opening 2π sin α)
 */

import { App } from '@/app/App';
import { SurfaceMesh, integrate } from '@/math';
import { NumericalCurve } from '@/math/curves/NumericalCurve';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import * as THREE from 'three';

import wedgeEquirectVert from './wedge-equirect.vert.glsl?raw';
import wedgeEquirectFrag from './wedge-equirect.frag.glsl?raw';
import earthTextureUrl from '@assets/textures/earth-equirect-nasa.jpg';
import galaxyTextureUrl from '@assets/textures/galaxy.png';

// --- Scene ---

const app = new App({ antialias: true, debug: true, fov:40 });
app.camera.position.set(0, 2, 5);
app.controls.target.set(0, 0, 0);

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(5, Math.tan(20 * Math.PI / 180) * 5, 0);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));


const galaxyTexture = new THREE.TextureLoader().load(galaxyTextureUrl);
galaxyTexture.mapping = THREE.EquirectangularReflectionMapping;
galaxyTexture.colorSpace = THREE.SRGBColorSpace;
app.scene.background = galaxyTexture;
app.scene.backgroundIntensity = 0.25;

// --- Profile curve (solved numerically) ---

// K = +1 profile ODE:  state = [r, r', y]
const deriv = ([r, rp]: number[]) => [rp, -r, Math.sqrt(Math.max(0, 1 - rp * rp))];

function solveProfile(a: number) {
  const { states } = integrate({
    deriv,
    initial: [0, a, 0],
    dt: Math.PI / 400,
    steps: 400,
  });
  const totalHeight = states[states.length - 1][2];
  const points = states.map(
    ([r, , y]) => new THREE.Vector3(Math.max(0, r), y - totalHeight / 2, 0),
  );
  return { points, a };
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

const earthTexture = new THREE.TextureLoader().load(earthTextureUrl);
earthTexture.colorSpace = THREE.SRGBColorSpace;

const lightDir = light.position.clone().normalize();

const mesh = new SurfaceMesh(surface, {
  roughness: 0.8,
  metalness: 0.0,
  uSegments: 96,
  vSegments: 48,
  vertexShader: wedgeEquirectVert,
  fragmentShader: wedgeEquirectFrag,
  uniforms: {
    uDay: { value: earthTexture },
    uNight: { value: galaxyTexture },
    a: { value: initial.a },
    uLightDir: { value: lightDir },
  },
});

app.scene.add(mesh);

// --- Rebuild for a given cone angle α ---

function setA(a: number) {
  const { points } = solveProfile(a);
  profileCurve.updatePoints(points);
  mesh.uniforms.a.value = a;
  mesh.rebuild();
}

// --- Slider ---

app.overlay.addSlider({
  label: 'a',
  min: 0.05, max: 1, step: 0.01, value: Math.PI / 4,
  format: (v) => `a = ${v.toFixed(2)}`,
  onChange: setA,
});

// --- Animate ---

app.addAnimateCallback((time) => { mesh.rotation.y = time * 0.1; });
app.start();
