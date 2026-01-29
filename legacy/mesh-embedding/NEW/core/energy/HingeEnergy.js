/**
 * HingeEnergy.js - Discrete bending energy for mesh surfaces
 *
 * Energy: E = k (1 - n₁·n₂)
 *
 * For two triangles sharing an edge, this penalizes deviation from
 * flatness. Equivalent to k·θ²/2 for small bending angles θ.
 */

import { Energy } from './Energy.js';

// ============================================================================
// Vector utilities (private)
// ============================================================================

function cross(a, b, out) {
    out[0] = a[1] * b[2] - a[2] * b[1];
    out[1] = a[2] * b[0] - a[0] * b[2];
    out[2] = a[0] * b[1] - a[1] * b[0];
    return out;
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function lengthOf(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function scaleVec(v, s, out) {
    out[0] = v[0] * s;
    out[1] = v[1] * s;
    out[2] = v[2] * s;
    return out;
}

// ============================================================================
// Hinge: data holder for adjacent face pair
// ============================================================================

/**
 * A hinge connects two triangles sharing edge AB:
 *
 *        C
 *       /|\
 *      / | \
 *     / 1|  \
 *    A---+---B
 *     \ 2|  /
 *      \ | /
 *       \|/
 *        D
 *
 * Face 1: (A, B, C)  -  winds so normal points "up"
 * Face 2: (B, A, D)  -  shared edge reversed, normal points "up"
 */
export class Hinge {
    /**
     * @param {number} a - shared edge vertex 1
     * @param {number} b - shared edge vertex 2
     * @param {number} c - wing vertex of face 1
     * @param {number} d - wing vertex of face 2
     * @param {number} k - bending stiffness
     */
    constructor(a, b, c, d, k) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.k = k;
    }
}

// ============================================================================
// BendingEnergy: sum of hinge bending energies
// ============================================================================

export class HingeEnergy extends Energy {
    /**
     * @param {Hinge[]} hinges - array of hinges
     */
    constructor(hinges) {
        super();
        this.hinges = hinges;

        // Scratch arrays for intermediate computations
        this._AB = new Float32Array(3);
        this._AC = new Float32Array(3);
        this._BA = new Float32Array(3);
        this._BD = new Float32Array(3);
        this._N1 = new Float32Array(3);
        this._N2 = new Float32Array(3);
        this._n1 = new Float32Array(3);
        this._n2 = new Float32Array(3);
        this._tmp = new Float32Array(3);
        this._gradTmp = new Float32Array(3);
    }

    termCount() {
        return this.hinges.length;
    }

    termVertices(k) {
        const h = this.hinges[k];
        return [h.a, h.b, h.c, h.d];
    }

    /**
     * Compute normals for hinge. Returns null if degenerate.
     * Populates this._n1, this._n2 and returns { len1, len2 }.
     */
    _computeNormals(h, emb) {
        // Edge vectors for face 1: (A, B, C)
        // difference(j, i) returns x_i - x_j
        emb.difference(h.a, h.b, this._AB);  // B - A
        emb.difference(h.a, h.c, this._AC);  // C - A

        // Edge vectors for face 2: (B, A, D)
        emb.difference(h.b, h.a, this._BA);  // A - B
        emb.difference(h.b, h.d, this._BD);  // D - B

        // Unnormalized normals
        cross(this._AB, this._AC, this._N1);  // (B-A) × (C-A)
        cross(this._BA, this._BD, this._N2);  // (A-B) × (D-B)

        const len1 = lengthOf(this._N1);
        const len2 = lengthOf(this._N2);

        // Degenerate triangle check
        if (len1 < 1e-10 || len2 < 1e-10) return null;

        scaleVec(this._N1, 1 / len1, this._n1);
        scaleVec(this._N2, 1 / len2, this._n2);

        return { len1, len2 };
    }

    termValue(k, emb) {
        const h = this.hinges[k];
        const normals = this._computeNormals(h, emb);

        if (!normals) return 0;

        const cosTheta = dot(this._n1, this._n2);
        return h.k * (1 - cosTheta);
    }

 termGradAccumulate(k, emb, grad) {
    const h = this.hinges[k];
    const normals = this._computeNormals(h, emb);

    if (!normals) return;

    const { len1, len2 } = normals;
    const n1 = this._n1;
    const n2 = this._n2;
    const tmp = this._tmp;
    const g = this._gradTmp;

    const AB = this._AB;  // B - A
    const AC = this._AC;  // C - A
    const BA = this._BA;  // A - B
    const BD = this._BD;  // D - B

    // First: project each normal onto tangent plane of the other
    // proj_n2 = n2 - n1*(n1·n2)  (for derivatives of n1)
    // proj_n1 = n1 - n2*(n2·n1)  (for derivatives of n2)
    const n1_dot_n2 = dot(n1, n2);

    const proj_n2 = this._proj_n2 || (this._proj_n2 = new Float32Array(3));
    const proj_n1 = this._proj_n1 || (this._proj_n1 = new Float32Array(3));

    proj_n2[0] = n2[0] - n1[0] * n1_dot_n2;
    proj_n2[1] = n2[1] - n1[1] * n1_dot_n2;
    proj_n2[2] = n2[2] - n1[2] * n1_dot_n2;

    proj_n1[0] = n1[0] - n2[0] * n1_dot_n2;
    proj_n1[1] = n1[1] - n2[1] * n1_dot_n2;
    proj_n1[2] = n1[2] - n2[2] * n1_dot_n2;

    const idxA = 3 * h.a;
    const idxB = 3 * h.b;
    const idxC = 3 * h.c;
    const idxD = 3 * h.d;

    const scale1 = -h.k / len1;
    const scale2 = -h.k / len2;

    // Gradient formula: ∇_v E = -k/|N| * (∂N/∂v)ᵀ * proj_n
    //
    // For ∂N/∂v that acts as δ ↦ w×δ, the transpose acts as x ↦ x×w
    // For ∂N/∂v that acts as δ ↦ δ×w, the transpose acts as x ↦ w×x

    // --- Vertex A ---
    // ∂N₁/∂A: δ ↦ (C-B)×δ, so transpose: x ↦ x×(C-B)
    tmp[0] = AC[0] - AB[0];  // C - B
    tmp[1] = AC[1] - AB[1];
    tmp[2] = AC[2] - AB[2];
    cross(proj_n2, tmp, g);  // proj_n2 × (C-B)
    grad[idxA]     += scale1 * g[0];
    grad[idxA + 1] += scale1 * g[1];
    grad[idxA + 2] += scale1 * g[2];

    // ∂N₂/∂A: δ ↦ δ×(D-B), so transpose: x ↦ (D-B)×x
    cross(BD, proj_n1, g);  // (D-B) × proj_n1
    grad[idxA]     += scale2 * g[0];
    grad[idxA + 1] += scale2 * g[1];
    grad[idxA + 2] += scale2 * g[2];

    // --- Vertex B ---
    // ∂N₁/∂B: δ ↦ δ×(C-A), so transpose: x ↦ (C-A)×x
    cross(AC, proj_n2, g);  // (C-A) × proj_n2
    grad[idxB]     += scale1 * g[0];
    grad[idxB + 1] += scale1 * g[1];
    grad[idxB + 2] += scale1 * g[2];

    // ∂N₂/∂B: δ ↦ (D-A)×δ, so transpose: x ↦ x×(D-A)
    tmp[0] = BD[0] + AB[0];  // D - A = (D-B) + (B-A)
    tmp[1] = BD[1] + AB[1];
    tmp[2] = BD[2] + AB[2];
    cross(proj_n1, tmp, g);  // proj_n1 × (D-A)
    grad[idxB]     += scale2 * g[0];
    grad[idxB + 1] += scale2 * g[1];
    grad[idxB + 2] += scale2 * g[2];

    // --- Vertex C (only in face 1) ---
    // ∂N₁/∂C: δ ↦ (B-A)×δ, so transpose: x ↦ x×(B-A)
    cross(proj_n2, AB, g);  // proj_n2 × (B-A)
    grad[idxC]     += scale1 * g[0];
    grad[idxC + 1] += scale1 * g[1];
    grad[idxC + 2] += scale1 * g[2];

    // --- Vertex D (only in face 2) ---
    // ∂N₂/∂D: δ ↦ (A-B)×δ, so transpose: x ↦ x×(A-B)
    cross(proj_n1, BA, g);  // proj_n1 × (A-B)
    grad[idxD]     += scale2 * g[0];
    grad[idxD + 1] += scale2 * g[1];
    grad[idxD + 2] += scale2 * g[2];
}

    /**
     * Project out normal component and accumulate into gradient.
     *
     * Computes: grad[idx:idx+3] += coef * (1/len) * (v - n*(n·v))
     */
    _projectAndAccumulate(v, n, len, grad, idx, coef) {
        const nDotV = dot(n, v);
        const scale = coef / len;

        grad[idx]     += scale * (v[0] - n[0] * nDotV);
        grad[idx + 1] += scale * (v[1] - n[1] * nDotV);
        grad[idx + 2] += scale * (v[2] - n[2] * nDotV);
    }



    /**
 * Numerical gradient check for debugging
 */
verifyGradient(emb, termIndex = 0, eps = 1e-5) {
    const h = this.hinges[termIndex];
    const verts = [h.a, h.b, h.c, h.d];
    
    console.log(`--- Verifying gradient for hinge ${termIndex} ---`);
    
    const grad = new Float32Array(emb.pos.length);
    this.termGradAccumulate(termIndex, emb, grad);
    
    for (const v of verts) {
        for (let dim = 0; dim < 3; dim++) {
            const idx = 3 * v + dim;
            const orig = emb.pos[idx];
            
            emb.pos[idx] = orig + eps;
            const Eplus = this.termValue(termIndex, emb);
            
            emb.pos[idx] = orig - eps;
            const Eminus = this.termValue(termIndex, emb);
            
            emb.pos[idx] = orig;
            
            const numerical = (Eplus - Eminus) / (2 * eps);
            const analytical = grad[idx];
            const error = Math.abs(numerical - analytical);
            const relError = error / (Math.abs(numerical) + 1e-10);
            
            if (relError > 0.01) {
                console.log(`  vertex ${v} dim ${dim}: analytical=${analytical.toFixed(6)}, numerical=${numerical.toFixed(6)}, relErr=${(relError*100).toFixed(1)}%`);
            }
        }
    }
}
}