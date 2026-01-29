import * as THREE from 'three';
import { Matrix, nullspace, SurfaceMesh } from '@/math';
import type { Surface, SurfaceDomain } from '@/math';
import { App } from '@/app/App';
import { Lights } from '@/scene/Lights';

// The 10 degree-3 monomials in [x, y, z], ordered:
// x³, x²y, x²z, xy², xyz, xz², y³, y²z, yz², z³
function evalMonomials(x: number, y: number, z: number): number[] {
    return [
        x*x*x, x*x*y, x*x*z,
        x*y*y, x*y*z, x*z*z,
        y*y*y, y*y*z, y*z*z,
        z*z*z,
    ];
}

// Takes 6 points in P2 (each [x,y,z]) and returns a basis for the
// 4-dimensional space of cubic forms vanishing on all six points.
// Each basis vector has 10 entries (coefficients in the monomial basis above).
export function cubicNullspace(points: [number, number, number][]): number[][] {
    const M = Matrix.zeros(6, 10);
    for (let i = 0; i < 6; i++) {
        const row = evalMonomials(...points[i]);
        for (let j = 0; j < 10; j++) {
            M.set(i, j, row[j]);
        }
    }
    return nullspace(M);
}

// Given 6 points in P2, build the map R³ → R⁴ that evaluates the
// four basis cubics at a point. The image lands in P3, giving the
// rational map P2 → P3 defined by the linear system.
export function cubicMap(points: [number, number, number][]) {
    const basis = cubicNullspace(points);

    // dot product of a coefficient vector with the monomial values
    function evalPoly(coeffs: number[], monomials: number[]): number {
        let sum = 0;
        for (let i = 0; i < coeffs.length; i++) {
            sum += coeffs[i] * monomials[i];
        }
        return sum;
    }

    return (x: number, y: number, z: number): [number, number, number, number] => {
        const monomials = evalMonomials(x, y, z);
        return [
            evalPoly(basis[0], monomials),
            evalPoly(basis[1], monomials),
            evalPoly(basis[2], monomials),
            evalPoly(basis[3], monomials),
        ];
    };
}

// Spherical coordinates (theta, phi) -> point on S2 ⊂ R3
function spherePoint(theta: number, phi: number): [number, number, number] {
    const sinTheta = Math.sin(theta);
    return [
        sinTheta * Math.cos(phi),
        sinTheta * Math.sin(phi),
        Math.cos(theta),
    ];
}

// Normalize a 4-vector to unit length (project R4 \ {0} -> S3)
function normalize4(v: [number, number, number, number]): [number, number, number, number] {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2] + v[3]*v[3]);
    return [v[0]/len, v[1]/len, v[2]/len, v[3]/len];
}

// Rotation in the (i,j) plane of R4 by angle t
function rotate4(v: [number, number, number, number], i: number, j: number, t: number): [number, number, number, number] {
    const out: [number, number, number, number] = [v[0], v[1], v[2], v[3]];
    const c = Math.cos(t);
    const s = Math.sin(t);
    out[i] = c * v[i] - s * v[j];
    out[j] = s * v[i] + c * v[j];
    return out;
}

// Stereographic projection S3 -> R3 from the north pole (0,0,0,1)
function stereoProject(p: [number, number, number, number]): THREE.Vector3 {
    const denom = 1 - p[3];
    return new THREE.Vector3(p[0] / denom, p[1] / denom, p[2] / denom);
}

// Convert P2 points to their 12 singular (theta, phi) pairs on S2
function singularParams(points: [number, number, number][]): [number, number][] {
    const params: [number, number][] = [];
    for (const [x, y, z] of points) {
        const len = Math.sqrt(x * x + y * y + z * z);
        const nx = x / len, ny = y / len, nz = z / len;
        // Point and its antipode
        const theta1 = Math.acos(nz);
        const phi1 = Math.atan2(ny, nx);
        params.push([theta1, phi1 < 0 ? phi1 + 2 * Math.PI : phi1]);
        const theta2 = Math.PI - theta1;
        const phi2 = phi1 + Math.PI;
        params.push([theta2, phi2 >= 2 * Math.PI ? phi2 - 2 * Math.PI : phi2]);
    }
    return params;
}

// Squared geodesic distance on the (theta, phi) parameter domain,
// accounting for phi wrapping at 2π.
function paramDistSq(u: number, v: number, su: number, sv: number): number {
    const du = u - su;
    let dv = Math.abs(v - sv);
    if (dv > Math.PI) dv = 2 * Math.PI - dv;
    return du * du + dv * dv;
}

const NAN_VEC = new THREE.Vector3(NaN, NaN, NaN);

// Surface via S2 -> S3 -> R3, with an SO(4) rotation before projection.
class CubicSurface implements Surface {
    readonly map: (x: number, y: number, z: number) => [number, number, number, number];
    private singularities: [number, number][];
    angle: number;
    singularRadiusSq = 0.01; // exclusion zone — shrink after setting resolution

    constructor(points: [number, number, number][], angle = 0) {
        this.map = cubicMap(points);
        this.singularities = singularParams(points);
        this.angle = angle;
    }

    evaluate(u: number, v: number): THREE.Vector3 {
        // Skip vertices near any of the 12 singular points
        for (const [su, sv] of this.singularities) {
            if (paramDistSq(u, v, su, sv) < this.singularRadiusSq) {
                return NAN_VEC;
            }
        }

        const pt = spherePoint(u, v);
        const r4 = this.map(...pt);
        const s3 = normalize4(r4);
        // Rotate in two independent planes for a generic SO(4) element
        const r1 = rotate4(s3, 2, 3, this.angle);
        const r2 = rotate4(r1, 0, 3, this.angle * 0.7);
        return stereoProject(r2);
    }

    getDomain(): SurfaceDomain {
        return { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2 * Math.PI };
    }
}

// --- Exceptional lines (blown-up points) ---

// For a base point p in P2, find two points on the great circle in S3
// by approaching p from two perpendicular directions.
function findGreatCirclePair(
    p: [number, number, number],
    map: (x: number, y: number, z: number) => [number, number, number, number],
    eps = 1e-4,
): [[number, number, number, number], [number, number, number, number]] {
    // Build two tangent directions perpendicular to p
    const [px, py, pz] = p;
    // Pick a vector not parallel to p
    const ref: [number, number, number] = Math.abs(px) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    // Cross product p × ref
    const d1: [number, number, number] = [
        py * ref[2] - pz * ref[1],
        pz * ref[0] - px * ref[2],
        px * ref[1] - py * ref[0],
    ];
    // Cross product p × d1
    const d2: [number, number, number] = [
        py * d1[2] - pz * d1[1],
        pz * d1[0] - px * d1[2],
        px * d1[1] - py * d1[0],
    ];

    const a = normalize4(map(px + eps * d1[0], py + eps * d1[1], pz + eps * d1[2]));
    const b = normalize4(map(px + eps * d2[0], py + eps * d2[1], pz + eps * d2[2]));
    return [a, b];
}

// Gram-Schmidt: orthonormalize b against a (both assumed unit length).
// Returns the orthonormal pair [e1, e2].
function gramSchmidt4(
    a: [number, number, number, number],
    b: [number, number, number, number],
): [[number, number, number, number], [number, number, number, number]] {
    const dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
    const bPerp: [number, number, number, number] = [
        b[0] - dot * a[0],
        b[1] - dot * a[1],
        b[2] - dot * a[2],
        b[3] - dot * a[3],
    ];
    const len = Math.sqrt(bPerp[0]**2 + bPerp[1]**2 + bPerp[2]**2 + bPerp[3]**2);
    console.log(`  Gram-Schmidt: dot=${dot.toFixed(6)}, |bPerp|=${len.toFixed(6)}`);
    return [a, [bPerp[0]/len, bPerp[1]/len, bPerp[2]/len, bPerp[3]/len]];
}

// Complete an ON pair {e1, e2} in R4 to a full ON basis {e1, e2, e3, e4}.
// Uses a simple approach: try standard basis vectors and Gram-Schmidt.
function completeONBasis(
    e1: [number, number, number, number],
    e2: [number, number, number, number],
): [[number, number, number, number], [number, number, number, number]] {
    const candidates: [number, number, number, number][] = [
        [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1],
    ];

    function dot4(a: [number, number, number, number], b: [number, number, number, number]) {
        return a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
    }

    function sub4(v: [number, number, number, number], w: [number, number, number, number], s: number): [number, number, number, number] {
        return [v[0] - s*w[0], v[1] - s*w[1], v[2] - s*w[2], v[3] - s*w[3]];
    }

    function norm4(v: [number, number, number, number]) {
        return Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2 + v[3]**2);
    }

    let e3: [number, number, number, number] | null = null;
    let e4: [number, number, number, number] | null = null;

    for (const c of candidates) {
        let v = sub4(c, e1, dot4(c, e1));
        v = sub4(v, e2, dot4(v, e2));
        if (e3) v = sub4(v, e3, dot4(v, e3));
        const len = norm4(v);
        if (len < 1e-8) continue;
        const unit: [number, number, number, number] = [v[0]/len, v[1]/len, v[2]/len, v[3]/len];
        if (!e3) { e3 = unit; } else { e4 = unit; break; }
    }

    return [e3!, e4!];
}

// Build a tube mesh for an exceptional line in S3, then stereo project.
// The tube cross-section is a circle in S3 (not in R3), so it looks
// correct after stereographic projection.
function buildExceptionalLine(
    p: [number, number, number],
    map: (x: number, y: number, z: number) => [number, number, number, number],
    angle: number,
    angularRadius = 0.02,
    tSegments = 256,
    sSegments = 16,
): THREE.Mesh {
    const [a, b] = findGreatCirclePair(p, map);
    console.log(`Exceptional line for [${p}]:`, a, b);
    const [e1, e2] = gramSchmidt4(a, b);
    const [e3, e4] = completeONBasis(e1, e2);

    const cosR = Math.cos(angularRadius);
    const sinR = Math.sin(angularRadius);

    // Build vertices: (tSegments+1) × (sSegments+1) grid
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= tSegments; i++) {
        const t = (i / tSegments) * 2 * Math.PI;
        const ct = Math.cos(t), st = Math.sin(t);
        // Center of the tube at this t: point on great circle
        const center: [number, number, number, number] = [
            ct * e1[0] + st * e2[0],
            ct * e1[1] + st * e2[1],
            ct * e1[2] + st * e2[2],
            ct * e1[3] + st * e2[3],
        ];

        for (let j = 0; j <= sSegments; j++) {
            const s = (j / sSegments) * 2 * Math.PI;
            const cs = Math.cos(s), ss = Math.sin(s);
            // Normal direction in the e3, e4 plane
            const n3 = cs * e3[0] + ss * e4[0];
            const n3y = cs * e3[1] + ss * e4[1];
            const n3z = cs * e3[2] + ss * e4[2];
            const n3w = cs * e3[3] + ss * e4[3];
            // Point on tube in S3: cos(r)*center + sin(r)*normal
            const q: [number, number, number, number] = [
                cosR * center[0] + sinR * n3,
                cosR * center[1] + sinR * n3y,
                cosR * center[2] + sinR * n3z,
                cosR * center[3] + sinR * n3w,
            ];

            // Apply SO(4) rotation and stereo project
            const r1 = rotate4(q, 2, 3, angle);
            const r2 = rotate4(r1, 0, 3, angle * 0.7);
            const pt3 = stereoProject(r2);
            positions.push(pt3.x, pt3.y, pt3.z);

            // Normal in R3: stereo project the S3 normal direction
            const r1c = rotate4(center, 2, 3, angle);
            const r2c = rotate4(r1c, 0, 3, angle * 0.7);
            const ptCenter = stereoProject(r2c);
            normals.push(pt3.x - ptCenter.x, pt3.y - ptCenter.y, pt3.z - ptCenter.z);
        }
    }

    // Build triangle indices
    for (let i = 0; i < tSegments; i++) {
        for (let j = 0; j < sSegments; j++) {
            const v0 = i * (sSegments + 1) + j;
            const v1 = (i + 1) * (sSegments + 1) + j;
            const v2 = i * (sSegments + 1) + (j + 1);
            const v3 = (i + 1) * (sSegments + 1) + (j + 1);
            indices.push(v0, v1, v2);
            indices.push(v1, v3, v2);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.computeVertexNormals(); // override our approximate normals

    const mat = new THREE.MeshPhysicalMaterial({
        color: 0xff3333,
        roughness: 0.3,
        metalness: 0.1,
        side: THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
}

// Remove any triangle that has a NaN vertex from the geometry's index buffer.
function stripNaNTriangles(geometry: THREE.BufferGeometry) {
    const pos = geometry.getAttribute('position') as THREE.Float32BufferAttribute;
    const index = geometry.getIndex();
    if (!index) return;

    const src = index.array;
    const clean: number[] = [];

    for (let i = 0; i < src.length; i += 3) {
        const a = src[i], b = src[i + 1], c = src[i + 2];
        if (
            isNaN(pos.getX(a)) || isNaN(pos.getX(b)) || isNaN(pos.getX(c))
        ) continue;
        clean.push(a, b, c);
    }

    geometry.setIndex(clean);
}

// --- Scene setup ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 3, 8);
app.controls.target.set(0, 0, 0);
app.scene.add(Lights.threePoint());
app.backgrounds.setColor(0x1a1a2e);



// 6 points in P2 
const points: [number, number, number][] = [
    [1, 0, 0],
    [0, 1, 0.2],
    [0, 0, 1],
    [1, 1, 1],
    [1, 2, 1],
    [2, 5, 3],
];

const basis = cubicNullspace(points);
console.log('Nullspace dimension:', basis.length);
console.log('Basis vectors:', basis);

const surface = new CubicSurface(points);
const uSegs = 1024, vSegs = 1024;
// Exclusion radius = 2 grid cells (squared)
const gridStep = Math.max(Math.PI / uSegs, 2 * Math.PI / vSegs);
surface.singularRadiusSq = (2 * gridStep) ** 2;

const mesh = new SurfaceMesh(surface, { uSegments: uSegs, vSegments: vSegs });
app.scene.add(mesh);

surface.angle = 3.6;
mesh.rebuild();
stripNaNTriangles(mesh.geometry);

// Draw the 6 exceptional lines (reuse the same map as the surface)
const lineMeshes: THREE.Mesh[] = [];
for (const p of points) {
    const line = buildExceptionalLine(p, surface.map, surface.angle);
    lineMeshes.push(line);
    app.scene.add(line);
}

app.addAnimateCallback((time) => {
    //surface.angle = time * 0.2;
    //mesh.rebuild();
    //stripNaNTriangles(mesh.geometry);
});

app.start();
