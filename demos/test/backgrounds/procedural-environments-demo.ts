/**
 * Procedural Environments Demo
 *
 * Shows different patterns for creating custom procedural environments:
 * 1. Simple gradient room
 * 2. Geometric pattern environment
 * 3. Starfield with nebula colors
 * 4. Combining scene environment with procedural sky
 *
 * Demonstrates the flexibility of scene-based environment generation.
 */

import { App } from '@/app/App';
import * as THREE from 'three';

console.log('=== Procedural Environments Demo ===\n');

const app = new App({
  antialias: true,
  debug: true,
  shadows: true,
  toneMapping: 'aces',
  toneMappingExposure: 1.0
});

// Setup camera
app.camera.position.set(0, 2, 8);
app.controls.target.set(0, 1, 0);

// === Create test objects ===

// Create a knot to show complex reflections
const knotGeo = new THREE.TorusKnotGeometry(0.8, 0.3, 128, 32);
const knotMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 1.0,
  roughness: 0.1,
  envMapIntensity: 1.5
});
const knot = new THREE.Mesh(knotGeo, knotMat);
knot.position.set(0, 2, 0);
knot.castShadow = true;
app.scene.add(knot);

// Ground
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x202020,
  roughness: 0.8,
  metalness: 0.2
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
app.scene.add(ground);

console.log('✓ Created test objects\n');

// === Pattern Selection ===
// Change this to try different environment patterns
const PATTERN = 'gradient-room'; // Options: 'gradient-room', 'geometric', 'starfield', 'neon-grid'

console.log(`Creating environment pattern: ${PATTERN}\n`);

let envScene: THREE.Scene;

switch (PATTERN) {
  case 'gradient-room':
    envScene = createGradientRoom();
    break;
  case 'geometric':
    envScene = createGeometricEnvironment();
    break;
  case 'starfield':
    envScene = createStarfieldEnvironment();
    break;
  case 'neon-grid':
    envScene = createNeonGridEnvironment();
    break;
  default:
    envScene = createGradientRoom();
}

// Render environment to cubemap
const envMap = app.backgrounds.createEnvironmentFromScene(envScene, {
  resolution: 512,
  intensity: 1.2,
  asBackground: true,
  asEnvironment: true
});

console.log('✓ Environment cubemap generated\n');

// Add lighting for shadows
const light = new THREE.DirectionalLight(0xffffff, 0.3);
light.position.set(5, 10, 5);
light.castShadow = true;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
app.scene.add(light);

// === Environment Pattern Creators ===

/**
 * Pattern 1: Gradient Room
 * Simple room with gradient walls (warm to cool)
 */
function createGradientRoom(): THREE.Scene {
  console.log('=== Gradient Room Environment ===');

  const scene = new THREE.Scene();

  // Create walls with different colors
  const wallSize = 30;

  // Back wall - warm orange
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(wallSize, wallSize),
    new THREE.MeshBasicMaterial({ color: 0xff6b35 })
  );
  backWall.position.z = -wallSize / 2;
  scene.add(backWall);

  // Front wall - cool blue
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(wallSize, wallSize),
    new THREE.MeshBasicMaterial({ color: 0x004e89 })
  );
  frontWall.position.z = wallSize / 2;
  frontWall.rotation.y = Math.PI;
  scene.add(frontWall);

  // Left wall - purple
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(wallSize, wallSize),
    new THREE.MeshBasicMaterial({ color: 0x9b5de5 })
  );
  leftWall.position.x = -wallSize / 2;
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);

  // Right wall - teal
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(wallSize, wallSize),
    new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
  );
  rightWall.position.x = wallSize / 2;
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // Ceiling - yellow
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(wallSize, wallSize),
    new THREE.MeshBasicMaterial({ color: 0xfee440 })
  );
  ceiling.position.y = wallSize / 2;
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);

  // Floor - green
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(wallSize, wallSize),
    new THREE.MeshBasicMaterial({ color: 0x06ffa5 })
  );
  floor.position.y = -wallSize / 2;
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Add soft ambient light
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  console.log('  ✓ Created colorful gradient room');
  console.log('  - Six walls with different colors');
  console.log('  - Creates vibrant color reflections\n');

  return scene;
}

/**
 * Pattern 2: Geometric Environment
 * Abstract geometric shapes floating in space
 */
function createGeometricEnvironment(): THREE.Scene {
  console.log('=== Geometric Environment ===');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // Create floating geometric shapes with emissive materials
  const shapes = [
    { geo: new THREE.IcosahedronGeometry(2), color: 0xff006e, pos: [-5, 3, -5] },
    { geo: new THREE.OctahedronGeometry(2.5), color: 0x06ffa5, pos: [5, 2, -3] },
    { geo: new THREE.TetrahedronGeometry(2), color: 0xfb5607, pos: [-3, -2, 5] },
    { geo: new THREE.DodecahedronGeometry(1.5), color: 0x8338ec, pos: [4, -1, 4] },
    { geo: new THREE.BoxGeometry(3, 3, 3), color: 0x3a86ff, pos: [0, 4, 0] },
  ];

  shapes.forEach(({ geo, color, pos }) => {
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, wireframe: false })
    );
    mesh.position.set(...pos);
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    scene.add(mesh);

    // Add point light at each shape
    const light = new THREE.PointLight(color, 50, 30);
    light.position.copy(mesh.position);
    scene.add(light);
  });

  console.log('  ✓ Created geometric floating shapes');
  console.log('  - 5 different polyhedra');
  console.log('  - Point lights for glow effect\n');

  return scene;
}

/**
 * Pattern 3: Starfield Environment
 * Procedural starfield with nebula colors
 */
function createStarfieldEnvironment(): THREE.Scene {
  console.log('=== Starfield Environment ===');

  const scene = new THREE.Scene();

  // Create large sphere for stars (viewed from inside)
  const starsGeo = new THREE.SphereGeometry(100, 32, 32);
  const starsMat = new THREE.MeshBasicMaterial({
    color: 0x000033,
    side: THREE.BackSide
  });
  const stars = new THREE.Mesh(starsGeo, starsMat);
  scene.add(stars);

  // Add nebula-like colored lights
  const nebulas = [
    { color: 0xff006e, pos: [40, 30, -40], intensity: 100 },
    { color: 0x06ffa5, pos: [-40, -20, 30], intensity: 80 },
    { color: 0x8338ec, pos: [30, -30, -30], intensity: 90 },
    { color: 0xfb5607, pos: [-30, 40, 40], intensity: 85 },
  ];

  nebulas.forEach(({ color, pos, intensity }) => {
    const light = new THREE.PointLight(color, intensity, 200);
    light.position.set(...pos);
    scene.add(light);

    // Add visible sphere for nebula
    const nebulaSphere = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })
    );
    nebulaSphere.position.set(...pos);
    scene.add(nebulaSphere);
  });

  // Add many small point lights as stars
  for (let i = 0; i < 200; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = 80;

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    const starLight = new THREE.PointLight(0xffffff, Math.random() * 2, 50);
    starLight.position.set(x, y, z);
    scene.add(starLight);
  }

  console.log('  ✓ Created starfield with nebulas');
  console.log('  - 200 star point lights');
  console.log('  - 4 colored nebula regions\n');

  return scene;
}

/**
 * Pattern 4: Neon Grid Environment
 * Cyberpunk-style grid with neon lights
 */
function createNeonGridEnvironment(): THREE.Scene {
  console.log('=== Neon Grid Environment ===');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  // Create grid floor
  const gridSize = 50;
  const divisions = 20;
  const gridHelper = new THREE.GridHelper(gridSize, divisions, 0xff00ff, 0x00ffff);
  gridHelper.position.y = -10;
  scene.add(gridHelper);

  // Create vertical neon tubes
  const tubeGeo = new THREE.CylinderGeometry(0.2, 0.2, 30, 8);
  const neonColors = [0xff00ff, 0x00ffff, 0xff0080, 0x00ff80];

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const radius = 15;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const color = neonColors[i % neonColors.length];
    const tube = new THREE.Mesh(
      tubeGeo,
      new THREE.MeshBasicMaterial({ color })
    );
    tube.position.set(x, 0, z);
    scene.add(tube);

    // Add point light
    const light = new THREE.PointLight(color, 80, 40);
    light.position.set(x, 0, z);
    scene.add(light);
  }

  // Add ceiling glow
  const ceilingLight = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ color: 0x4a0080, side: THREE.DoubleSide })
  );
  ceilingLight.position.y = 15;
  ceilingLight.rotation.x = -Math.PI / 2;
  scene.add(ceilingLight);

  console.log('  ✓ Created neon grid environment');
  console.log('  - Grid floor with neon colors');
  console.log('  - 12 vertical neon tubes');
  console.log('  - Cyberpunk aesthetic\n');

  return scene;
}

// === Animation ===
app.addAnimateCallback((time) => {
  // Rotate knot
  knot.rotation.x = time * 0.0002;
  knot.rotation.y = time * 0.0003;
});

// Start rendering
app.start();

console.log('=== Try Different Patterns ===');
console.log('Change the PATTERN variable to try:');
console.log('  - "gradient-room": Colorful walls');
console.log('  - "geometric": Floating polyhedra');
console.log('  - "starfield": Space nebula');
console.log('  - "neon-grid": Cyberpunk grid\n');

console.log('✓ Demo running! Press D for debug stats.');
console.log('\nNotice how the metallic knot reflects the environment!');
