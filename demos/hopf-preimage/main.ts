/**
 * Hopf Preimage Demo
 *
 * An arc on S² between two points, with:
 * - The two endpoint fibers (colored circles) as boundary
 * - The preimage surface (strip) swept between them
 * - A base S² showing the arc and endpoint dots
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { hopfFiber, hopfPreimage } from '@/math/hopf';
import { fromSphericalCoords } from '@/math/hopf';
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';
import { CurveTube } from '@/math/curves/CurveTube';
import { NumericalCurve } from '@/math/curves/NumericalCurve';

// --- App setup ---

const app = new App({ antialias: true });

app.camera.position.set(0, 3, 6);
app.controls.target.set(0, 0, 0);

app.scene.background = new THREE.Color(0xeeeeee);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 7);
app.scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.6);
backLight.position.set(-5, -3, -5);
app.scene.add(backLight);

// --- Two points on S² and an arc between them ---

const pointA = { theta: 0.5, phi: Math.PI / 3 };
const pointB = { theta: 2.5, phi: 2 * Math.PI / 3 };

// Arc: linear interpolation in spherical coords
const arcCurve = (t: number) => ({
  theta: pointA.theta + (pointB.theta - pointA.theta) * t,
  phi: pointA.phi + (pointB.phi - pointA.phi) * t,
});

// --- Preimage surface of the arc (strip bounded by two fiber circles) ---

const preimage = hopfPreimage((t: number) => {
  const s = t / (2 * Math.PI);
  return arcCurve(s);
});

const surface = new SurfaceMesh(preimage, {
  uSegments: 128,
  vSegments: 64,
  color: 0xaaccee,
  roughness: 0.1,
  metalness: 0.1,
});
app.scene.add(surface);

// --- Boundary fiber circles at each endpoint ---

const TUBE_RADIUS = 0.04;

const fiberA = hopfFiber(pointA.theta, pointA.phi);
const fiberB = hopfFiber(pointB.theta, pointB.phi);

const tubeA = new CurveTube({
  curve: fiberA,
  radius: TUBE_RADIUS,
  radiusFn: (s) => TUBE_RADIUS * (1 + fiberA.getPointAt(s).lengthSq()),
  tubularSegments: 256,
  radialSegments: 16,
  showEndpoints: false,
  material: new THREE.MeshStandardMaterial({
    color: 0xcc3333,
    roughness: 0.3,
    metalness: 0.1,

  }),
});
app.scene.add(tubeA);

const tubeB = new CurveTube({
  curve: fiberB,
  radius: TUBE_RADIUS,
  radiusFn: (s) => TUBE_RADIUS * (1 + fiberB.getPointAt(s).lengthSq()),
  tubularSegments: 256,
  radialSegments: 16,
  showEndpoints: false,
  material: new THREE.MeshStandardMaterial({
    color: 0x3366cc,
    roughness: 0.3,
    metalness: 0.1,

  }),
});
app.scene.add(tubeB);

// --- Base S² sphere ---

const BASE_POS = new THREE.Vector3(4, 0, 0);
const BASE_RAD = 0.5;

const toBasePos = (angles: { theta: number; phi: number }) => {
  const p = fromSphericalCoords(angles);
  return new THREE.Vector3(p.x, p.z, -p.y).multiplyScalar(BASE_RAD).add(BASE_POS);
};

// Light glass sphere
const baseSphere = new THREE.Mesh(
  new THREE.SphereGeometry(BASE_RAD, 32, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0xddddff,
    transparent: true,
    transmission: 0.85,
    ior: 1.1,
    thickness: 0.2,
    roughness: 0.1,
    clearcoat: 1,
    metalness: 0,
  }),
);
baseSphere.position.copy(BASE_POS);
app.scene.add(baseSphere);

// Arc on the base sphere
const arcPoints: THREE.Vector3[] = [];
const N_ARC = 64;
for (let i = 0; i <= N_ARC; i++) {
  arcPoints.push(toBasePos(arcCurve(i / N_ARC)));
}
const baseArc = new NumericalCurve({ points: arcPoints, closed: false });
app.scene.add(new CurveTube({
  curve: baseArc,
  radius: 0.015,
  material: new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.4,
    metalness: 0,
  }),
  showEndpoints: false,
}));

// Endpoint spheres on S²
const dotMat = (color: number) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.3,
  metalness: 0.1,
});

const dotA = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), dotMat(0xcc3333));
dotA.position.copy(toBasePos(pointA));
app.scene.add(dotA);

const dotB = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), dotMat(0x3366cc));
dotB.position.copy(toBasePos(pointB));
app.scene.add(dotB);

app.start();
