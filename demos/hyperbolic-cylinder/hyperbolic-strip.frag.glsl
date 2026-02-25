// Hyperbolic strip shader
//
// The K=-1 surface of revolution with waist radius a is isometric to a strip
// of width 2·arcsinh(1/a) centered on a geodesic in H².
//
// Pipeline: surface UVs → Fermi coordinates (s, t) → upper half-plane → tiling

uniform float uA;     // waist radius
uniform float uSMax;  // = arcsinh(1/a), half-width of strip in H²

// PI is provided by Three.js

// =====================================================================
// Coordinate mapping: UV → Fermi → upper half-plane
// =====================================================================

vec2 uvToFermi(vec2 uv) {
    float s = (2.0 * uv.y - 1.0) * uSMax;   // s ∈ [-sMax, sMax]
    float t = uA * (uv.x - 0.5) * 2.0 * PI;  // t ∈ [-πa, πa], centered
    return vec2(s, t);
}

vec2 fermiToUHP(vec2 st) {
    float s = st.x;
    float t = st.y;

    float ex = exp(s);
    float emx = exp(-s);
    float cosh_s = (ex + emx) * 0.5;
    float sinh_s = (ex - emx) * 0.5;

    return vec2(
        exp(t) * sinh_s / cosh_s,   // x = e^t tanh(s)
        exp(t) / cosh_s              // y = e^t / cosh(s)
    );
}

// Complex division: a / b
vec2 cdiv(vec2 a, vec2 b) {
    float d = dot(b, b);
    return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / d;
}

// Möbius transform: w = (z - 1)/(z + 1)
// Maps y-axis geodesic → unit circle geodesic (isometry of H²)
vec2 yaxisToUnitCircle(vec2 z) {
    return cdiv(z - vec2(1.0, 0.0), z + vec2(1.0, 0.0));
}

vec2 uvToUHP(vec2 uv) {
    return fermiToUHP(uvToFermi(uv));     // central geodesic = y-axis
}

// Cayley transform: UHP → Poincaré disk
vec2 uhpToDisk(vec2 z) {
    vec2 num = z - vec2(0.0, 1.0);
    vec2 den = z + vec2(0.0, 1.0);
    float d2 = dot(den, den);
    return vec2(
        (num.x * den.x + num.y * den.y) / d2,
        (num.y * den.x - num.x * den.y) / d2
    );
}

// =====================================================================
// (2,3,7) triangle tiling in the upper half-plane
// =====================================================================

const vec3 CREAM = vec3(0.85, 0.8, 0.75);
const vec3 SLATE = vec3(0.35, 0.4, 0.45);

struct HalfSpaceVert {
    float x;
    float side;
};

struct HalfSpaceCirc {
    float center;
    float radius;
    float side;
};

vec2 reflectInto(vec2 z, HalfSpaceVert h, inout int count) {
    if ((z.x - h.x) * h.side < 0.0) return z;
    z.x = 2.0 * h.x - z.x;
    count++;
    return z;
}

vec2 reflectInto(vec2 z, HalfSpaceCirc h, inout int count) {
    vec2 rel = z - vec2(h.center, 0.0);
    float dist2 = dot(rel, rel);

    if ((dist2 - h.radius * h.radius) * h.side > 0.0) return z;

    // Circle inversion
    z.x -= h.center;
    z = z / h.radius;
    z = z / dot(z, z);
    z = z * h.radius;
    z.x += h.center;
    count++;
    return z;
}

vec4 tilingColor(vec2 z) {
    // The (2,3,7) triangle: three mirror edges
    HalfSpaceVert left = HalfSpaceVert(0.0, -1.0);             // x > 0
    HalfSpaceCirc bottom = HalfSpaceCirc(0.0, 1.0, 1.0);       // outside unit circle
    HalfSpaceCirc third = HalfSpaceCirc(-0.7665, 1.533, -1.0); // inside this circle

    int foldCount = 0;
    for (int i = 0; i < 300; i++) {
        vec2 z0 = z;
        z = reflectInto(z, left, foldCount);
        z = reflectInto(z, bottom, foldCount);
        z = reflectInto(z, third, foldCount);
        if (length(z - z0) < 0.0001) break;
    }

    // Color by parity
    float parity = mod(float(foldCount), 2.0);
    vec3 color = (parity < 0.5) ? CREAM : SLATE;

    return vec4(color, 1.0);
}

// =====================================================================

void main() {
    vec2 z = uvToUHP(vMapUv);
    csm_DiffuseColor = tilingColor(z);
}
