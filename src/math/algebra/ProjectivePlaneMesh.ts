/**
 * Three.js visualization of a ProjectivePlane.
 *
 * Renders all p²+p+1 projective points as spheres with a generic layer system.
 * Each layer provides a set of points, a material, and a radius.
 * Later layers in the array take priority over earlier ones.
 * Points not claimed by any layer get the background (glass) treatment.
 */

import * as THREE from 'three';
import { ProjectivePlane } from './ProjectivePlane';
import type { ProjectivePoint } from './finiteField';

export interface PointLayer {
  /** Points as [X,Y,Z] projective coords, or [x,y] affine (auto-lifted to [x,y,1]). */
  points: ProjectivePoint[] | [number, number][];
  material: THREE.Material;
  radius: number;
}

export interface LineSpec {
  from: ProjectivePoint;
  to: ProjectivePoint;
  material: THREE.Material;
  radius: number;
}

export interface ProjectivePlaneMeshOptions {
  layers?: PointLayer[];
  lines?: LineSpec[];
  bgMaterial?: THREE.Material;
  bgRadius?: number;
  infinityBgMaterial?: THREE.Material;
  infinityBgRadius?: number;
  showGridLines?: boolean;
  gridLineMaterial?: THREE.Material;
  gridLineRadius?: number;
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

/** Normalize a layer point to a canonical "X,Y,Z" key. */
function pointKey(pt: number[]): string {
  if (pt.length === 2) return `${pt[0]},${pt[1]},1`;
  return `${pt[0]},${pt[1]},${pt[2]}`;
}

export class ProjectivePlaneMesh extends THREE.Group {
  constructor(plane: ProjectivePlane, options: ProjectivePlaneMeshOptions = {}) {
    super();

    const {
      layers = [],
      lines = [],
      bgMaterial = defaultGlassMaterial(),
      bgRadius = 0.1,
      infinityBgMaterial,
      infinityBgRadius,
      showGridLines = false,
      gridLineMaterial,
      gridLineRadius = 0.02,
    } = options;

    // Pre-build lookup sets and geometries per layer
    const compiled = layers.map(layer => ({
      set: new Set(layer.points.map(pt => pointKey(pt as number[]))),
      geom: new THREE.SphereGeometry(layer.radius, 16, 16),
      material: layer.material,
    }));

    const bgGeom = new THREE.SphereGeometry(bgRadius, 16, 16);
    const infBgMat = infinityBgMaterial ?? bgMaterial;
    const infBgGeom = infinityBgRadius
      ? new THREE.SphereGeometry(infinityBgRadius, 16, 16)
      : bgGeom;

    // Place all projective points — last layer wins
    for (const { proj, pos, isInfinity } of plane.allPoints()) {
      const key = `${proj[0]},${proj[1]},${proj[2]}`;
      let geom: THREE.SphereGeometry = isInfinity ? infBgGeom : bgGeom;
      let mat: THREE.Material = isInfinity ? infBgMat : bgMaterial;
      for (let i = compiled.length - 1; i >= 0; i--) {
        if (compiled[i].set.has(key)) {
          geom = compiled[i].geom;
          mat = compiled[i].material;
          break;
        }
      }
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      this.add(mesh);
    }

    const p = plane.field.p;
    const half = (p - 1) / 2;

    // Detect if the embedding is periodic (torus-like)
    const testA = plane.embed(p, [-half, 0, 1]);
    const testB = plane.embed(p, [half + 1, 0, 1]);
    const wrapDist = Math.hypot(
      testA[0] - testB[0], testA[1] - testB[1], testA[2] - testB[2],
    );
    const closed = wrapDist < 0.01;

    const lo = closed ? 0 : -half - 0.5;
    const hi = closed ? p : half + 0.5;

    // Grid lines
    if (showGridLines) {
      const lineMat = gridLineMaterial ?? bgMaterial;
      const els = plane.field.elements();
      const N = 64;

      for (const i of els) {
        this.add(makeEmbeddedCurve(
          (t) => plane.embed(p, [lerp(lo, hi, t), i, 1]),
          N, gridLineRadius, lineMat, closed,
        ));
        this.add(makeEmbeddedCurve(
          (t) => plane.embed(p, [i, lerp(lo, hi, t), 1]),
          N, gridLineRadius, lineMat, closed,
        ));
      }
    }

    // Projective lines
    for (const line of lines) {
      const eq = plane.field.lineEquation(line.from, line.to);
      const N = Math.max(128, p * 8);
      const jumpThreshold = p * 0.4;

      // Sample the line parametrization densely
      const samples: THREE.Vector3[] = [];
      for (let i = 0; i <= N; i++) {
        const t = lerp(lo, hi, i / N);
        let x: number, y: number;
        if (eq.vertical) {
          x = eq.x0;
          y = t;
        } else {
          x = t;
          // Use real arithmetic for m*t + c, then centered mod for grid;
          // torus embedding handles periodicity via sin/cos.
          y = centeredMod(eq.m * t + eq.c, p);
        }
        const pos = plane.embed(p, [x, y, 1]);
        samples.push(new THREE.Vector3(pos[0], pos[1], pos[2]));
      }

      // Split at jumps (large R³ distance between consecutive samples)
      const segments: THREE.Vector3[][] = [[]];
      segments[0].push(samples[0]);
      for (let i = 1; i < samples.length; i++) {
        const dist = samples[i].distanceTo(samples[i - 1]);
        if (dist > jumpThreshold) {
          segments.push([]);
        }
        segments[segments.length - 1].push(samples[i]);
      }

      // If no jumps occurred and embedding is periodic, it's one closed curve
      const isClosed = closed && segments.length === 1;

      for (const seg of segments) {
        if (seg.length < 2) continue;
        const curve = new THREE.CatmullRomCurve3(seg, isClosed);
        const tubeSegs = Math.max(seg.length, 32);
        const geom = new THREE.TubeGeometry(curve, tubeSegs, line.radius, 8, isClosed);
        this.add(new THREE.Mesh(geom, line.material));
      }

    }
  }
}

/** Centered mod: reduce x to [-(p-1)/2, (p-1)/2]. Works for non-integer x. */
function centeredMod(x: number, p: number): number {
  const half = (p - 1) / 2;
  let r = ((x % p) + p) % p;
  if (r > half) r -= p;
  return r;
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
