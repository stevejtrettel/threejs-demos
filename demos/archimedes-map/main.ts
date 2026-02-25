/**
 * Archimedes Map
 *
 * Animates the Lambert equal-area projection: a sphere morphing
 * into its bounding cylinder, textured with the earth.
 * The parameter t interpolates:  radius = R·((1-t)·cos v + t).
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

// --- Surface ---

let t = 0;   // 0 = sphere, 1 = cylinder
const R = 1.5;

const surface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    const radius = R * ((1 - t) * Math.cos(v) + t);
    return new THREE.Vector3(
      radius * Math.cos(u),
      R * Math.sin(v),
      -radius * Math.sin(u),
    );
  },
  getDomain(): SurfaceDomain {
    return { uMin: 0, uMax: 2 * Math.PI, vMin: -Math.PI / 2, vMax: Math.PI / 2 };
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

app.addAnimateCallback((time) => {
  t = (Math.sin(time * 0.5) + 1) / 2;
  mesh.rebuild();
  mesh.rotation.y = time * 0.1;
});

app.start();
