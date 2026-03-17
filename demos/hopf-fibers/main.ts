/**
 * Hopf Fibers Demo
 *
 * A random collection of N points on S², each shown as a dot on a
 * base sphere, with their Hopf fibers drawn in matching colors.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { hopfFiber, fromSphericalCoords } from '@/math/hopf';
import { CurveTube } from '@/math/curves/CurveTube';

// --- App setup ---

const app = new App({ antialias: true });

app.camera.position.set(0, 3, 6);
app.controls.target.set(0, 0, 0);

app.scene.background = new THREE.Color(0x111122);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 7);
app.scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
backLight.position.set(-5, -3, -5);
app.scene.add(backLight);

// --- Parameters ---

const N = 20;
const TUBE_RADIUS = 0.03;
const USE_VARIABLE_RADIUS = true;

// --- Base S² sphere ---

const BASE_POS = new THREE.Vector3(4, 0, 0);
const BASE_RAD = 0.6;

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

// --- Generate random points on S² and their fibers ---

const hueStep = 1 / N;

for (let i = 0; i < N; i++) {
  // Uniform random point on S²
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.acos(2 * Math.random() - 1);

  // Color from hue wheel
  const color = new THREE.Color().setHSL(i * hueStep, 0.7, 0.55);

  // Dot on base sphere
  const p = fromSphericalCoords({ theta, phi });
  const dotPos = new THREE.Vector3(p.x, p.z, -p.y)
    .multiplyScalar(BASE_RAD)
    .add(BASE_POS);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 12, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 }),
  );
  dot.position.copy(dotPos);
  app.scene.add(dot);

  // Hopf fiber
  const fiber = hopfFiber(theta, phi);

  const tubeOpts: ConstructorParameters<typeof CurveTube>[0] = {
    curve: fiber,
    radius: TUBE_RADIUS,
    tubularSegments: 128,
    radialSegments: 12,
    showEndpoints: false,
    material: new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.1,
    }),
  };

  if (USE_VARIABLE_RADIUS) {
    tubeOpts.radiusFn = (s) =>
      TUBE_RADIUS * (1 + fiber.getPointAt(s).lengthSq());
  }

  app.scene.add(new CurveTube(tubeOpts));
}

app.start();
