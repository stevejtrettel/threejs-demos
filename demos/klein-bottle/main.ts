/**
 * Klein Bottle — a non-orientable closed surface.
 *
 * Sliced rendering with glass overlay. The Möbius strip slice mode
 * reveals the Klein bottle's topology: cutting along the "waist"
 * produces one or two Möbius strips.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { KleinBottle } from '@/math/surfaces/KleinBottle';
import { createSurfaceShader, type SurfaceShaderResult } from '@/shaders/SurfaceShader';
import { createSlicedSurface } from '@/shaders/SlicedSurface';

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.fov = 30;
app.camera.updateProjectionMatrix();
app.camera.position.set(0, 2, 8);
app.controls.target.set(0, 0, 0);
app.controls.update();

app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: false,
  intensity: 1.5,
});
app.backgrounds.setColor(0x1a1a2e);

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 3, 4);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// --- Surface ---

const klein = new KleinBottle();

// --- Shader configs ---

// Color by the Möbius strip direction (distance from u = 0.5)
const colorBody = `
  float hue = 1.5 * abs(uv.x - 0.5);
  float sat = 0.8;
  vec3 base = hsb2rgb(vec3(hue, sat, 0.5));
  float grid = coordGrid(uv, 10.0);
  return base + 2.0 * vec3(grid);
`;

interface SliceMode {
  label: string;
  shader: SurfaceShaderResult;
}

const modes: SliceMode[] = [
  {
    label: '2 Möbius strips',
    shader: createSurfaceShader({
      sliceField: '2.0 * abs(uv.x - 0.5)',
      color: colorBody,
      border: 0.01,
    }),
  },
  {
    label: '1 Möbius strip',
    shader: createSurfaceShader({
      sliceField: '2.0 * abs(uv.x - 0.5)',
      color: colorBody,
      border: 0.01,
    }),
  },
  {
    label: 'Sweepout',
    shader: createSurfaceShader({
      sliceField: 'mod(1.25 - uv.y, 1.0)',
      color: colorBody,
      border: 0.005,
    }),
  },
  {
    label: 'By height',
    shader: createSurfaceShader({
      sliceField: '(pos.y + 2.75 * 0.4) / (6.25 * 0.4)',
      color: colorBody,
      border: 0.01,
    }),
  },
];

let currentMode = 0;
let shader = modes[currentMode].shader;

// --- Sliced surface + glass ---

const sliced = createSlicedSurface(klein, shader, {
  uSegments: 96,
  vSegments: 96,
});
const { mesh, glass } = sliced;
sliced.addTo(app.scene);

// --- Mode switching ---

function setMode(index: number) {
  currentMode = index;
  shader = modes[index].shader;
  mesh.setShader(shader);
}

window.addEventListener('keydown', (e) => {
  const n = parseInt(e.key);
  if (n >= 1 && n <= modes.length) setMode(n - 1);
});

// --- UI ---

let animate = true;

app.overlay.addSlider({
  label: 'Slice',
  min: 0, max: 1, step: 0.01, value: 1,
  format: (v) => `Slice = ${v.toFixed(2)}`,
  onChange: (v) => {
    animate = false;
    shader.uniforms.uSlice.value = v;
  },
});

app.overlay.addSlider({
  label: 'Width',
  min: 0.01, max: 1, step: 0.01, value: 1,
  format: (v) => `Width = ${v.toFixed(2)}`,
  onChange: (v) => { shader.uniforms.uSliceWidth.value = v; },
});

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') animate = !animate;
});

// --- Animation ---

app.addAnimateCallback((elapsed) => {
  if (animate) {
    let s = (1 - Math.cos(elapsed / 3)) / 2;
    s = 0.95 * s + 0.05;
    shader.uniforms.uSlice.value = s;
  }

  mesh.rotation.y = glass.rotation.y = elapsed * 0.1;
});

app.start();
