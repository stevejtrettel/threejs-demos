/**
 * Periodic Geodesic Flow on the Space of Lattices
 *
 * Two curves in ℝ³ (stereographic projection of S³):
 * - Blue tube: the flow orbit of (g₂, g₃) Eisenstein invariants
 * - Red tube: the trefoil knot of degenerate lattices (Δ = 0)
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { LatticeFlow } from '@/math/lattices/LatticeFlow';
// import { Lattice2D } from '@/math/lattices/Lattice2D';  // uncomment for open flows
import { LatticePlane } from '@/math/lattices/LatticePlane';
import { latticeInvariants } from '@/math/lattices/invariants';
import { toS3 } from '@/math/lattices/projections';
import { cmul, csub, cabs2, type Complex } from '@/math/algebra/complex';

// --- App setup ---

const app = new App({ antialias: true });

app.camera.position.set(0, 4, 6);
app.controls.target.set(0, 0, 0);

// --- Bright mode ---

app.scene.background = new THREE.Color(0xf0f0f0);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
app.scene.add(dirLight);

// ═══════════════════════════════════════════════════════
//  ▶ CHANGE THIS TO TRY DIFFERENT FLOWS
// ═══════════════════════════════════════════════════════

// ── Option A: Closed geodesic from a hyperbolic SL(2,ℤ) matrix ──
const flow = LatticeFlow.fromMatrix([[7, 2], [17, 5]]);   // tr=3
//   LatticeFlow.fromMatrix([[3, 2], [1, 1]])   tr=4
//   LatticeFlow.fromMatrix([[5, 2], [2, 1]])   tr=6
//   LatticeFlow.fromMatrix([[7, 2], [3, 1]])   tr=8

// ── Option B: Open flow from a starting lattice ──
// const flow = LatticeFlow.fromLattice(new Lattice2D([1, 0], [0.3, 1]));

// --- Initial lattice ---

let currentLattice = flow.at(0);

// --- Lattice plane visualization ---

const plane = new LatticePlane({
  lattice: currentLattice,
  size: 40,
  showPoints: true,
  showReducedBasis: true,
  showGrid: false,
  pointRadius: 0.05,
  lineWidth: 0.015,
  basisWidth: 0.03,
  pointColor: 0x000000,
  gridColor: 0xbbbbbb,
  reducedBasisColor: 0x2266dd,
  backgroundColor: 0xffffff,
});

plane.rotation.x = -Math.PI / 2;
app.scene.add(plane);

// --- S³ curves container ---

const s3Group = new THREE.Group();
s3Group.position.set(4, 3.5, 0);
app.scene.add(s3Group);

// --- S³ normalization ---

const BALANCED = false;
const K = BALANCED ? Math.sqrt(27) : 1;

function stereo(s3: [number, number, number, number]): THREE.Vector3 {
  const [x1, x2, x3raw, x4raw] = s3;
  const x3 = K * x3raw;
  const x4 = K * x4raw;
  const norm = Math.sqrt(x1 * x1 + x2 * x2 + x3 * x3 + x4 * x4);
  const nx1 = x1 / norm, nx2 = x2 / norm, nx3 = x3 / norm, nx4 = x4 / norm;
  const d = 1 - nx4;
  if (Math.abs(d) < 1e-12) return new THREE.Vector3(nx1 * 1e6, nx2 * 1e6, nx3 * 1e6);
  return new THREE.Vector3(nx1 / d, nx2 / d, nx3 / d);
}

// --- S³ curve for the flow orbit ---

const FLOW_SAMPLES = 500;

if (flow.isClosed && flow.period !== undefined) {
  // Pre-compute the full closed loop as a tube
  const flowPoints: THREE.Vector3[] = [];
  let minRelDisc = Infinity;

  for (let i = 0; i <= FLOW_SAMPLES; i++) {
    const t = (i / FLOW_SAMPLES) * flow.period;
    const lat = flow.at(t);

    const { g2: g2v, g3: g3v } = latticeInvariants(lat);
    const g2cubed = cmul(cmul(g2v, g2v), g2v);
    const g3squared = cmul(g3v, g3v);
    const delta: Complex = csub(g2cubed, [27 * g3squared[0], 27 * g3squared[1]]);
    const relDisc = Math.sqrt(cabs2(delta) / cabs2(g2cubed));
    minRelDisc = Math.min(minRelDisc, relDisc);

    flowPoints.push(stereo(toS3(lat)));
  }

  console.log(`Flow orbit: min |Δ|/|g₂³| = ${minRelDisc.toFixed(6)}`);

  const flowCurve = new THREE.CatmullRomCurve3(flowPoints, true);
  const flowTube = new THREE.Mesh(
    new THREE.TubeGeometry(flowCurve, FLOW_SAMPLES, 0.03, 8, true),
    new THREE.MeshPhysicalMaterial({
      color: 0x33bbff, roughness: 0.2, metalness: 0.0, clearcoat: 1,
    }),
  );
  s3Group.add(flowTube);
}

// Live trail for open flows (or as overlay for closed ones)
const MAX_TRAIL_POINTS = 10000;
const trailBuffer = new Float32Array(MAX_TRAIL_POINTS * 3);
let trailCount = 0;

const trailGeometry = new THREE.BufferGeometry();
const trailPositionAttr = new THREE.BufferAttribute(trailBuffer, 3);
trailPositionAttr.setUsage(THREE.DynamicDrawUsage);
trailGeometry.setAttribute('position', trailPositionAttr);
trailGeometry.setDrawRange(0, 0);

const trailLine = new THREE.Line(
  trailGeometry,
  new THREE.LineBasicMaterial({ color: flow.isClosed ? 0x33bbff : 0x33bbff }),
);
s3Group.add(trailLine);

// --- Discriminant trefoil (Δ = 0) ---

let r2 = 0.98;
for (let i = 0; i < 50; i++) {
  const f = r2 * r2 * r2 + 27 * r2 * r2 - 27;
  const fp = 3 * r2 * r2 + 54 * r2;
  r2 -= f / fp;
}
const r3 = Math.sqrt(r2 * r2 * r2 / 27);

const TREFOIL_SAMPLES = 300;
const trefoilPoints: THREE.Vector3[] = [];

for (let i = 0; i <= TREFOIL_SAMPLES; i++) {
  const theta = (i / TREFOIL_SAMPLES) * 2 * Math.PI;
  trefoilPoints.push(stereo([
    r2 * Math.cos(2 * theta),
    r2 * Math.sin(2 * theta),
    r3 * Math.cos(3 * theta),
    r3 * Math.sin(3 * theta),
  ]));
}

const trefoilCurve = new THREE.CatmullRomCurve3(trefoilPoints, true);
s3Group.add(new THREE.Mesh(
  new THREE.TubeGeometry(trefoilCurve, TREFOIL_SAMPLES, 0.02, 8, true),
  new THREE.MeshPhysicalMaterial({
    color: 0xff1133, roughness: 0.2, metalness: 0.0, clearcoat: 1,
  }),
));

// --- Cursor ---

const cursor = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x33bbff }),
);
s3Group.add(cursor);

// --- Animate ---

const speed = 0.3;
let totalTime = 0;

app.addAnimateCallback((_time: number, delta: number) => {
  totalTime += delta * speed;

  currentLattice = flow.at(totalTime);
  plane.setLattice(currentLattice);

  // S³ cursor
  const pt = stereo(toS3(currentLattice));
  cursor.position.copy(pt);

  // Live trail (grows for open flows, confirms tube for closed ones)
  if (trailCount < MAX_TRAIL_POINTS) {
    const idx = trailCount * 3;
    trailBuffer[idx] = pt.x;
    trailBuffer[idx + 1] = pt.y;
    trailBuffer[idx + 2] = pt.z;
    trailCount++;
    trailGeometry.setDrawRange(0, trailCount);
    trailPositionAttr.needsUpdate = true;
  }
});

app.start();
