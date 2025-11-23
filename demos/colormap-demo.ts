/**
 * Colormap System Demo
 *
 * Demonstrates both JavaScript and GLSL colormap implementations:
 * - Left: JS colormap (vertex colors on geometry)
 * - Center: GLSL colormap (shader-based, animated)
 * - Right: Different GLSL colormap
 */

import { App } from '../src/app/App';
import { viridis, plasma, applyColormap } from '../src/utils/colormaps';
import { glslColormaps } from '../src/utils/colormaps';
import * as THREE from 'three';

console.log('=== Colormap System Demo ===\n');
console.log('Left: JS vertex colors (viridis)');
console.log('Center: GLSL shader (plasma, animated)');
console.log('Right: GLSL shader (inferno)\n');

const app = new App({ antialias: true, debug: true });

// Setup scene
app.camera.position.set(0, 2, 8);
app.controls.target.set(0, 0, 0);
app.lights.set('three-point');
app.backgrounds.setColor(0x1a1a1a);

// === LEFT: JavaScript Colormap (Vertex Colors) ===
// Create a sphere with vertex colors based on height

const jsGeometry = new THREE.SphereGeometry(1, 64, 64);
const positions = jsGeometry.attributes.position;

// Calculate height values for each vertex
const heights: number[] = [];
for (let i = 0; i < positions.count; i++) {
  const y = positions.getY(i);
  heights.push(y);
}

// Apply viridis colormap to heights
const colors = applyColormap(heights, viridis);
jsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Material with vertex colors enabled
const jsMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  wireframe: false
});

const jsMesh = new THREE.Mesh(jsGeometry, jsMaterial);
jsMesh.position.set(-3, 0, 0);
app.scene.add(jsMesh);

console.log('✓ Created JS colormap sphere (vertex colors)');
console.log(`  - Vertices: ${positions.count}`);
console.log(`  - Colormap: viridis`);
console.log(`  - Min height: ${Math.min(...heights).toFixed(2)}`);
console.log(`  - Max height: ${Math.max(...heights).toFixed(2)}\n`);

// === CENTER: GLSL Colormap (Animated Shader) ===
// Create a sphere with shader-based coloring

const glslGeometry1 = new THREE.SphereGeometry(1, 64, 64);

// Shader with plasma colormap
const glslMaterial1 = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 }
  },
  vertexShader: `
    varying vec3 vPosition;
    varying vec2 vUv;

    void main() {
      vPosition = position;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    varying vec3 vPosition;
    varying vec2 vUv;

    ${glslColormaps.plasma}

    void main() {
      // Animate the colormap based on height and time
      float t = (vPosition.y + 1.0) * 0.5; // Map height -1..1 to 0..1
      t = t + sin(time * 0.5) * 0.2; // Animate
      t = clamp(t, 0.0, 1.0);

      vec3 color = plasma(t);
      gl_FragColor = vec4(color, 1.0);
    }
  `
});

const glslMesh1 = new THREE.Mesh(glslGeometry1, glslMaterial1);
glslMesh1.position.set(0, 0, 0);
app.scene.add(glslMesh1);

console.log('✓ Created GLSL colormap sphere (shader, animated)');
console.log('  - Colormap: plasma');
console.log('  - Animation: sin wave based on time\n');

// === RIGHT: GLSL Colormap (Inferno, UV-based) ===
// Create a sphere with shader-based coloring using UV coordinates

const glslGeometry2 = new THREE.SphereGeometry(1, 64, 64);

const glslMaterial2 = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;

    ${glslColormaps.inferno}

    void main() {
      // Color based on V coordinate (vertical)
      float t = vUv.y;
      vec3 color = inferno(t);
      gl_FragColor = vec4(color, 1.0);
    }
  `
});

const glslMesh2 = new THREE.Mesh(glslGeometry2, glslMaterial2);
glslMesh2.position.set(3, 0, 0);
app.scene.add(glslMesh2);

console.log('✓ Created GLSL colormap sphere (shader, UV-based)');
console.log('  - Colormap: inferno');
console.log('  - Mapping: UV.y (vertical coordinate)\n');

// === Animation ===
app.addAnimateCallback((time) => {
  // Rotate all spheres
  jsMesh.rotation.y = time * 0.0003;
  glslMesh1.rotation.y = time * 0.0003;
  glslMesh2.rotation.y = time * 0.0003;

  // Update shader time uniform
  glslMaterial1.uniforms.time.value = time * 0.001;
});

// Start rendering
app.start();

console.log('=== Colormap Functions Available ===');
console.log('JavaScript: viridis, plasma, inferno, coolwarm, rainbow, grayscale');
console.log('GLSL: viridis, plasma, inferno, rainbow');
console.log('\n✓ Demo running! Press D to toggle stats.');
