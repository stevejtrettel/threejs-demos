/**
 * Three.js visualization of a ProjectivePlane.
 *
 * Renders all F_p × F_p points as spheres, with optional solution highlighting,
 * grid lines, and a point at infinity.
 */

import * as THREE from 'three';
import { ProjectivePlane } from './ProjectivePlane';

export interface ProjectivePlaneMeshOptions {
  solutions?: [number, number][];
  solutionMaterial?: THREE.Material;
  bgMaterial?: THREE.Material;
  gridLineMaterial?: THREE.Material;
  solutionRadius?: number;
  bgRadius?: number;
  showGridLines?: boolean;
  gridLineRadius?: number;
  showInfinity?: boolean;
  infinityPosition?: [number, number, number];
}

const defaultGlassMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0xc9eaff,
    transparent: true,
    clearcoat: 1,
    transmission: 0.9,
    ior: 1.5,
    thickness: 1,
    roughness: 0.2,
  });

const defaultSolutionMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0xd43b3b,
    clearcoat: 1,
    roughness: 0.1,
    metalness: 0.3,
  });

export class ProjectivePlaneMesh extends THREE.Group {
  constructor(plane: ProjectivePlane, options: ProjectivePlaneMeshOptions = {}) {
    super();

    const {
      solutions = [],
      solutionMaterial = defaultSolutionMaterial(),
      bgMaterial = defaultGlassMaterial(),
      gridLineMaterial,
      solutionRadius = 0.15,
      bgRadius = 0.1,
      showGridLines = false,
      gridLineRadius = 0.02,
      showInfinity = false,
      infinityPosition = [5, 0, 0],
    } = options;

    // Build a set for fast solution lookup
    const solSet = new Set(solutions.map(([x, y]) => `${x},${y}`));

    // Shared geometries
    const bgGeom = new THREE.SphereGeometry(bgRadius, 16, 16);
    const solGeom = new THREE.SphereGeometry(solutionRadius, 16, 16);

    // Place all field points
    for (const { fp, pos } of plane.allPoints()) {
      const isSolution = solSet.has(`${fp[0]},${fp[1]}`);
      const mesh = new THREE.Mesh(
        isSolution ? solGeom : bgGeom,
        isSolution ? solutionMaterial : bgMaterial,
      );
      mesh.position.set(pos[0], pos[1], pos[2]);
      this.add(mesh);
    }

    // Point at infinity
    if (showInfinity) {
      const infMesh = new THREE.Mesh(solGeom, solutionMaterial);
      infMesh.position.set(...infinityPosition);
      this.add(infMesh);
    }

    // Grid lines — works for any embedding by sampling the embed function.
    // For torus embeddings these are closed circles; for grid they are straight lines.
    if (showGridLines) {
      const lineMat = gridLineMaterial ?? bgMaterial;
      const p = plane.field.p;
      const half = (p - 1) / 2;
      const els = plane.field.elements();
      const N = 64;

      // Detect if the embedding is periodic (torus-like) by checking if
      // the endpoints wrap: embed(-half) ≈ embed(half+1) means closed.
      const testA = plane.embed(p, [-half, 0]);
      const testB = plane.embed(p, [half + 1, 0]);
      const dist = Math.hypot(testA[0] - testB[0], testA[1] - testB[1], testA[2] - testB[2]);
      const closed = dist < 0.01;

      // For closed curves, sweep the full period [0, p).
      // For open curves (grid), sweep [-half-0.5, half+0.5] with overhang.
      const lo = closed ? 0 : -half - 0.5;
      const hi = closed ? p : half + 0.5;

      for (const i of els) {
        // constant-y line: sweep x
        this.add(makeEmbeddedCurve(
          (t) => plane.embed(p, [lerp(lo, hi, t), i]),
          N, gridLineRadius, lineMat, closed,
        ));
        // constant-x line: sweep y
        this.add(makeEmbeddedCurve(
          (t) => plane.embed(p, [i, lerp(lo, hi, t)]),
          N, gridLineRadius, lineMat, closed,
        ));
      }
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function makeEmbeddedCurve(
  fn: (t: number) => [number, number, number],
  samples: number,
  radius: number,
  material: THREE.Material,
  closed: boolean,
): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= samples; i++) {
    const pos = fn(i / samples);
    pts.push(new THREE.Vector3(pos[0], pos[1], pos[2]));
  }
  const curve = new THREE.CatmullRomCurve3(pts, closed);
  const geom = new THREE.TubeGeometry(curve, samples, radius, 8, closed);
  return new THREE.Mesh(geom, material);
}
