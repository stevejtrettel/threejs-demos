// Lattice visualization fragment shader
//
// Draws a 2D lattice Λ = ω₁ℤ + ω₂ℤ on a plane.
// All layers are independently toggleable.

uniform vec2 uOmega1;
uniform vec2 uOmega2;
uniform vec2 uReducedOmega1;
uniform vec2 uReducedOmega2;

// Layer toggles
uniform bool uShowPoints;
uniform bool uShowGrid;
uniform bool uShowVoronoi;
uniform bool uShowBasis;
uniform bool uShowReducedBasis;
uniform bool uShowFundDomain;
uniform bool uShowReducedFundDomain;

// Visual parameters
uniform float uPointRadius;
uniform float uLineWidth;
uniform float uBasisWidth;
uniform vec3 uPointColor;
uniform vec3 uGridColor;
uniform vec3 uVoronoiColor;
uniform vec3 uBasisColor;
uniform vec3 uReducedBasisColor;
uniform vec3 uFundDomainColor;
uniform vec3 uReducedFundDomainColor;
uniform float uFundDomainAlpha;
uniform float uReducedFundDomainAlpha;
uniform vec3 uBackgroundColor;

varying vec2 vWorldPos;

// ── Coordinate transform ─────────────────────────────────

vec2 toLatticeCoords(vec2 p, vec2 w1, vec2 w2) {
    float det = w1.x * w2.y - w1.y * w2.x;
    return vec2(
        (p.x * w2.y - p.y * w2.x) / det,
        (w1.x * p.y - w1.y * p.x) / det
    );
}

// ── Distance to nearest lattice point ────────────────────

float distToNearestPoint(vec2 p, vec2 w1, vec2 w2) {
    vec2 ab = toLatticeCoords(p, w1, w2);
    vec2 ab0 = floor(ab + 0.5);
    float minDist = 1e10;
    for (int di = -1; di <= 1; di++) {
        for (int dj = -1; dj <= 1; dj++) {
            vec2 candidate = ab0 + vec2(float(di), float(dj));
            vec2 lp = candidate.x * w1 + candidate.y * w2;
            minDist = min(minDist, length(p - lp));
        }
    }
    return minDist;
}

// ── Distance to parallelogram grid edges ─────────────────

float distToGrid(vec2 p, vec2 w1, vec2 w2) {
    vec2 ab = toLatticeCoords(p, w1, w2);
    float fracA = abs(fract(ab.x + 0.5) - 0.5);
    float fracB = abs(fract(ab.y + 0.5) - 0.5);
    float det = abs(w1.x * w2.y - w1.y * w2.x);
    float hA = det / length(w2);
    float hB = det / length(w1);
    return min(fracA * hA, fracB * hB);
}

// ── Voronoi cell edges ───────────────────────────────────

float voronoiEdgeDist(vec2 p, vec2 w1, vec2 w2) {
    vec2 ab = toLatticeCoords(p, w1, w2);
    vec2 ab0 = floor(ab + 0.5);
    float d1 = 1e10;
    float d2 = 1e10;
    for (int di = -2; di <= 2; di++) {
        for (int dj = -2; dj <= 2; dj++) {
            vec2 candidate = ab0 + vec2(float(di), float(dj));
            vec2 lp = candidate.x * w1 + candidate.y * w2;
            float d = length(p - lp);
            if (d < d1) {
                d2 = d1;
                d1 = d;
            } else if (d < d2) {
                d2 = d;
            }
        }
    }
    return d2 - d1;
}

// ── Segment and arrow distance ───────────────────────────

float distToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - (a + t * ab));
}

float distToArrow(vec2 p, vec2 origin, vec2 tip, float headSize) {
    float dShaft = distToSegment(p, origin, tip);
    vec2 dir = normalize(tip - origin);
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 back = tip - dir * headSize;
    float dHead1 = distToSegment(p, tip, back + perp * headSize * 0.5);
    float dHead2 = distToSegment(p, tip, back - perp * headSize * 0.5);
    return min(dShaft, min(dHead1, dHead2));
}

// ── Fundamental domain test ──────────────────────────────

bool inFundDomain(vec2 p, vec2 w1, vec2 w2) {
    vec2 ab = toLatticeCoords(p, w1, w2);
    return ab.x >= 0.0 && ab.x < 1.0 && ab.y >= 0.0 && ab.y < 1.0;
}

// ── Main ─────────────────────────────────────────────────

void main() {
    vec2 p = vWorldPos;
    vec3 color = uBackgroundColor;

    // All geometric lookups use the REDUCED basis for numerical stability.
    // The reduced basis spans the same lattice but stays well-conditioned.
    vec2 rw1 = uReducedOmega1;
    vec2 rw2 = uReducedOmega2;

    // Fundamental domain fill (behind everything)
    if (uShowFundDomain && inFundDomain(p, uOmega1, uOmega2)) {
        color = mix(color, uFundDomainColor, uFundDomainAlpha);
    }
    if (uShowReducedFundDomain && inFundDomain(p, rw1, rw2)) {
        color = mix(color, uReducedFundDomainColor, uReducedFundDomainAlpha);
    }

    // Voronoi cells (always use reduced basis)
    if (uShowVoronoi) {
        float vEdge = voronoiEdgeDist(p, rw1, rw2);
        float vAlpha = 1.0 - smoothstep(0.0, uLineWidth, vEdge);
        color = mix(color, uVoronoiColor, vAlpha);
    }

    // Parallelogram grid (always use reduced basis)
    if (uShowGrid) {
        float gDist = distToGrid(p, rw1, rw2);
        float gAlpha = 1.0 - smoothstep(0.0, uLineWidth, gDist);
        color = mix(color, uGridColor, gAlpha);
    }

    // Original basis arrows
    if (uShowBasis) {
        float d1 = distToArrow(p, vec2(0.0), uOmega1, length(uOmega1) * 0.12);
        float d2 = distToArrow(p, vec2(0.0), uOmega2, length(uOmega2) * 0.12);
        float bAlpha = 1.0 - smoothstep(0.0, uBasisWidth, min(d1, d2));
        color = mix(color, uBasisColor, bAlpha);
    }

    // Reduced basis arrows
    if (uShowReducedBasis) {
        float d1 = distToArrow(p, vec2(0.0), rw1, length(rw1) * 0.12);
        float d2 = distToArrow(p, vec2(0.0), rw2, length(rw2) * 0.12);
        float bAlpha = 1.0 - smoothstep(0.0, uBasisWidth, min(d1, d2));
        color = mix(color, uReducedBasisColor, bAlpha);
    }

    // Lattice points (on top, always use reduced basis)
    if (uShowPoints) {
        float pDist = distToNearestPoint(p, rw1, rw2);
        float pAlpha = 1.0 - smoothstep(uPointRadius * 0.8, uPointRadius, pDist);
        color = mix(color, uPointColor, pAlpha);
    }

    gl_FragColor = vec4(color, 1.0);
}
