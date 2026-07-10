# A symmetric chart on the Markoff surface (parameterizing Teichmüller space)

A self-contained spec for the map `ℝ² → Markoff surface` used to parameterize the
Teichmüller space of the once-punctured torus by a flat `(a, b)` plane. Hand this
to a coding agent in another project.

## The surface

The Teichmüller / character variety of the once-punctured hyperbolic torus is the
component of the **Markoff cubic**

```
x² + y² + z² = x·y·z
```

with `x, y, z ≥ 2` (each coordinate is the trace of a generating simple closed
curve; trace `2` = a curve pinched to a cusp = the boundary). The modular
(hexagonal) torus is `(3, 3, 3)`. The equation is symmetric under permuting
`(x, y, z)` — an `S₃` action.

## The chart: project along the symmetry axis

The `(1,1,1)` direction is the axis of the `S₃` symmetry. Put an **orthonormal
frame** on `ℝ³` with that axis as the "height":

```
n = (1, 1, 1)/√3      (axis)
u = (1, −1, 0)/√2     (plane)
v = (1, 1, −2)/√6     (plane)
```

Any point `X = (x, y, z)` decomposes as `X = h·n + a·u + b·v`, i.e.

```
a = X·u = (x − y)/√2
b = X·v = (x + y − 2z)/√6
h = X·n = (x + y + z)/√3       (height along the axis)
```

`(a, b)` is the chart coordinate (modular torus → origin; `S₃` becomes a 3-fold
hexagonal symmetry of the plane). The forward map is just these three dot
products. The inverse — `(a, b) →` surface — needs the height `h`, recovered below.

## Inverse map ℝ² → surface

Reconstruct from `(h, a, b)` in the standard basis (`X = h·n + a·u + b·v`):

```
x = h/√3 + a/√2 + b/√6
y = h/√3 − a/√2 + b/√6
z = h/√3        − 2b/√6
```

Given `(a, b)`, the height `h` on the surface is a root of the cubic

```
h³ − 3√3·h² − (3/2)·ρ²·h − 3√3·(ρ² − e₃) = 0
```

where

```
ρ² = a² + b²                         (squared radius in the plane)
e₃ = b·(3a² − b²)/(3√6)              (the order-3 harmonic carrying the symmetry)
```

The **Teichmüller sheet is the largest real root** `h`. Reconstruct `(x, y, z)`
from `(h, a, b)`; the point is a valid hyperbolic structure iff `x, y, z ≥ 2`
(otherwise `(a, b)` lies outside the chart — a curve has pinched).

### Where the cubic comes from (so you can verify)

Because `n, u, v` are orthonormal, `x² + y² + z² = |X|² = h² + ρ²`. Expanding the
product `x·y·z = (h/√3 + p_x)(h/√3 + p_y)(h/√3 + p_z)` with `p = a·u + b·v`, the
planar parts satisfy `p_x + p_y + p_z = 0` (so the `h²` term drops), and

```
p_x·p_y + p_x·p_z + p_y·p_z = −ρ²/2
p_x·p_y·p_z                  = e₃
⇒  x·y·z = h³/(3√3) − ρ²·h/(2√3) + e₃.
```

Setting `x·y·z = x² + y² + z² = h² + ρ²` and clearing `3√3` gives exactly the
cubic above.

## Solving the cubic (numerics)

Depress `t³ + A t² + B t + C` with `t = w − A/3 ⇒ w³ + p w + q = 0`:

```
p = B − A²/3,   q = 2A³/27 − A·B/3 + C,   shift = −A/3
disc = −4p³ − 27q²
```

- **`disc ≥ 0` (three real roots)** — trigonometric form (the common case near the
  modular torus); take the largest:
  ```
  m = 2·√(−p/3)
  φ = acos( clamp(3q/(p·m), −1, 1) ) / 3
  w_k = m·cos(φ − 2πk/3) + shift,   k = 0,1,2
  ```
- **`disc < 0` (one real root)** — Cardano (most of the chart away from the centre,
  including up the cusp, lands here):
  ```
  s = √(q²/4 + p³/27)
  w = cbrt(−q/2 + s) + cbrt(−q/2 − s) + shift
  ```

Both branches are needed — naively using only the trig branch silently truncates
the domain. For this cubic `A = −3√3`, `B = −(3/2)ρ²`, `C = −3√3(ρ² − e₃)`.

## Reference implementation (TypeScript)

```ts
const S2 = Math.SQRT2, S3 = Math.sqrt(3), S6 = Math.sqrt(6);

// forward: surface point → chart (a,b) and axis height h
const project = (x:number,y:number,z:number) => [(x - y)/S2, (x + y - 2*z)/S6];
const height  = (x:number,y:number,z:number) => (x + y + z)/S3;

// inverse: chart (a,b) → surface point, or null if outside the Teichmüller sheet
function liftToTriple(a:number, b:number): [number,number,number] | null {
  const rho2 = a*a + b*b;
  const e3 = b*(3*a*a - b*b)/(3*S6);
  const h = largestRoot(-3*S3, -1.5*rho2, -3*S3*(rho2 - e3));   // cubic above
  const x = h/S3 + a/S2 + b/S6;
  const y = h/S3 - a/S2 + b/S6;
  const z = h/S3        - 2*b/S6;
  if (!(x >= 2 && y >= 2 && z >= 2) || !Number.isFinite(h)) return null;
  return [x, y, z];
}

function largestRoot(A:number, B:number, C:number): number {
  const p = B - A*A/3, q = 2*A*A*A/27 - A*B/3 + C, shift = -A/3;
  const disc = -4*p*p*p - 27*q*q;
  if (disc >= 0) {                                   // three real roots
    const m = 2*Math.sqrt(-p/3);
    const phi = Math.acos(Math.max(-1, Math.min(1, 3*q/(p*m))))/3;
    return Math.max(
      m*Math.cos(phi) + shift,
      m*Math.cos(phi - 2*Math.PI/3) + shift,
      m*Math.cos(phi - 4*Math.PI/3) + shift,
    );
  }
  const s = Math.sqrt(q*q/4 + p*p*p/27);             // one real root (Cardano)
  return Math.cbrt(-q/2 + s) + Math.cbrt(-q/2 - s) + shift;
}
```

## One-line summary

Frame `ℝ³` by `n=(1,1,1)/√3, u=(1,−1,0)/√2, v=(1,1,−2)/√6`; a Markoff structure is
`a=(x−y)/√2, b=(x+y−2z)/√6, h=(x+y+z)/√3`, and inverting `(a,b)→(x,y,z)` means
taking the **largest real root** of `h³ − 3√3 h² − (3/2)ρ²h − 3√3(ρ²−e₃)=0`
(`ρ²=a²+b²`, `e₃=b(3a²−b²)/(3√6)`), valid while all three traces stay `≥ 2`.
