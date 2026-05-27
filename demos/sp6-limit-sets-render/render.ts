/**
 * Shaders, material, instanced mesh, percentile-bbox camera autofit.
 *
 * The vertex shader does the actual projection:
 *   numer = uProjA · v[0..2] + uProjB · v[3..5]    (THREE.Matrix3 = row-major .set())
 *   denom = dot(uDenomA, v[0..2]) + dot(uDenomB, v[3..5])
 *   center = numer / denom
 */

import * as THREE from 'three';
import type { App } from '@/app/App';
import type { Projection } from './projection';

const VERT = /* glsl */`
  uniform float uRadius;
  uniform mat3  uProjA;
  uniform mat3  uProjB;
  uniform vec3  uDenomA;
  uniform vec3  uDenomB;

  attribute vec3 aV0;
  attribute vec3 aV1;
  attribute vec3 aColor;

  varying vec3 vNormal;
  varying vec3 vColor;

  void main() {
    vec3 numer = uProjA * aV0 + uProjB * aV1;
    float denom = dot(uDenomA, aV0) + dot(uDenomB, aV1);
    vec3 center = numer / denom;

    vec3 worldPos = center + position * uRadius;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);

    vNormal = normalize(normalMatrix * normal);
    vColor  = aColor;
  }
`;

const FRAG = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vColor;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(vec3(0.4, 0.8, 0.6));
    float diff = max(dot(N, L), 0.0);
    float amb = 0.35;
    vec3 col = vColor * (amb + diff * 0.85);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface ProjectionUniforms {
  uRadius:    { value: number };
  uProjA:     { value: THREE.Matrix3 };
  uProjB:     { value: THREE.Matrix3 };
  uDenomA:    { value: THREE.Vector3 };
  uDenomB:    { value: THREE.Vector3 };
  [uniform: string]: THREE.IUniform;
}

export function createMaterial(): {
  material: THREE.ShaderMaterial;
  uniforms: ProjectionUniforms;
} {
  const uniforms: ProjectionUniforms = {
    uRadius:    { value: 0.025 },
    uProjA:     { value: new THREE.Matrix3() },
    uProjB:     { value: new THREE.Matrix3() },
    uDenomA:    { value: new THREE.Vector3() },
    uDenomB:    { value: new THREE.Vector3() },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
  });
  return { material, uniforms };
}

export function setProjectionUniforms(
  uniforms: ProjectionUniforms,
  proj: Projection,
): void {
  const r0 = proj.rows[0];
  const r1 = proj.rows[1];
  const r2 = proj.rows[2];
  uniforms.uProjA.value.set(
    r0[0], r0[1], r0[2],
    r1[0], r1[1], r1[2],
    r2[0], r2[1], r2[2],
  );
  uniforms.uProjB.value.set(
    r0[3], r0[4], r0[5],
    r1[3], r1[4], r1[5],
    r2[3], r2[4], r2[5],
  );
  uniforms.uDenomA.value.set(proj.denom[0], proj.denom[1], proj.denom[2]);
  uniforms.uDenomB.value.set(proj.denom[3], proj.denom[4], proj.denom[5]);
}

const sphereGeo = new THREE.SphereGeometry(1, 8, 6);

export function makeInstancedMesh(
  material: THREE.ShaderMaterial,
  aV0: Float32Array,
  aV1: Float32Array,
  aColor: Float32Array,
): THREE.Mesh {
  const kept = aV0.length / 3;
  const instGeo = new THREE.InstancedBufferGeometry();
  instGeo.index = sphereGeo.index;
  for (const name of Object.keys(sphereGeo.attributes)) {
    instGeo.setAttribute(name, sphereGeo.attributes[name]);
  }
  instGeo.boundingSphere = null;
  instGeo.boundingBox = null;
  instGeo.instanceCount = kept;
  instGeo.setAttribute('aV0', new THREE.InstancedBufferAttribute(aV0, 3));
  instGeo.setAttribute('aV1', new THREE.InstancedBufferAttribute(aV1, 3));
  instGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));

  // Frustum culling is unreliable: per-instance offset is computed in the
  // shader from aV0/aV1, so Three.js can't see it.
  const mesh = new THREE.Mesh(instGeo, material);
  mesh.frustumCulled = false;
  return mesh;
}

// ─── CPU projection (for camera autofit only) ───────────────────────────────

function projectVecCPU(
  aV0: Float32Array, aV1: Float32Array, i: number,
  proj: Projection, out: THREE.Vector3,
): void {
  const a0 = aV0[i * 3], a1 = aV0[i * 3 + 1], a2 = aV0[i * 3 + 2];
  const b0 = aV1[i * 3], b1 = aV1[i * 3 + 1], b2 = aV1[i * 3 + 2];
  const d = proj.denom;
  const denom = d[0] * a0 + d[1] * a1 + d[2] * a2 + d[3] * b0 + d[4] * b1 + d[5] * b2;
  const r0 = proj.rows[0];
  const r1 = proj.rows[1];
  const r2 = proj.rows[2];
  out.set(
    (r0[0] * a0 + r0[1] * a1 + r0[2] * a2 + r0[3] * b0 + r0[4] * b1 + r0[5] * b2) / denom,
    (r1[0] * a0 + r1[1] * a1 + r1[2] * a2 + r1[3] * b0 + r1[4] * b1 + r1[5] * b2) / denom,
    (r2[0] * a0 + r2[1] * a1 + r2[2] * a2 + r2[3] * b0 + r2[4] * b1 + r2[5] * b2) / denom,
  );
}

function percentile(arr: Float32Array, p: number): number {
  const sorted = arr.slice();
  sorted.sort();
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p)));
  return sorted[idx];
}

/**
 * Percentile-bbox (15th-85th) frames the dense core; long fuzzy tails of
 * near-chart-singular points fall off the edges.
 */
export function autofitCamera(
  app: App,
  aV0: Float32Array, aV1: Float32Array,
  proj: Projection,
): void {
  const n = aV0.length / 3;
  if (n === 0) return;

  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const zs = new Float32Array(n);
  const p = new THREE.Vector3();
  let m = 0;
  for (let i = 0; i < n; i++) {
    projectVecCPU(aV0, aV1, i, proj, p);
    if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
      xs[m] = p.x; ys[m] = p.y; zs[m] = p.z;
      m++;
    }
  }
  if (m === 0) return;
  const xt = xs.slice(0, m), yt = ys.slice(0, m), zt = zs.slice(0, m);

  const xLo = percentile(xt, 0.15), xHi = percentile(xt, 0.85);
  const yLo = percentile(yt, 0.15), yHi = percentile(yt, 0.85);
  const zLo = percentile(zt, 0.15), zHi = percentile(zt, 0.85);

  const center = new THREE.Vector3(
    (xLo + xHi) * 0.5,
    (yLo + yHi) * 0.5,
    (zLo + zHi) * 0.5,
  );
  const hx = (xHi - xLo) * 0.5;
  const hy = (yHi - yLo) * 0.5;
  const hz = (zHi - zLo) * 0.5;
  const r = Math.max(0.5, Math.sqrt(hx * hx + hy * hy + hz * hz));

  const cam = app.camera as THREE.PerspectiveCamera;
  const halfFov = (cam.fov * Math.PI / 180) * 0.5;
  const dist = 2 * r / Math.tan(halfFov);

  const dir = new THREE.Vector3(0.4, 0.4, 1).normalize();
  app.controls.target.copy(center);
  app.camera.position.copy(center).addScaledVector(dir, dist);
  app.controls.update();
}
