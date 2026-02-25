/**
 * Weave from Quad Mesh — Vase
 *
 * Revolves a profile curve around the y-axis to make a quad mesh,
 * then weaves it with interlocking tube strands.
 */

import { App } from '@/app/App';
import { buildWeave } from '@/math';
import type { ParsedMesh } from '@/math/mesh/parseOBJ';
import * as THREE from 'three';

// --- Surface of revolution quad mesh ---

/**
 * Build a quad mesh by revolving a profile curve around the y-axis.
 *
 * @param profile - Function from t ∈ [0, 1] → { r, y } (radius and height)
 * @param nTheta - Divisions around the axis
 * @param nT - Divisions along the profile
 * @param closed - Whether the profile wraps (like a torus) vs open (like a vase)
 */
function makeRevolutionMesh(
  profile: (t: number) => { r: number; y: number },
  nTheta: number,
  nT: number,
  closed: boolean = false,
): ParsedMesh {
  const vertices: THREE.Vector3[] = [];
  const faces: number[][] = [];

  const tCount = closed ? nT : nT + 1;

  // Vertices
  for (let i = 0; i < nTheta; i++) {
    const theta = (i / nTheta) * 2 * Math.PI;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    for (let j = 0; j < tCount; j++) {
      const t = j / nT;
      const { r, y } = profile(t);
      vertices.push(new THREE.Vector3(r * cosT, y, r * sinT));
    }
  }

  // Faces: quads
  for (let i = 0; i < nTheta; i++) {
    const jMax = closed ? nT : nT;
    for (let j = 0; j < jMax; j++) {
      const a = i * tCount + j;
      const b = i * tCount + (j + 1) % tCount;
      const c = ((i + 1) % nTheta) * tCount + (j + 1) % tCount;
      const d = ((i + 1) % nTheta) * tCount + j;
      faces.push([a, b, c, d]);
    }
  }

  return { vertices, faces };
}

// --- Vase profile ---

function vaseProfile(t: number): { r: number; y: number } {
  // t ∈ [0, 1] maps bottom to top
  const y = t * 3 - 1.5; // height from -1.5 to 1.5

  // Vase shape: wide base, narrow neck, flared rim
  const base = 0.8 * Math.exp(-8 * (t - 0.1) * (t - 0.1));
  const body = 0.6 * Math.exp(-3 * (t - 0.4) * (t - 0.4));
  const neck = 0.25;
  const rim = 0.5 * Math.exp(-12 * (t - 0.95) * (t - 0.95));

  const r = Math.max(0.15, base + body + rim) * 0.8 + neck * 0.2;
  return { r, y };
}

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 2, 5);
app.controls.target.set(0, 0, 0);

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(5, 8, 3);
app.scene.add(light);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
app.backgrounds.setColor(0x1a1a2e);

// --- Weave ---

const vaseMesh = makeRevolutionMesh(vaseProfile, 24, 16);
const weave = buildWeave(vaseMesh, { amplitude: 0.04, samplesPerSegment: 10 });

const familyColors = [0xd4956a, 0x6a9fd4]; // warm terracotta / cool blue
const tubeRadius = 0.025;
const radialSegments = 8;

for (let i = 0; i < weave.strands.length; i++) {
  const strand = weave.strands[i];
  if (strand.length < 2) continue;

  const curve = new THREE.CatmullRomCurve3(strand, weave.strandClosed[i], 'catmullrom', 0.5);
  const geometry = new THREE.TubeGeometry(
    curve,
    strand.length * 4,
    tubeRadius,
    radialSegments,
    weave.strandClosed[i]
  );

  const material = new THREE.MeshPhysicalMaterial({
    color: familyColors[weave.strandFamilies[i]],
    roughness: 0.4,
    metalness: 0.1,
    clearcoat: 0.3,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  app.scene.add(mesh);
}

// --- Animate ---

app.addAnimateCallback((time) => {
  app.scene.rotation.y = time * 0.15;
});

app.start();
