/**
 * Group Management Demo
 *
 * Demonstrates the GroupManager for organizing complex scenes.
 *
 * Features:
 * - Creating named groups
 * - Adding objects to groups
 * - Hierarchical groups (nested groups)
 * - Show/hide groups
 * - Bulk transforms on groups
 * - Object naming and lookup
 * - Tags for categorization
 * - Scene inspection
 */

import { App } from '@/app/App';
import { GroupManager } from '@/scene/GroupManager';
import * as THREE from 'three';

console.log('=== Group Management Demo ===\n');

const app = new App({
  antialias: true,
  debug: true,
  toneMapping: 'aces',
  toneMappingExposure: 1.0
});

// Create group manager
const groups = new GroupManager(app.scene);

// Setup camera
app.camera.position.set(8, 8, 8);
app.controls.target.set(0, 0, 0);

// Setup environment
app.backgrounds.setColor(0x1a1a2e);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
app.scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
app.scene.add(directionalLight);

// Enable debug helpers
app.debug.showStats(true);
app.debug.toggleGrid();
app.debug.toggleAxes();

console.log('=== Creating Groups ===\n');

// === Create named groups ===

// Create a group for geometric primitives
groups.create('primitives', { visible: true });
console.log('✓ Created group: primitives');

// Create a group for curves
groups.create('curves', { visible: true, tags: ['mathematical', 'curves'] });
console.log('✓ Created group: curves');

// Create nested group structure
groups.create('visualization');
groups.create('surfaces', { parent: 'visualization', tags: ['mathematical', 'surfaces'] });
console.log('✓ Created nested group: surfaces (parent: visualization)');

console.log('');

// === Add objects to groups ===

console.log('=== Adding Objects to Groups ===\n');

// Add primitive shapes to the 'primitives' group
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.3, metalness: 0.7 })
);
groups.add(sphere, 'primitives', 'redSphere', ['geometric', 'sphere']);
console.log('✓ Added sphere to primitives group');

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.2, 1.2),
  new THREE.MeshStandardMaterial({ color: 0x4ecdc4, roughness: 0.5, metalness: 0.5 })
);
groups.add(cube, 'primitives', 'cyanCube', ['geometric', 'cube']);
console.log('✓ Added cube to primitives group');

const cone = new THREE.Mesh(
  new THREE.ConeGeometry(0.6, 1.8, 32),
  new THREE.MeshStandardMaterial({ color: 0xffe66d, roughness: 0.4, metalness: 0.6 })
);
groups.add(cone, 'primitives', 'yellowCone', ['geometric', 'cone']);
console.log('✓ Added cone to primitives group');

// Position primitives
sphere.position.set(-3, 0.8, 0);
cube.position.set(-3, 0.6, -2.5);
cone.position.set(-3, 0.9, 2.5);

console.log('');

// Add curves to the 'curves' group
console.log('Adding curves to curves group...');

const helixPoints: THREE.Vector3[] = [];
for (let i = 0; i <= 100; i++) {
  const t = (i / 100) * Math.PI * 4;
  helixPoints.push(new THREE.Vector3(
    Math.cos(t) * 0.8,
    t * 0.3,
    Math.sin(t) * 0.8
  ));
}
const helixCurve = new THREE.CatmullRomCurve3(helixPoints);
const helixGeometry = new THREE.TubeGeometry(helixCurve, 100, 0.05, 8, false);
const helix = new THREE.Mesh(
  helixGeometry,
  new THREE.MeshStandardMaterial({ color: 0xff6fb5, roughness: 0.3, metalness: 0.7 })
);
groups.add(helix, 'curves', 'helix', ['parametric']);
console.log('✓ Added helix to curves group');

// Lissajous curve
const lissajousPoints: THREE.Vector3[] = [];
for (let i = 0; i <= 200; i++) {
  const t = (i / 200) * Math.PI * 2;
  lissajousPoints.push(new THREE.Vector3(
    Math.sin(3 * t) * 0.8,
    Math.sin(2 * t) * 0.8,
    Math.cos(5 * t) * 0.8
  ));
}
const lissajousCurve = new THREE.CatmullRomCurve3(lissajousPoints, true);
const lissajousGeometry = new THREE.TubeGeometry(lissajousCurve, 200, 0.04, 8, true);
const lissajous = new THREE.Mesh(
  lissajousGeometry,
  new THREE.MeshStandardMaterial({ color: 0xa8e6cf, roughness: 0.2, metalness: 0.8 })
);
groups.add(lissajous, 'curves', 'lissajous', ['parametric']);
console.log('✓ Added lissajous curve to curves group');

// Position curves
helix.position.set(0, 0, 0);
lissajous.position.set(3, 0, 0);

console.log('');

// Add surfaces to the 'surfaces' group (nested)
console.log('Adding surfaces to surfaces group (nested under visualization)...');

const torusKnot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.7, 0.25, 100, 16),
  new THREE.MeshStandardMaterial({ color: 0xffd93d, roughness: 0.2, metalness: 0.8 })
);
groups.add(torusKnot, 'surfaces', 'torusKnot', ['parametric', 'knot']);
torusKnot.position.set(3, 0, -3);
console.log('✓ Added torus knot to surfaces group');

console.log('');

// === Demonstrate group operations ===

console.log('=== Group Operations ===\n');

// List all groups
console.log('All groups:', groups.list());
console.log('');

// Count objects in each group
console.log('Group counts:');
console.log(`  primitives: ${groups.count('primitives')} objects`);
console.log(`  curves: ${groups.count('curves')} objects`);
console.log(`  surfaces: ${groups.count('surfaces')} objects`);
console.log(`  visualization: ${groups.count('visualization')} objects (recursive)`);
console.log('');

// Get objects by tag
const geometricObjects = groups.getObjectsByTag('geometric');
console.log(`Found ${geometricObjects.length} objects with tag 'geometric'`);

const parametricObjects = groups.getObjectsByTag('parametric');
console.log(`Found ${parametricObjects.length} objects with tag 'parametric'`);
console.log('');

// Object lookup by name
const foundSphere = groups.getObject('redSphere');
console.log(`Looked up 'redSphere':`, foundSphere ? 'Found!' : 'Not found');

const foundHelix = groups.getObject('helix');
console.log(`Looked up 'helix':`, foundHelix ? 'Found!' : 'Not found');
console.log('');

// Print group hierarchy
groups.printHierarchy();
console.log('');

// Get statistics
const stats = groups.getStats();
console.log('Group Statistics:');
console.log(`  Total groups: ${stats.totalGroups}`);
console.log(`  Total objects: ${stats.totalObjects}`);
console.log(`  Tagged objects: ${stats.taggedObjects}`);
console.log('');

// === Demonstrate bulk operations ===

console.log('=== Keyboard Controls ===\n');
console.log('Press these keys to demonstrate group operations:');
console.log('  1 - Toggle primitives group visibility');
console.log('  2 - Toggle curves group visibility');
console.log('  3 - Toggle surfaces group visibility');
console.log('  4 - Toggle visualization group (parent) visibility');
console.log('  5 - Rotate primitives group');
console.log('  6 - Scale curves group');
console.log('  7 - Move surfaces group');
console.log('  D - Toggle debug stats');
console.log('  G - Toggle grid');
console.log('  A - Toggle axes\n');

// Add keyboard controls
let primitiveRotation = 0;
let curvesScale = 1;
let surfacesHeight = 0;

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case '1':
      groups.toggle('primitives');
      break;
    case '2':
      groups.toggle('curves');
      break;
    case '3':
      groups.toggle('surfaces');
      break;
    case '4':
      groups.toggle('visualization');
      break;
    case '5':
      primitiveRotation += Math.PI / 4;
      groups.setRotation('primitives', 0, primitiveRotation, 0);
      console.log(`Rotated primitives group to ${(primitiveRotation * 180 / Math.PI).toFixed(0)}°`);
      break;
    case '6':
      curvesScale = curvesScale === 1 ? 1.5 : 1;
      groups.setScale('curves', curvesScale, curvesScale, curvesScale);
      console.log(`Scaled curves group to ${curvesScale}x`);
      break;
    case '7':
      surfacesHeight = surfacesHeight === 0 ? 2 : 0;
      groups.setPosition('surfaces', 3, surfacesHeight, -3);
      console.log(`Moved surfaces group to height ${surfacesHeight}`);
      break;
  }
});

// === Animation ===

app.addAnimateCallback((time) => {
  const t = time * 0.001;

  // Rotate individual objects within groups
  if (groups.get('primitives')?.visible) {
    sphere.rotation.y = t * 0.5;
    cube.rotation.x = t * 0.4;
    cube.rotation.y = t * 0.6;
    cone.rotation.y = t * 0.7;
  }

  if (groups.get('curves')?.visible) {
    helix.rotation.y = t * 0.3;
    lissajous.rotation.x = t * 0.2;
    lissajous.rotation.y = t * 0.4;
  }

  if (groups.get('surfaces')?.visible) {
    torusKnot.rotation.x = t * 0.5;
    torusKnot.rotation.y = t * 0.3;
  }
});

// Start rendering
app.start();

console.log('=== Demo Running ===');
console.log('✓ Groups created and populated');
console.log('✓ Objects are organized hierarchically');
console.log('✓ Try the keyboard controls to manipulate groups!');
console.log('✓ Notice how hiding a parent group hides all children\n');

// Additional examples logged to console
console.log('=== API Examples ===\n');

console.log('// Get all objects in a group');
console.log("const objects = groups.getObjectsInGroup('primitives');");
console.log('');

console.log('// Hide an entire group');
console.log("groups.hide('curves');");
console.log('');

console.log('// Apply transform to group');
console.log('const matrix = new THREE.Matrix4().makeRotationY(Math.PI / 2);');
console.log("groups.applyTransform('primitives', matrix);");
console.log('');

console.log('// Find objects by tag');
console.log("const mathObjects = groups.getObjectsByTag('mathematical');");
console.log('');

console.log('// Get object by name');
console.log("const sphere = groups.getObject('redSphere');");
console.log('');

console.log('// Clear a group');
console.log("groups.clear('primitives', true); // with disposal");
console.log('');
