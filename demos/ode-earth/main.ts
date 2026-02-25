/**
 * ODE Earth
 *
 * Solve an ODE to get a profile curve (r, y), revolve it
 * around the y-axis, and texture with earth.
 */

import { App } from '@/app/App';
import { SurfaceMesh, integrate } from '@/math';
import { NumericalCurve } from '@/math/curves/NumericalCurve';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import * as THREE from 'three';

import equirectFrag from './equirect.frag.glsl?raw';
import earthTextureUrl from '@assets/textures/earth-equirect-nasa.jpg';

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 4, 8);
app.controls.target.set(0, 0, 0);

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(5, Math.tan(20 * Math.PI / 180) * 5, 0);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
app.backgrounds.setColor(0x0a0a1a);

// --- ODE: edit this! ---
//
// The state is any array. deriv returns the derivatives.
// toProfile maps a state to { r, y } for the revolution.


const a = 0.5;

const deriv = ([r, rp]: number[]) => [
  rp,
  - r,
  Math.sqrt(Math.max(0, 1 - rp * rp)),
];

const initialState = [0, a, 0];
const dt = Math.PI / 400;
const steps = 400;

const toProfile = ([r, , y]: number[]) => ({ r, y });

// --- Solve ---

const { states } = integrate({ deriv, initial: initialState, dt, steps });

const yStart = toProfile(states[0]).y;
const yEnd = toProfile(states[states.length - 1]).y;
const yCenter = (yStart + yEnd) / 2;

const profilePoints = states.map((s) => {
  const { r, y } = toProfile(s);
  return new THREE.Vector3(r, y - yCenter, 0);
});

const profileCurve = new NumericalCurve({
  points: profilePoints,
  closed: false,
  curveType: 'catmullrom',
  tension: 0.5,
});

// --- Surface of revolution ---

const surface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const p = profileCurve.evaluate(v);
    return new THREE.Vector3(p.x * Math.cos(u), p.y, -p.x * Math.sin(u));
  },
  getDomain(): SurfaceDomain {
    return { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 1 };
  },
};

const earthTexture = new THREE.TextureLoader().load(earthTextureUrl);
earthTexture.colorSpace = THREE.SRGBColorSpace;

const mesh = new SurfaceMesh(surface, {
  roughness: 0.8,
  metalness: 0.0,
  uSegments: 128,
  vSegments: 96,
  fragmentShader: equirectFrag,
  uniforms: {
    uMap: { value: earthTexture },
    a: { value: a },
  },
});

app.scene.add(mesh);

// --- Animate ---

app.addAnimateCallback((time) => { mesh.rotation.y = time * 0.1; });
app.start();
