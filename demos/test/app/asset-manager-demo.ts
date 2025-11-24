/**
 * AssetManager Demo
 *
 * Shows how to load textures, HDRIs, and shaders using app.assets
 *
 * Features demonstrated:
 * - Load texture and apply to sphere
 * - Load HDRI for environment lighting
 * - Load custom shader
 * - Asset caching (loading same asset twice)
 */

import { App } from '@/app/App';
import { ParametricSurface } from '@/core/objects/ParametricSurface';
import * as THREE from 'three';

// Create app
const app = new App({
  antialias: true,
  shadows: true
});

// Set up camera
app.camera.position.set(3, 3, 5);
app.controls.target.set(0, 0, 0);

// Add lights
app.lights.set('three-point');

// Set background
app.backgrounds.setColor(0x1a1a1a);

async function loadAssets() {
  console.log('=== AssetManager Demo ===');

  // === 1. Load a texture ===
  console.log('\n1. Loading texture...');
  const texture = await app.assets.loadTexture('/assets/textures/uv-test.png');

  if (texture) {
    console.log('✓ Texture loaded!', texture);

    // Apply texture to a sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.5,
        metalness: 0.1
      })
    );
    sphere.position.set(-2, 0, 0);
    app.scene.add(sphere);

    console.log('✓ Texture applied to sphere');
  }

  // === 2. Load texture AGAIN (from cache) ===
  console.log('\n2. Loading same texture again (should use cache)...');
  const cachedTexture = await app.assets.loadTexture('/assets/textures/uv-test.png');
  console.log('✓ Got texture from cache:', cachedTexture === texture ? 'YES' : 'NO');

  // === 3. Load HDRI environment map ===
  console.log('\n3. Loading HDRI environment map...');
  const hdri = await app.assets.loadHDRI('/assets/hdri/studio.hdr');

  if (hdri) {
    console.log('✓ HDRI loaded!');

    // Set as environment (for reflections)
    app.scene.environment = hdri;

    // Optionally set as background
    // app.scene.background = hdri;

    console.log('✓ HDRI set as environment (check reflections on chrome sphere)');

    // Add a shiny chrome sphere to show reflections
    const chromeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshStandardMaterial({
        roughness: 0.05,
        metalness: 1.0,
        color: 0xffffff
      })
    );
    chromeSphere.position.set(0, 0, 0);
    app.scene.add(chromeSphere);
  }

  // === 4. Load custom shader (inline for demo) ===
  console.log('\n4. Loading shader from string...');

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      // Animate colors based on UV and time
      vec3 color1 = vec3(1.0, 0.2, 0.5);
      vec3 color2 = vec3(0.2, 0.5, 1.0);

      float t = sin(vUv.x * 10.0 + time) * 0.5 + 0.5;
      vec3 color = mix(color1, color2, t);

      // Add lighting from normal
      float lighting = dot(vNormal, normalize(vec3(1.0, 1.0, 1.0))) * 0.5 + 0.5;
      color *= lighting;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const shader = app.assets.loadShaderFromString(vertexShader, fragmentShader, 'animated-shader');
  console.log('✓ Shader loaded from string');

  // Create shader material
  const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader: shader.vertex,
    fragmentShader: shader.fragment,
    uniforms: {
      time: { value: 0 }
    }
  });

  // Apply to a torus
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.3, 16, 32),
    shaderMaterial
  );
  torus.position.set(2, 0, 0);
  app.scene.add(torus);

  console.log('✓ Custom shader applied to torus');

  // Animate shader
  app.addAnimateCallback((time) => {
    shaderMaterial.uniforms.time.value = time * 0.001;
  });

  // === 5. Check cache ===
  console.log('\n5. Asset cache status:');
  console.log(`   Total cached assets: ${app.assets.getCacheSize()}`);
  console.log(`   Is texture cached? ${app.assets.isCached('/assets/textures/uv-test.png')}`);
  console.log(`   Is HDRI cached? ${app.assets.isCached('/assets/hdri/studio.hdr')}`);

  console.log('\n=== Demo Complete! ===');
  console.log('You should see:');
  console.log('  - Left: Textured sphere');
  console.log('  - Center: Chrome sphere (with HDRI reflections)');
  console.log('  - Right: Animated shader torus');
}

// Start loading assets
loadAssets().catch(err => {
  console.error('Error loading assets:', err);
});

// Start animation loop
app.start();

// Add instructions to page (using createElement to avoid destroying the canvas)
const instructions = document.createElement('div');
instructions.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 20px;
  font-family: monospace;
  font-size: 14px;
  border-radius: 4px;
  max-width: 300px;
`;

instructions.innerHTML = `
  <h3 style="margin-top: 0">AssetManager Demo</h3>
  <p><strong>Press D</strong> - Toggle debug stats</p>
  <p style="margin: 10px 0;">Check console for asset loading details!</p>
  <hr style="border: 1px solid #444; margin: 10px 0">
  <p style="font-size: 12px; margin: 5px 0;">Left: Textured sphere</p>
  <p style="font-size: 12px; margin: 5px 0;">Center: Chrome (HDRI reflections)</p>
  <p style="font-size: 12px; margin: 5px 0;">Right: Animated shader</p>
`;

document.body.appendChild(instructions);
