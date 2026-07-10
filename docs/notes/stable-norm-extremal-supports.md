# Exact extremal supporting lines of the McShane–Rivin stable-norm ball

A self-contained spec for computing, in **closed form**, the two extremal
supporting lines at each rational corner of the stable-norm unit ball of a
once-punctured hyperbolic torus — and how to assemble them into a rigorous
circumscribed (outer) polygon. Hand this to a coding agent in another project.

## Setup

A once-punctured hyperbolic torus is determined by a **trace triple**
`(x, y, z)` of three curves generating `π₁`, lying on the Markoff cubic

```
x² + y² + z² = x·y·z          (x,y,z ≥ 2 for the hyperbolic locus; modular torus = (3,3,3))
```

Primitive free-homotopy classes of simple closed curves correspond to primitive
slopes `(p, q) ∈ ℤ²` (gcd 1), up to sign. Each has a **trace** `t(p,q)` and a
hyperbolic **length**

```
ℓ(p,q) = 2·arccosh( |t(p,q)| / 2 ).
```

The **stable norm** (McShane–Rivin) has unit ball `B` whose boundary is the
closure of the **boundary samples**

```
P(p,q) = (p, q) / ℓ(p,q)      and their antipodes −P(p,q).
```

`B` is strictly convex but has a **genuine corner at every rational direction**
`(p,q)` (the sagitta is strictly positive, decaying exponentially in `‖(p,q)‖`).
So `B` is *not* a polygon; the corners are where supporting lines live.

### Traces from the triple (Vieta / Cohn tree)

Seed: assign the triple to the three simplest slopes, e.g.
`t(1,0)=x`, `t(0,1)=y`, `t(1,1)=z` (consistent with the Markoff relation:
neighbours `u,v` with `det(u,v)=±1` and mediant `m=u+v` satisfy the trace
identity below). Generate all other traces by the **Vieta recurrence** on Farey
neighbours `u, v` (i.e. `det(u,v)=±1`):

```
t(u+v) = t(u)·t(v) − t(u−v).
```

Walking the Farey/Stern–Brocot tree from the seed gives `t(p,q)` for every
primitive slope. (`|t|≥2` ⇒ real length.)

## The exact extremal supports (closed form)

Reference: **Doan–Li–Nguyen, "McShane–Rivin norm balls of punctured tori"**,
Prop. 3.1 / eq. (3.13). Also McShane–Rivin for the norm itself.

Let `u, v` be **Farey neighbours** (`det(u,v)=+1`, orient so the mediant
`m = u+v` lies in the gap between them). Write `xu=|t(u)|`, `xv=|t(v)|`. Define
the **larger Fricke root** from the two traces alone:

```
x_m = ( xu·xv + √( (xu·xv)² − 4·(xu² + xv²) ) ) / 2
```

and the two positive constants

```
A = ( x_m − xv · e^(−ℓu/2) ) / √(xu² − 4)
B = ( x_m − xu · e^(−ℓv/2) ) / √(xv² − 4)
```

where `ℓu = 2·arccosh(xu/2)`, `ℓv = 2·arccosh(xv/2)`, and conveniently
`e^(−ℓu/2) = (xu − √(xu²−4)) / 2`, `√(xu²−4) = e^(ℓu/2) − e^(−ℓu/2)`.

A supporting line of `B` is the level set `{ X ∈ ℝ² : λ·X = 1 }` of a covector
`λ ∈ (ℝ²)*`. The **two one-sided (extremal) support covectors** of the gap
`(u, v)` are fixed by their values on the integer slope vectors:

```
λ_{u|v}(u) = ℓu ,   λ_{u|v}(v) = 2·ln A      (support at corner P(u), facing v)
λ_{v|u}(v) = ℓv ,   λ_{v|u}(u) = 2·ln B      (support at corner P(v), facing u)
```

Each `λ` is recovered by solving the 2×2 system in the basis `{u, v}`. With
`D = det(u,v) = u_p·v_q − u_q·v_p`:

```
λ = ( (cu·v_q − cv·u_q)/D ,  (u_p·cv − v_p·cu)/D )      where λ(u)=cu, λ(v)=cv.
```

**Why this is the support at `P(u)`:** `λ_{u|v}·P(u) = λ_{u|v}(u)/ℓu = ℓu/ℓu = 1`,
so the line `{λ·X=1}` passes through the boundary corner `P(u)`; the second
condition `λ(v)=2 ln A` selects the *extremal* slope on the `v`-side of the
corner (the steepest line that still supports `B`). The corner `P(u)` therefore
has two extremal lines, one for each Farey neighbour; the boundary arc between
`P(u)` and `P(v)` lies inside the wedge they cut out.

## Assembling the outer body

Every support line satisfies `B ⊆ { X : λ·X ≤ 1 }`. So for any finite set of
directions (e.g. all primitive slopes with `p²+q² ≤ R²`), collect all their
extremal covectors `{λ_i}` and take the intersection of half-planes — this is a
**rigorous circumscribed polygon** `⊇ B`, hence its area is an **upper bound**
`U_R ≥ V` for the stable-norm ball volume `V`, for *any* `R`, with no tail or
limit argument. As `R → ∞` it converges down onto `B`.

The intersection `⋂ {λ_i·X ≤ 1}` is the **polar dual** of `conv{λ_i}`:
take the convex hull of the covectors (as points), and for each hull edge
`(w_a, w_b)` the dual vertex solves `w_a·X = w_b·X = 1`:

```
det = w_a×w_b ;   vertex = ( (w_b.y − w_a.y)/det , (w_a.x − w_b.x)/det ).
```

**Variants used in practice**
- *extremal* — keep both extremal covectors per corner: the tightest polygon, it
  touches `B` at every corner `P(u)`.
- *mid* — replace a corner's two covectors by their average: one facet per
  direction, a cleaner but slightly looser polygon.

## Minimal reference implementation (TypeScript)

```ts
// Covector λ with λ(u)=cu, λ(v)=cv in basis {u,v} (u,v = integer slope vectors).
function covector(u, v, cu, cv) {
  const D = u.p * v.q - u.q * v.p;
  if (Math.abs(D) < 1e-12) return null;
  return [(cu * v.q - cv * u.q) / D, (u.p * cv - v.p * cu) / D];
}

// Two extremal one-sided support covectors of the Farey gap (u,v).
// u,v carry {p, q, trace}. Returns {atU, atV} or null if degenerate.
function gapSupports(u, v) {
  if (u.p * v.q - u.q * v.p < 0) [u, v] = [v, u];   // orient det(u,v)=+1
  const xu = Math.abs(u.trace), xv = Math.abs(v.trace);
  const su = Math.sqrt(xu * xu - 4), sv = Math.sqrt(xv * xv - 4);
  if (!(su > 0) || !(sv > 0)) return null;
  const disc = (xu * xv) ** 2 - 4 * (xu * xu + xv * xv);
  if (disc < 0) return null;
  const xm = (xu * xv + Math.sqrt(disc)) / 2;        // larger Fricke root
  const A = (xm - xv * (xu - su) / 2) / su;           // (xm − xv·e^{−ℓu/2})/√(xu²−4)
  const B = (xm - xu * (xv - sv) / 2) / sv;
  if (!(A > 0) || !(B > 0)) return null;
  const lu = 2 * Math.acosh(xu / 2), lv = 2 * Math.acosh(xv / 2);
  return {
    atU: covector(u, v, lu, 2 * Math.log(A)),         // λ_{u|v}
    atV: covector(u, v, 2 * Math.log(B), lv),         // λ_{v|u}
  };
}

// Outer polygon = ⋂ {wᵢ·X ≤ 1} = polar of conv{wᵢ}.
function outerPolygon(normals /* Vec2[] */) {
  const H = convexHull(normals);
  const poly = [];
  for (let i = 0; i < H.length; i++) {
    const a = H[i], b = H[(i + 1) % H.length];
    const det = a[0] * b[1] - b[0] * a[1];
    if (Math.abs(det) < 1e-12) continue;
    poly.push([(b[1] - a[1]) / det, (a[0] - b[0]) / det]);
  }
  return poly;
}
```

Driver: enumerate primitive directions out to radius `R` (with traces from the
Vieta recurrence), sort by angle so cyclically-consecutive entries are Farey
neighbours, call `gapSupports` on each consecutive pair, collect `atU, atV` (or
their per-corner average for *mid*), and feed them to `outerPolygon`.

## One-line summary

The McShane–Rivin ball corner at slope `u` has two exact supporting lines
`{λ·X=1}` fixed by `λ(u)=ℓu` and `λ(neighbour v)=2 ln A` with
`A=(x_m − xv·e^{−ℓu/2})/√(xu²−4)` and `x_m` the larger root of
`x² − xu·xv·x + (xu²+xv²)=0`; intersecting all such half-planes gives a rigorous
outer polygon (polar of the covector hull) whose area is an upper bound for the
ball volume at any cutoff.
