/**
 * Translation surface, the relaxation way — the L-surface (H(2)) as a smooth
 * embedded genus-2 surface found by energy minimization.
 *
 * Pipeline:
 *   1. Weld the three squares (N×N each) into one closed genus-2 mesh (χ = −2),
 *      all corners collapsing to a single cone vertex.        [buildLSurface]
 *   2. Seed an embedding spectrally — the 3 lowest non-trivial eigenvectors of
 *      the graph Laplacian give a smooth, symmetric initial layout.
 *   3. Relax with stretch + bend springs and a vertex-repulsion energy
 *      (self-avoidance) via the Physics evolver.
 *
 * The geometry is just a smooth genus-2 surface; the flat translation structure
 * (3 squares, saddle connections, cone point) is shown by the shader using each
 * render vertex's flat (u,v). The cone point needs no special handling — it is
 * an ordinary high-valence vertex the relaxation turns into a smooth saddle.
 */

import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { App } from '@/app/App';
import { HalfEdgeMesh } from '@/math/mesh/HalfEdgeMesh';
import { Embedding } from '@/math/mesh/Embedding';
import { Energy } from '@/math/mesh/energy/Energy';
import { SpringEnergy } from '@/math/mesh/energy/SpringEnergy';
import type { Spring } from '@/math/mesh/energy/types';
import { stretchSprings } from '@/math/mesh/energy/builders/stretchSprings';
import { bendSprings } from '@/math/mesh/energy/builders/bendSprings';
import { Physics } from '@/math/mesh/evolvers/Physics';
import { Matrix } from '@/math/linear-algebra';
import { eigensym } from '@/math/linear-algebra';
import { createSurfaceShader } from '@/shaders/SurfaceShader';
import { SURFACES, currentSurface, configPath, surfaceDropdown } from './surfaces';

const SURF = currentSurface();
const N = SURFACES[SURF].coarseN;
const L = SURFACES[SURF].build(N);
// eslint-disable-next-line no-console
console.log(`surface "${SURF}": N=${N}, ${L.weldedCount} welded verts, ${L.faces.length} faces, cone vertex ${L.coneVertex}`);

const mesh = HalfEdgeMesh.fromSoup(L.weldedCount, L.faces);
// eslint-disable-next-line no-console
console.log(`χ = ${mesh.eulerCharacteristic()}  (expect −2 ⇒ genus 2)`);

// ── Spectral seed ────────────────────────────────────────────────────────
// Graph Laplacian Λ = D − A; eigenvectors of its small *nonzero* eigenvalues
// embed the mesh smoothly. (eigensym returns values descending, so the small
// ones sit at the tail; index n−1 is the ≈0 constant mode.) For genus 2 the
// 3-eigenvector image is generally an immersion, not an embedding, so we let
// the triple be swept ([ and ]) to hunt for a clean (or relaxable) seed.
const eigN = L.weldedCount;
const eigVecs = (() => {
  const Lap = new Matrix(eigN, eigN);
  const seen = new Set<number>();
  for (const f of L.faces) for (let k = 0; k < 4; k++) {
    const a = f[k], b = f[(k + 1) % 4];
    const key = a < b ? a * 1e6 + b : b * 1e6 + a;
    if (seen.has(key)) continue;
    seen.add(key);
    Lap.set(a, b, Lap.get(a, b) - 1);
    Lap.set(b, a, Lap.get(b, a) - 1);
    Lap.set(a, a, Lap.get(a, a) + 1);
    Lap.set(b, b, Lap.get(b, b) + 1);
  }
  return eigensym(Lap).vectors;
})();

let seedOffset = 0;   // shift the 3-eigenvector window among the low modes
function spectralSeed(): Float32Array {
  const n = eigN;
  const cols = [n - 2 - seedOffset, n - 3 - seedOffset, n - 4 - seedOffset];
  const pos = new Float32Array(3 * n);
  for (let v = 0; v < n; v++) for (let d = 0; d < 3; d++) pos[3 * v + d] = eigVecs.get(v, cols[d]);

  // Center and scale to a comfortable size.
  const c = [0, 0, 0];
  for (let v = 0; v < n; v++) for (let d = 0; d < 3; d++) c[d] += pos[3 * v + d];
  for (let d = 0; d < 3; d++) c[d] /= n;
  let maxr = 0;
  for (let v = 0; v < n; v++) {
    let r2 = 0;
    for (let d = 0; d < 3; d++) { const e = pos[3 * v + d] - c[d]; r2 += e * e; }
    maxr = Math.max(maxr, Math.sqrt(r2));
  }
  const scale = 2.5 / (maxr || 1);
  for (let v = 0; v < n; v++) for (let d = 0; d < 3; d++) pos[3 * v + d] = (pos[3 * v + d] - c[d]) * scale;
  // eslint-disable-next-line no-console
  console.log(`seed eigenvectors: cols [${cols.join(', ')}] of ${n}`);
  return pos;
}

// Planar seed: lay the surface as its flat domain (each welded vertex at a
// representative (u,v)) with a little z-noise. A deliberately terrible, self-
// overlapping embedding — the glued edges collapse to one side — fun to relax.
function planarSeed(): Float32Array {
  const n = L.weldedCount;
  const pos = new Float32Array(3 * n);
  const filled = new Uint8Array(n);
  for (let r = 0; r < L.render.count; r++) {
    const w = L.render.weldOf[r];
    if (filled[w]) continue;
    filled[w] = 1;
    pos[3 * w] = L.render.uv[2 * r];
    pos[3 * w + 1] = L.render.uv[2 * r + 1];
    pos[3 * w + 2] = 0;
  }
  // center + scale like the spectral seed, then add z-noise.
  const c = [0, 0, 0];
  for (let v = 0; v < n; v++) for (let d = 0; d < 3; d++) c[d] += pos[3 * v + d];
  for (let d = 0; d < 3; d++) c[d] /= n;
  let maxr = 0;
  for (let v = 0; v < n; v++) { const ex = pos[3 * v] - c[0], ey = pos[3 * v + 1] - c[1]; maxr = Math.max(maxr, Math.hypot(ex, ey)); }
  const scale = 2.5 / (maxr || 1);
  for (let v = 0; v < n; v++) {
    pos[3 * v] = (pos[3 * v] - c[0]) * scale;
    pos[3 * v + 1] = (pos[3 * v + 1] - c[1]) * scale;
    pos[3 * v + 2] = (Math.random() - 0.5) * 0.15;
  }
  // Diagnostic: flat in z, but a few edges span the whole domain — those are
  // the collapsed gluings (the "terrible" part). A clean embedding would have
  // all edges ≈ the cell size.
  let zmin = Infinity, zmax = -Infinity, maxEdge = 0, sumEdge = 0, nEdge = 0;
  for (let v = 0; v < n; v++) { zmin = Math.min(zmin, pos[3 * v + 2]); zmax = Math.max(zmax, pos[3 * v + 2]); }
  for (const f of L.faces) for (let k = 0; k < f.length; k++) {
    const a = f[k], b = f[(k + 1) % f.length];
    const e = Math.hypot(pos[3 * a] - pos[3 * b], pos[3 * a + 1] - pos[3 * b + 1], pos[3 * a + 2] - pos[3 * b + 2]);
    maxEdge = Math.max(maxEdge, e); sumEdge += e; nEdge++;
  }
  // eslint-disable-next-line no-console
  console.log(`seed: planar domain + z-noise — z∈[${zmin.toFixed(3)}, ${zmax.toFixed(3)}], ` +
    `longest edge ${maxEdge.toFixed(2)} vs mean ${(sumEdge / nEdge).toFixed(2)} (large ratio ⇒ collapsed gluings)`);
  return pos;
}

// Cross seed: the flat domain warped into a saddle z ∝ (Δv)²−(Δu)², so the
// vertical extent bulges toward the front (+z) and the horizontal toward the
// back (−z). Each glued pair lands on a common side → a recognizable cross
// whose two main wraps are pre-positioned for relaxation to close.
function crossSeed(): Float32Array {
  const n = L.weldedCount;
  const ru = new Float32Array(n), rv = new Float32Array(n);
  const filled = new Uint8Array(n);
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (let r = 0; r < L.render.count; r++) {
    const u = L.render.uv[2 * r], v = L.render.uv[2 * r + 1];
    umin = Math.min(umin, u); umax = Math.max(umax, u);
    vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
    const w = L.render.weldOf[r];
    if (filled[w]) continue;
    filled[w] = 1; ru[w] = u; rv[w] = v;
  }
  const cu = (umin + umax) / 2, cv = (vmin + vmax) / 2;
  const half = Math.max(umax - cu, vmax - cv) || 1;
  const pos = new Float32Array(3 * n);
  for (let w = 0; w < n; w++) {
    const du = ru[w] - cu, dv = rv[w] - cv;
    pos[3 * w] = du; pos[3 * w + 1] = dv; pos[3 * w + 2] = (dv * dv - du * du) / half;
  }
  let maxr = 0;
  for (let w = 0; w < n; w++) maxr = Math.max(maxr, Math.hypot(pos[3 * w], pos[3 * w + 1], pos[3 * w + 2]));
  const s = 2.5 / (maxr || 1);
  for (let k = 0; k < 3 * n; k++) pos[k] *= s;
  // eslint-disable-next-line no-console
  console.log('seed: cross saddle (vertical → front, horizontal → back)');
  return pos;
}

// Handle seed: a figure-eight of two ribbons. The central bar (v in the middle
// band) loops in u toward the BACK (−z); the arms (the rest) loop in v toward
// the FRONT (+z). The two loops meet only at the centre, so they stay separated
// in z and don't pass through each other — and the wrap gluings A (bar u) and
// E (arms v) are realized cleanly. (The smaller side/flap gluings collapse only
// locally, which relaxation can close.)
function handleSeed(): Float32Array {
  const n = L.weldedCount;
  const ru = new Float32Array(n), rv = new Float32Array(n);
  const filled = new Uint8Array(n);
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (let r = 0; r < L.render.count; r++) {
    const u = L.render.uv[2 * r], v = L.render.uv[2 * r + 1];
    umin = Math.min(umin, u); umax = Math.max(umax, u);
    vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
    const w = L.render.weldOf[r];
    if (filled[w]) continue;
    filled[w] = 1; ru[w] = u; rv[w] = v;
  }
  const cu = (umin + umax) / 2, cv = (vmin + vmax) / 2;
  const hu = (umax - umin) / 2 || 1, hv = (vmax - vmin) / 2 || 1;
  const Rb = 1.3, Ra = 1.3, wb = 0.45, wa = 0.45;   // loop radii, ribbon half-widths
  const pos = new Float32Array(3 * n);
  for (let w = 0; w < n; w++) {
    const du = ru[w] - cu, dv = rv[w] - cv;
    if (Math.abs(dv) <= hv / 2) {                   // central bar → loop behind
      const b = du * Math.PI / hu;                  // u over [cu±hu] → β∈[−π,π]
      pos[3 * w] = Rb * Math.sin(b);
      pos[3 * w + 1] = (dv / (hv / 2)) * wb;
      pos[3 * w + 2] = -Rb + Rb * Math.cos(b);
    } else {                                        // arms → loop in front
      const g = dv * Math.PI / hv;
      pos[3 * w] = (du / (hu / 2)) * wa;
      pos[3 * w + 1] = Ra * Math.sin(g);
      pos[3 * w + 2] = Ra - Ra * Math.cos(g);
    }
  }
  let maxr = 0;
  for (let w = 0; w < n; w++) maxr = Math.max(maxr, Math.hypot(pos[3 * w], pos[3 * w + 1], pos[3 * w + 2]));
  const s = 2.5 / (maxr || 1);
  for (let k = 0; k < 3 * n; k++) pos[k] *= s;
  // eslint-disable-next-line no-console
  console.log('seed: figure-eight (bar loops back, arms loop front)');
  return pos;
}

type SeedMode = 'spectral' | 'planar' | 'cross' | 'handle';
let seedMode: SeedMode = 'spectral';
const makeSeed = (): Float32Array =>
  seedMode === 'planar' ? planarSeed()
    : seedMode === 'cross' ? crossSeed()
      : seedMode === 'handle' ? handleSeed()
        : spectralSeed();

const emb = new Embedding(mesh, { positions: makeSeed() });

// ── Energies ─────────────────────────────────────────────────────────────

// Mean seed edge length — the spacing the stretch springs pull toward.
function meanEdge(): number {
  let s = 0;
  const sp = stretchSprings(emb, 1);
  for (const e of sp) s += e.rest;
  return s / sp.length;
}
const target = meanEdge();

// Stretch springs pull every edge toward a UNIFORM length (even spacing, not
// the seed's uneven lengths). Bend springs (rest from seed) keep it smooth.
const stretch: Spring[] = stretchSprings(emb, 1).map((s) => ({ i: s.i, j: s.j, k: 1, rest: target }));
const bend: Spring[] = bendSprings(emb, 1);
const springEnergy = new SpringEnergy([...stretch, ...bend]);

// Repulsion over all non-edge vertex pairs → self-avoidance + inflation.
const edgeKeys = new Set<number>();
for (const e of stretch) edgeKeys.add(e.i < e.j ? e.i * 1e6 + e.j : e.j * 1e6 + e.i);
const repulPairs: number[] = [];
for (let i = 0; i < L.weldedCount; i++)
  for (let j = i + 1; j < L.weldedCount; j++)
    if (!edgeKeys.has(i * 1e6 + j)) repulPairs.push(i, j);

class RepulsionEnergy extends Energy {
  k = 4;
  cutoff = 1.5 * target;
  private scratch = new Float32Array(3);
  private pairs: number[];
  constructor(pairs: number[]) { super(); this.pairs = pairs; }
  termCount(): number { return this.pairs.length / 2; }
  termValue(idx: number, e: Embedding): number {
    const d = e.distance(this.pairs[2 * idx], this.pairs[2 * idx + 1]);
    if (d >= this.cutoff) return 0;
    const g = this.cutoff - d;
    return 0.5 * this.k * g * g;
  }
  termGradAccumulate(idx: number, e: Embedding, grad: Float32Array): void {
    const i = this.pairs[2 * idx], j = this.pairs[2 * idx + 1];
    const diff = e.difference(j, i, this.scratch);   // x_i − x_j
    const d = Math.hypot(diff[0], diff[1], diff[2]);
    if (d >= this.cutoff || d === 0) return;
    const coef = -this.k * (this.cutoff - d) / d;     // grad_i = coef · diff
    const a = 3 * i, b = 3 * j;
    grad[a] += coef * diff[0]; grad[a + 1] += coef * diff[1]; grad[a + 2] += coef * diff[2];
    grad[b] -= coef * diff[0]; grad[b + 1] -= coef * diff[1]; grad[b + 2] -= coef * diff[2];
  }
}
const repulsion = new RepulsionEnergy(repulPairs);

// Point–triangle collision: push each vertex away from any nearby face it is
// NOT part of, so faces don't pass through one another (vertex repulsion alone
// misses face-through-face away from the vertices). O(V·#tris) — fine at coarse
// resolution. Off by default (set the Collision slider).
const TRIS: number[] = [];
for (const f of L.faces) TRIS.push(f[0], f[1], f[2], f[0], f[2], f[3]);   // quads → 2 triangles
const NT = TRIS.length / 3;

class CollisionEnergy extends Energy {
  k = 0;
  cutoff = 0.6 * target;
  private cp = new Float32Array(3);     // closest point on the triangle
  private bary = new Float32Array(3);   // its barycentric weights

  termCount(): number { return L.weldedCount * NT; }

  // Closest point on triangle t to vertex vi (Ericson). Returns the distance;
  // writes cp + bary. Returns Infinity if vi is a corner of t (skip self).
  private dist(e: Embedding, vi: number, t: number): number {
    const a = TRIS[3 * t], b = TRIS[3 * t + 1], c = TRIS[3 * t + 2];
    if (vi === a || vi === b || vi === c) return Infinity;
    const P = e.positions;
    const px = P[3 * vi], py = P[3 * vi + 1], pz = P[3 * vi + 2];
    const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
    const bx = P[3 * b], by = P[3 * b + 1], bz = P[3 * b + 2];
    const cx = P[3 * c], cy = P[3 * c + 1], cz = P[3 * c + 2];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let u = 0, v = 0, w = 0;
    if (d1 <= 0 && d2 <= 0) { u = 1; this.cp.set([ax, ay, az]); }
    else {
      const d3 = abx * (px - bx) + aby * (py - by) + abz * (pz - bz);
      const d4 = acx * (px - bx) + acy * (py - by) + acz * (pz - bz);
      if (d3 >= 0 && d4 <= d3) { v = 1; this.cp.set([bx, by, bz]); }
      else {
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { const s = d1 / (d1 - d3); u = 1 - s; v = s; this.cp.set([ax + abx * s, ay + aby * s, az + abz * s]); }
        else {
          const d5 = abx * (px - cx) + aby * (py - cy) + abz * (pz - cz);
          const d6 = acx * (px - cx) + acy * (py - cy) + acz * (pz - cz);
          if (d6 >= 0 && d5 <= d6) { w = 1; this.cp.set([cx, cy, cz]); }
          else {
            const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) { const s = d2 / (d2 - d6); u = 1 - s; w = s; this.cp.set([ax + acx * s, ay + acy * s, az + acz * s]); }
            else {
              const va = d3 * d6 - d5 * d4;
              if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const s = (d4 - d3) / ((d4 - d3) + (d5 - d6)); v = 1 - s; w = s; this.cp.set([bx + (cx - bx) * s, by + (cy - by) * s, bz + (cz - bz) * s]); }
              else { const den = 1 / (va + vb + vc); v = vb * den; w = vc * den; u = 1 - v - w; this.cp.set([ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w]); }
            }
          }
        }
      }
    }
    this.bary[0] = u; this.bary[1] = v; this.bary[2] = w;
    return Math.hypot(px - this.cp[0], py - this.cp[1], pz - this.cp[2]);
  }

  termValue(idx: number, e: Embedding): number {
    if (this.k === 0) return 0;
    const d = this.dist(e, (idx / NT) | 0, idx % NT);
    if (d >= this.cutoff) return 0;
    const g = this.cutoff - d;
    return 0.5 * this.k * g * g;
  }
  termGradAccumulate(idx: number, e: Embedding, grad: Float32Array): void {
    if (this.k === 0) return;
    const vi = (idx / NT) | 0, t = idx % NT;
    const d = this.dist(e, vi, t);
    if (d >= this.cutoff || d === 0) return;
    const P = e.positions;
    const dx = P[3 * vi] - this.cp[0], dy = P[3 * vi + 1] - this.cp[1], dz = P[3 * vi + 2] - this.cp[2];
    const coef = this.k * (this.cutoff - d) / d;   // push vertex out, react on the tri
    grad[3 * vi] -= coef * dx; grad[3 * vi + 1] -= coef * dy; grad[3 * vi + 2] -= coef * dz;
    const a = TRIS[3 * t], b = TRIS[3 * t + 1], c = TRIS[3 * t + 2];
    const wa = this.bary[0], wb = this.bary[1], wc = this.bary[2];
    grad[3 * a] += coef * wa * dx; grad[3 * a + 1] += coef * wa * dy; grad[3 * a + 2] += coef * wa * dz;
    grad[3 * b] += coef * wb * dx; grad[3 * b + 1] += coef * wb * dy; grad[3 * b + 2] += coef * wb * dz;
    grad[3 * c] += coef * wc * dx; grad[3 * c + 1] += coef * wc * dy; grad[3 * c + 2] += coef * wc * dz;
  }
}
const collision = new CollisionEnergy();

// Composite: spring energy + repulsion, summed.
class CompositeEnergy extends Energy {
  private tmp: Float32Array;
  private parts: Energy[];
  constructor(parts: Energy[], len: number) { super(); this.parts = parts; this.tmp = new Float32Array(len); }
  termCount(): number { return 0; }
  termValue(): number { return 0; }
  termGradAccumulate(): void { /* unused */ }
  value(e: Embedding): number { return this.parts.reduce((s, p) => s + p.value(e), 0); }
  gradient(e: Embedding, grad: Float32Array): void {
    grad.fill(0);
    for (const p of this.parts) { p.gradient(e, this.tmp); for (let k = 0; k < grad.length; k++) grad[k] += this.tmp[k]; }
  }
}
const energy = new CompositeEnergy([springEnergy, repulsion, collision], emb.positions.length);
let evolver = new Physics(emb, energy, { mass: 1, drag: 0.5 });
// Drag is set at construction, so rebuild the evolver to change it. Low drag →
// the mesh oscillates and overshoots more (shakes loose from tangled minima);
// high drag → it settles fast.
function setDrag(d: number): void {
  const vel = evolver.velocity.slice();          // keep momentum across the rebuild
  evolver = new Physics(emb, energy, { mass: 1, drag: d });
  evolver.velocity.set(vel);
}

const P = { stretchK: 1, bendK: 0.4, repulK: 4, collK: 0, drag: 0.5, dt: 0.02, substeps: 12 };
function applyStiffness(): void {
  for (const s of stretch) s.k = P.stretchK;
  for (const s of bend) s.k = P.bendK * s.rest;
  repulsion.k = P.repulK;
  collision.k = P.collK;
}
applyStiffness();

// ── Render mesh: unwelded grids, positions tracked from the embedding ─────

const geo = new THREE.BufferGeometry();
geo.setIndex(L.render.indices);
geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(L.render.count * 3), 3));
geo.setAttribute('uv', new THREE.Float32BufferAttribute(L.render.uv, 2));
geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(L.render.count * 3), 3));

function syncRender(): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let r = 0; r < L.render.count; r++) {
    const w = L.render.weldOf[r];
    arr[3 * r] = emb.positions[3 * w];
    arr[3 * r + 1] = emb.positions[3 * w + 1];
    arr[3 * r + 2] = emb.positions[3 * w + 2];
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

// Generic per-unit-cell checkerboard + grid — works for any polyomino surface.
const colorGLSL = `
  vec2 cell = floor(uv);
  float chk = mod(cell.x + cell.y, 2.0);
  vec3 base = mix(vec3(0.42, 0.62, 0.72), vec3(0.78, 0.62, 0.40), chk);
  vec2 f = abs(fract(uv) - 0.5);
  float edge = smoothstep(0.42, 0.5, max(f.x, f.y));
  vec3 col = base * (1.0 - 0.55 * edge);
  col += 0.18 * vec3(coordGrid(uv, 1.0));
  return col;
`;
const shader = createSurfaceShader({ color: colorGLSL });
const uvTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
uvTex.needsUpdate = true;
const material = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  vertexShader: shader.vertexShader,
  fragmentShader: shader.fragmentShader,
  uniforms: shader.uniforms,
  side: THREE.DoubleSide,
  map: uvTex,
  roughness: 0.4,
  metalness: 0.0,
  clearcoat: 0.3,
});
const surfaceMesh = new THREE.Mesh(geo, material);

// ── Scene ──────────────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: true });
app.camera.fov = 30;
app.camera.updateProjectionMatrix();
app.camera.position.set(5, 4, 6);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.backgrounds.loadHDR('/assets/hdri/studio.hdr', { asEnvironment: true, asBackground: false, intensity: 1.4 });
app.backgrounds.setColor(0xf0efe9);
app.scene.add(new THREE.DirectionalLight(0xffffff, 2.2).translateX(4).translateY(5).translateZ(3));
app.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
app.scene.add(surfaceMesh);
syncRender();

// ── Controls ──────────────────────────────────────────────────────────────

let running = false;
app.overlay.addSlider({
  label: 'Stretch', min: 0, max: 5, step: 0.01, value: P.stretchK,
  format: (v: number) => `stretch = ${v.toFixed(2)}`, onChange: (v: number) => { P.stretchK = v; applyStiffness(); },
});
app.overlay.addSlider({
  label: 'Bend', min: 0, max: 3, step: 0.01, value: P.bendK,
  format: (v: number) => `bend = ${v.toFixed(2)}`, onChange: (v: number) => { P.bendK = v; applyStiffness(); },
});
app.overlay.addSlider({
  label: 'Repulsion', min: 0, max: 20, step: 0.1, value: P.repulK,
  format: (v: number) => `repulsion = ${v.toFixed(1)}`, onChange: (v: number) => { P.repulK = v; applyStiffness(); },
});
app.overlay.addSlider({
  label: 'Collision', min: 0, max: 20, step: 0.1, value: P.collK,
  format: (v: number) => `collision = ${v.toFixed(1)}`, onChange: (v: number) => { P.collK = v; applyStiffness(); },
});
app.overlay.addSlider({
  label: 'Drag', min: 0, max: 8, step: 0.01, value: P.drag,
  format: (v: number) => `drag = ${v.toFixed(2)}`, onChange: (v: number) => { P.drag = v; setDrag(v); },
});
app.overlay.addSlider({
  label: 'dt', min: 0.001, max: 0.05, step: 0.001, value: P.dt,
  format: (v: number) => `dt = ${v.toFixed(3)}`, onChange: (v: number) => { P.dt = v; },
});
app.overlay.addSlider({
  label: 'Speed', min: 1, max: 40, step: 1, value: P.substeps,
  format: (v: number) => `${v} steps/frame`, onChange: (v: number) => { P.substeps = v; },
});

// ── Save config ─────────────────────────────────────────────────────────
// Serialize the welded topology + current relaxed positions so a future
// program can rebuild the surface (buildLSurface(N) gives faces/render; the
// positions index welded vertices). POSTs to the dev writer, falls back to a
// browser download.
function currentConfig(): string {
  return JSON.stringify({
    N,
    weldedCount: L.weldedCount,
    coneVertex: L.coneVertex,
    savePath: configPath('relaxed', SURF),
    positions: Array.from(emb.positions),
  });
}
async function saveConfig(): Promise<void> {
  const body = currentConfig();
  try {
    const res = await fetch('/__save-lsurface', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    const j = await res.json();
    if (j.ok) { saveBtn.textContent = `saved → ${j.path}`; setTimeout(() => (saveBtn.textContent = 'save config'), 2500); return; }
    throw new Error(j.error || 'write failed');
  } catch {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    a.download = `relaxed-config-${SURF}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    saveBtn.textContent = 'downloaded';
    setTimeout(() => (saveBtn.textContent = 'save config'), 2500);
  }
}

// Surface dropdown (top-left) + save button (top-right).
const dropdown = surfaceDropdown();
dropdown.style.cssText += 'position:fixed; top:12px; left:12px; z-index:10;';
document.body.appendChild(dropdown);

const saveBtn = document.createElement('button');
saveBtn.textContent = 'save config';
saveBtn.style.cssText =
  'position:fixed; top:12px; right:12px; z-index:10; padding:8px 14px;' +
  'font:13px/1 ui-monospace,monospace; color:#2c2c2c; background:#f7f5f0;' +
  'border:1px solid rgba(0,0,0,0.2); border-radius:6px; cursor:pointer;';
saveBtn.addEventListener('click', saveConfig);
document.body.appendChild(saveBtn);

function reseed(): void { emb.positions.set(makeSeed()); evolver.velocity.fill(0); syncRender(); }
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') running = !running;
  if (e.key === 'r') reseed();
  if (e.key === 's') { seedMode = 'spectral'; running = false; reseed(); }   // spectral seed
  if (e.key === 'p') { seedMode = 'planar'; running = false; reseed(); }      // planar-domain seed
  if (e.key === 'c') { seedMode = 'cross'; running = false; reseed(); }       // cross saddle seed
  if (e.key === 'h') { seedMode = 'handle'; running = false; reseed(); }      // handle/torus roll seed
  if (e.key === ']') { seedOffset = Math.min(seedOffset + 1, eigN - 5); running = false; reseed(); }
  if (e.key === '[') { seedOffset = Math.max(seedOffset - 1, 0); running = false; reseed(); }
});

app.addAnimateCallback(() => {
  if (running) { for (let s = 0; s < P.substeps; s++) evolver.step(P.dt); }
  syncRender();
});

app.start();
