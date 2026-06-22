/**
 * Torus Grid — 100 polyhedral tori in a 10×10 grid, path-traceable.
 *
 * Each torus is an 8-vertex triangulation (a point in ℝ²⁴ = 8 points in ℝ³)
 * assembled into faces + edge-tubes + vertex-balls and baked, with the whole
 * grid, into a handful of static merged meshes by `buildTorusFarm` — the form
 * `three-gpu-pathtracer` can actually render (it ignores InstancedMesh and
 * LineSegments).
 *
 * Right now every cell uses `torus7` (Rich's reference embedding) as a stand-in
 * with a little per-cell rotation for variety. Swap `ENTRIES` for the real
 * dataset (100 × 24 numbers + per-torus topology/class) when it's ready — the
 * builder already takes a `Torus` and `positions` per entry, so nothing else
 * changes.
 */

import { App } from '@/app/App';
import * as THREE from 'three';
import { PhysicalCamera, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { Panel } from '@/ui/containers/Panel';
import { Button } from '@/ui/inputs/Button';
import '@/ui/styles/index.css';

import { torus7 } from '@/tori/torus7';
import type { Torus } from '@/tori/defineTorus';
import { buildTorusFarm, type FarmEntry } from '@/math/mesh/TorusFarm';

// ===================================
// APP + ENVIRONMENT
// ===================================

const app = new App({
  debug: true,
  antialias: true,
  pathTracerDefaults: { bounces: 6, samples: 1, tiles: { x: 3, y: 3 } },
});

const env = new GradientEquirectTexture();
env.topColor.set(0x8aa0bf);
env.bottomColor.set(0xd8d8dc);
env.update();
app.scene.environment = env;
app.scene.background = env;

// ===================================
// FLOOR
// ===================================

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshPhysicalMaterial({
    color: 0x4a5560,
    roughness: 0.45,
    metalness: 0.0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
app.scene.add(floor);

// ===================================
// LIGHTS  (env carries path-traced IBL; these add shape + WebGL preview)
// ===================================

const previewLight = new THREE.DirectionalLight(0xffffff, 1.1);
previewLight.position.set(8, 14, 6);
app.scene.add(previewLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
app.scene.add(ambientLight);

// ===================================
// GRID OF TORI
// ===================================

const GRID = 10;            // 10×10 = 100
const SPACING = 1.6;        // cell pitch (world units)
const TORUS_SCALE = 0.5;    // shrink each torus to sit inside its cell
const CELL_Y = 1.2;         // height of each torus centre above the floor

// Class colors — one material per class (struts stay dark via the builder default).
const CLASS_COLORS = [0xe2554f, 0xf2a23c, 0xf2d04b, 0x6fbf73, 0x4f9bd9, 0x9b6fd9];
const styles: Record<string, { faceColor: number }> = {};
CLASS_COLORS.forEach((c, i) => (styles[`c${i}`] = { faceColor: c }));

// Stand-in geometry: torus7's reference embedding, flattened + recentred.
const topology: Torus = torus7;
const refCoords = torus7.referenceCoords!;
const localPositions = new Float32Array(refCoords.length * 3);
const centroid = new THREE.Vector3();
for (let i = 0; i < refCoords.length; i++) {
  const [x, y, z] = refCoords[i];
  localPositions[3 * i] = x;
  localPositions[3 * i + 1] = y;
  localPositions[3 * i + 2] = z;
  centroid.add(new THREE.Vector3(x, y, z));
}
centroid.multiplyScalar(1 / refCoords.length);

// Reused factor matrices (recentre → scale → tilt is constant; rotate + place vary).
const Trecentre = new THREE.Matrix4().makeTranslation(-centroid.x, -centroid.y, -centroid.z);
const S = new THREE.Matrix4().makeScale(TORUS_SCALE, TORUS_SCALE, TORUS_SCALE);
const Rtilt = new THREE.Matrix4().makeRotationX(-Math.PI / 2.2); // lay the z-tall shape toward camera

const entries: FarmEntry[] = [];
for (let row = 0; row < GRID; row++) {
  for (let col = 0; col < GRID; col++) {
    const idx = row * GRID + col;

    const cx = (col - (GRID - 1) / 2) * SPACING;
    const cz = (row - (GRID - 1) / 2) * SPACING;
    const Tcell = new THREE.Matrix4().makeTranslation(cx, CELL_Y, cz);
    const Ry = new THREE.Matrix4().makeRotationY(idx * 0.4); // deterministic per-cell spin

    // world = Tcell · Ry · Rtilt · S · Trecentre
    const placement = new THREE.Matrix4()
      .multiply(Tcell)
      .multiply(Ry)
      .multiply(Rtilt)
      .multiply(S)
      .multiply(Trecentre);

    entries.push({
      topology,
      positions: localPositions,
      placement,
      classId: `c${idx % CLASS_COLORS.length}`,
    });
  }
}

const farm = buildTorusFarm(entries, {
  vertexRadius: 0.05,
  edgeRadius: 0.022,
  sphereDetail: 2,
  tubeRadialSegments: 8,
  styles,
});
app.scene.add(farm.group);
console.log(`TorusFarm: ${entries.length} tori, ${farm.triangleCount.toLocaleString()} triangles`);

// ===================================
// PHYSICAL CAMERA  (DOF-capable; viewing the whole grid)
// ===================================

const camera = new PhysicalCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 13, 17);
camera.lookAt(0, 1, 0);
(app.cameraManager as any).camera = camera;
(app.controls.controls as any).object = camera;
(app.layout as any).camera = camera;

// ===================================
// PATH-TRACE TOGGLE
// ===================================

const panel = new Panel('Render');
let pathTracing = false;
const ptButton = new Button('Start Path Trace', () => {
  pathTracing = !pathTracing;
  if (pathTracing) {
    previewLight.intensity = 0;
    ambientLight.intensity = 0;
    app.enablePathTracing();
    ptButton.setLabel('Stop Path Trace');
    ptButton.domElement.style.backgroundColor = '#c94444';
  } else {
    app.disablePathTracing();
    previewLight.intensity = 1.1;
    ambientLight.intensity = 0.25;
    ptButton.setLabel('Start Path Trace');
    ptButton.domElement.style.backgroundColor = '#44aa44';
  }
});
ptButton.domElement.style.cssText = 'background:#44aa44;color:#fff;font-weight:bold;padding:8px 12px';
panel.add(ptButton);
panel.mount(document.body);

app.start();
