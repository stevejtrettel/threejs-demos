/**
 * Boy's Surface — an immersion of RP² in R³.
 *
 * Sliced rendering with glass overlay, using the SurfaceShader system.
 * Four slice modes reveal the surface's topology from different perspectives.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { BoysSurface } from '@/math/surfaces/BoysSurface';
import { createSurfaceShader, type SurfaceShaderResult } from '@/shaders/SurfaceShader';
import { createSlicedSurface } from '@/shaders/SlicedSurface';

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.fov = 30;
app.camera.updateProjectionMatrix();
app.camera.position.set(0, 2, 6);
app.controls.target.set(0, -0.3, 0);
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

const boys = new BoysSurface();

// --- Shader configs (one per slice mode) ---

const colorBody = `
  float hue = sliceField + 2.0 * uv.y;
  float sat = 0.75 * sqrt(uv.x);
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
    label: 'Möbius strip',
    shader: createSurfaceShader({
      sliceField: '1.0 - uv.x',
      color: colorBody,
      border: 0.01,
    }),
  },
  {
    label: 'From disk center',
    shader: createSurfaceShader({
      sliceField: 'uv.x',
      color: colorBody,
      border: 0.01,
    }),
  },
  {
    label: 'By height',
    shader: createSurfaceShader({
      sliceField: '(pos.y + 1.9) / 5.0',
      color: colorBody,
      border: 0.01,
    }),
  },
  {
    label: 'By angle',
    shader: createSurfaceShader({
      sliceField: 'uv.y',
      color: `
        float hue = sliceField + 2.0 * uv.y;
        float sat = 0.75 * sqrt(uv.x);
        vec3 base = hsb2rgb(vec3(hue, sat, 0.5));
        float grid = coordGrid(uv, 10.0);
        if (sliceField < 0.005 || 1.0 - uv.x < 0.015) {
          base = hsb2rgb(vec3(hue, 0.8, 0.1));
        }
        return base + 2.0 * vec3(grid);
      `,
      border: 0.01,
    }),
  },
];

let currentMode = 0;
let shader = modes[currentMode].shader;

// --- Sliced surface + glass overlay (one call) ---

const sliced = createSlicedSurface(boys, shader);
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
    const s = (1 - Math.cos(elapsed / 3)) / 2;
    shader.uniforms.uSlice.value = s;
  }

  mesh.rotation.y = glass.rotation.y = elapsed * 0.1;
});

app.start();
