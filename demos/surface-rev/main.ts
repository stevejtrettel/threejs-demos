/**
 * Surface of Revolution
 *
 * Define a profile curve r(t), y(t) below, and it gets
 * revolved around the y-axis with an equirectangular earth map.
 */

import { App } from '@/app/App';
import { SurfaceMesh } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import * as THREE from 'three';

import equirectFrag from './equirect.frag.glsl?raw';
import earthTextureUrl from '@assets/textures/earth-equirect-nasa.jpg';

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 2, 5);
app.controls.target.set(0, 0, 0);

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(5, Math.tan(20 * Math.PI / 180) * 5, 0);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
app.backgrounds.setColor(0x0a0a1a);

// --- Profile curve: edit these! ---

const tMin = 0;
const tMax = Math.PI;

function r(t: number) { return Math.sin(t); }
function y(t: number) { return -Math.cos(t); }

// --- Surface of revolution ---

const surface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const t = tMin + (tMax - tMin) * v;
    const radius = Math.max(0, r(t));
    return new THREE.Vector3(
      radius * Math.cos(u),
      y(t),
      -radius * Math.sin(u),
    );
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
  uSegments: 96,
  vSegments: 48,
  fragmentShader: equirectFrag,
  uniforms: { uMap: { value: earthTexture } },
});

app.scene.add(mesh);

// --- Animate ---

app.addAnimateCallback((time) => { mesh.rotation.y = time * 0.1; });
app.start();
