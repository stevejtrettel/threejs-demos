# Minimizing the stable-norm volume on the once-punctured torus

A research note: the object, the conjecture, the structure we have established
numerically, and a concrete plan for a computer-assisted proof. The supporting
code lives in `demos/_shared/` (pure math) and the `demos/markoff-*` demos
(visualization / measurement).

---

## 1. The object

A complete hyperbolic structure on the once-punctured torus `T` is recorded by
the trace triple `(x, y, z) = (tr A, tr B, tr AB)` of a generating pair, lying on
the **Markoff cubic**

```
x² + y² + z² = x y z          (the cusp condition  tr[A,B] = −2).
```

Teichmüller space is the component through the modular torus `(3,3,3)`; moduli
space is that component modulo the mapping class group (MCG).

Every primitive homology class `(p, q) ∈ H₁(T;ℤ) ≅ ℤ²` is realized by a unique
simple closed geodesic. Its trace propagates from the generators by the **Vieta /
Markoff recurrence** along the Farey tree,

```
t(u + v) = t(u) · t(v) − t(u − v),
```

and its hyperbolic length is `ℓ(p,q) = 2·arccosh(|t(p,q)| / 2)`. For a primitive
class this length is its **stable norm** `‖(p,q)‖`.

### The functional

The stable norm is a centrally symmetric norm on `H₁(T;ℝ) ≅ ℝ²`; its unit ball is
the convex body `B = conv{ ±(p,q)/ℓ(p,q) }`. We study its **area**,

```
V(structure) = area(B).
```

Numerically we use the inner estimate `V_R` = area of the hull of curves with
`|(p,q)| ≤ R`. Code: `demos/_shared/markoff.ts` (recurrence), `stableNorm.ts`
(samples → hull → area), `markoffChart.ts` (the `(a,b)` chart below).

### A symmetric chart

Projecting the Teichmüller sheet orthogonally to the `(1,1,1)` axis gives a chart
`(a,b)` in which the modular torus is the origin and the `S₃` trace symmetry
becomes the `D₃` (hexagonal) symmetry of the plane. `liftToTriple(a,b)` inverts
it (solve a depressed cubic, take the Teichmüller root). This chart is for
visualization; for rigor one would instead use `(x,y)` with `z` the explicit
minus-root of the cubic (cleaner for interval arithmetic).

---

## 2. The theorem to prove

> **Conjecture.** The hexagonal (modular) torus `(3,3,3)` is the strict global
> minimum of `V` on moduli space:  `V(σ) > V(hex)` for every `σ` not in the hex
> MCG-orbit, with `V(hex) ≈ 0.8918`.

This is the stable-norm-volume analogue of Schmutz Schaller's theorem that the
hexagonal torus maximizes the systole.

---

## 3. Structure established (numerically)

All of the following are measured in the demos; they constrain and enable the
proof.

| fact | value / statement |
|---|---|
| `V` is MCG-invariant | `V(g·σ) = V(σ)` exactly (area is `SL(2,ℤ)`-unimodular-invariant); verified e.g. `V(3,3,3) = V(3,3,6)` to machine precision |
| hexagonal torus | `V ≈ 0.8918`, the conjectured minimum |
| square torus `(2√2, 2√2, 4)` | `V ≈ 0.8945`, an **index-1 saddle** |
| cusp (trace → 2) | a curve pinches, `ℓ → 0`, `V → ∞` |
| Hessian at hex | `Hess V(hex) ≈ 0.0256 · I` — positive-definite and **isotropic** (forced by `D₃`), stable across `R` and step size |
| critical points | exactly hex (minima), square (saddles), cusp; **all on the mirror lines** |
| the unit ball | **strictly convex with a corner at every rational direction** — not a polygon, not smooth |
| bulge / tail | `V_R → V` faster than any power: the per-rational "sagitta" decays exponentially (`~8^{-|pq|}` on the spine, super-exponentially on noble paths) |

The Morse structure (minima at hex, saddles at square, peaks at cusps) is exactly
what the `markoff-volume` / `markoff-volume-tiled` demos display as a periodic
landscape.

---

## 4. Proof strategy

`V` is treated as a **black box**: the argument uses only two-sided analytic
bounds and never needs `V` itself to be differentiable. All regularity is
transferred onto the **lower bound `L_R`**, which is a finite analytic sum.

### 4.0 The bracket

For each cutoff `R`:

```
L_R(σ) = V_R(σ) = area of the inner hull        (≤ V, always)
U_R(σ) = L_R(σ) + τ_R(σ)                          (≥ V)
```

where `τ_R` bounds the outward **bulge** between the inscribed hull and the true
ball. Both `L_R` and `τ_R` are explicit and real-analytic in the structure, hence
interval-arithmetic-enclosable over a box.

### 4.1 Reduce to one fundamental domain (free)

By MCG-invariance it suffices to prove the theorem on one fundamental domain
`T` — the modular triangle with corners hex (order 3), square (order 2), cusp.
In the `(a,b)` chart this is the reduced region `{2x ≤ yz, 2y ≤ xz, 2z ≤ xy}`
intersected with one `60°` mirror-sector. (See §6 for why the *calculation* also
requires this domain, not just the *sufficiency*.)

### 4.2 Cusp horoball (compactness)

Near the cusp a short curve forces `V → ∞`, so an explicit horoball `H` has
`V > V(hex)` on it. Remove it, leaving the **compact** `K = T ∖ H`.

### 4.3 Inner disk at hex — via the Hessian of `L_R` (not of `V`)

`L_R` inherits the `D₃` symmetry, so `∇L_R(hex) = 0` exactly. Certify (interval
arithmetic on the explicit `L_R`) that `Hess L_R ⪰ λ_L · I` on a disk `D` around
hex, with `λ_L > 0`. Then

```
L_R(σ) ≥ L_R(hex) + ½ λ_L · r²,     r = |σ − hex|,   σ ∈ D.
```

### 4.4 The rest — branch-and-bound on values

Cover `K ∖ int(D)` by boxes; on each certify `L_R(box) > U_R(hex)`. Subdivide if
inconclusive; this **terminates** because off the hex disk `V − V(hex)` is bounded
below by a positive constant and `U_R − L_R` is exponentially small. The square
saddles (`V ≈ 0.8945`) sit here and pass with room to spare.

### 4.5 Assembly

- Outside `D` (and `H`): `V(σ) ≥ L_R(σ) > U_R(hex) ≥ V(hex)`.  ✓
- Inside `D`, chaining §4.3 against `U_R(hex) = L_R(hex) + τ_R(hex)`:

  ```
  V(σ) ≥ L_R(σ) ≥ L_R(hex) + ½ λ_L r²  >  L_R(hex) + τ_R(hex) = U_R(hex) ≥ V(hex),
  ```

  valid for `r > r_R := √(2 τ_R(hex)/λ_L)`. Since `τ_R → 0` while `λ_L` stays
  bounded below, `r_R → 0`; so for **every** `σ ∈ D ∖ {hex}`, a large-enough `R`
  gives `V(σ) > V(hex)`.  ✓
- In `H`: §4.2.  ✓

Together: `V(σ) > V(hex)` for all `σ ∈ T ∖ {hex}`, hence (with §4.1) the theorem.
∎ (modulo the lemmas below).

**The point:** `V`'s differentiability is never used. The curvature that defeats
the shallow well is the curvature of `L_R`, which provably exists because `L_R` is
a finite analytic sum. (If one *wants* `V ∈ C²`, it follows separately from
`C²`-convergence of the `L_R`, i.e. a derivative-tail bound — but it is not part
of this argument.)

---

## 5. The load-bearing lemma: the contraction ratio `q`

Everything in §4.0 rests on bounding `τ_R`. This is the one genuinely new
estimate.

### Definition

Refining the inscribed hull inserts, at each Farey mediant `m` (between Farey
neighbours `L, R`), one triangle of area `t(m) = area(P_L, P_m, P_R)`, where
`P = (p,q)/ℓ`. Its two children are `mL = L+m`, `mR = m+R`. Define the
**area-contraction ratio**

```
q(m) = ( t(mL) + t(mR) ) / t(m).
```

### Why it is the right quantity

- It is an *area*, and `V` is an area, so it is exactly the quantity summing to
  the tail (no conversion through sagitta heights).
- It packages the binary branching of the Farey tree into one scalar: the sharp
  convergence condition for a binary tree is the **combined** child ratio `< 1`.

### Consequence

If `q(m) ≤ q* < 1` for all nodes, the subtree area below any node satisfies
`S(m) ≤ t(m)/(1−q*)`, so

```
τ_R = Σ_{|m|>R} t(m) ≤ (1/(1−q*)) · (one marginal generation) ≤ C · (q*)^{depth}.
```

The infinite, branching bulge collapses to a geometric series controlled by one
number.

### What is measured (`demos/markoff-contraction`)

Over the fundamental domain `K`:

- `q ≈ 0.18` at the hexagonal corner, `≈ 0.14` at the square corner;
- rising monotonically toward the cusp: `≈ 0.57` at systole trace `2.1`, `≈ 0.81`
  at `2.04`, `≈ 0.88` at `2.01`;
- **`sup_K q < 1` with margin** (`≈ 0.7–0.8` on the horoball-excised domain),
  approaching `1` only as systole `→ 2` (the cusp, removed by `H`).

Outside the fundamental domain `q > 1` — see §6.

---

## 6. Why only one fundamental domain

Two linked reasons:

1. **Sufficiency.** `V` is MCG-invariant, so one fundamental domain is a complete
   copy of moduli space; proving the bound there proves it everywhere.

2. **Well-conditioning.** The Farey enumeration starts from the *fixed* marking
   `(1,0), (0,1), (1,1)`. The reduced condition is exactly the statement that
   these generators are the **systoles**. Then Farey-order ≈ length-order: the
   farthest ball points (systoles) are added first, the starting triangle already
   outlines the ball, and each refinement adds a smaller triangle — `q < 1`. At a
   non-reduced structure the true systole is a *deep* Farey descendant, so the
   inscribed hull lags the ball and the early refinements *grow* — `q > 1`.

> The fundamental domain is precisely the set of structures for which the standard
> marking is **systole-reduced** — which is also one tile of moduli space.

So Markoff reduction (folding a far structure back) is exactly **re-marking** so
the systoles are the generators again — carrying you into the domain where the
fixed enumeration is well-conditioned.

---

## 7. Rigorous-numerics plan

1. **Coordinates.** Parametrize `T` by `(x,y)` with `z` the explicit minus-root
   of the cubic — trivial to interval-enclose.
2. **Interval-arithmetic stack.** Vieta recurrence → trace enclosures; `arccosh`
   → length enclosures; ball points become small boxes; shoelace → `L_R` and its
   derivatives, all in interval arithmetic. Standard tooling (INTLAB / Arb /
   `IntervalArithmetic.jl`).
3. **Tail bound.** Certify `q* < 1` on `K` (§5/§8), giving
   `τ_R ≤ C·(q*)^{depth}`, hence the certified bracket `L_R ≤ V ≤ L_R + τ_R`.
4. **Inner disk.** Interval-Hessian of `L_R` over `D` ⪰ `λ_L I > 0`.
5. **Branch-and-bound.** Certify `L_R(box) > U_R(hex)` over `K ∖ D` (with the
   horoball excised).
6. **Assemble** as in §4.5.

For full formality the IA could be carried out in a proof assistant (Lean/Coq with
interval tactics); a trusted-library computer-assisted proof is the pragmatic
first target.

---

## 8. The open piece (the crux), with fallbacks

The bulk (§7 steps 1, 2, 4, 5, 6) is standard CAP engineering — real work, no
conceptual gap. The risk concentrates in **one lemma**:

> **Contraction lemma (to prove).** `sup_{σ ∈ K, all Farey depths} q ≤ q* < 1.`

A finite scan (depth ≲ 16) *cannot* close this: the depth profile creeps toward
an asymptote, and that asymptote must be certified `< 1`. This needs a genuine
**renormalization / self-similarity** argument, not just interval arithmetic over
a box. It is plausible — every measured asymptote sat well under 1 — but it is
where the project could stall.

Fallback routes if the direct argument is hard:

- a **`k`-step contraction** (bound the area `k` levels below each node; the
  multi-step ratio recovers even where the 1-step ratio briefly exceeds 1);
- bound the **spectral radius of the renormalization operator** governing the
  deep tree (its cusp-limit fixed point);
- import **known regularity of strictly-convex stable-norm balls**
  (Massart-type results) to supply the geometric decay off the shelf.

---

## 9. Feasibility verdict

A well-posed computer-assisted proof, of the flavor that has succeeded for
neighbouring problems (systole extremizers, optimal packings). Every measured
quantity points the right way *with margin*: `q* ≈ 0.7–0.8 < 1`, Hessian
`0.0256·I > 0` robustly, the danger zone `q>1` strictly outside `K`, the shallow
well handled analytically by the `L_R`-Hessian rather than by brute refinement.

Not a slam dunk — the all-depths contraction (§8) is the gate, and it needs an
idea, not just code. But the risk is identified and fenced, and there are three
independent fallbacks. **Worth attempting**, and the first thing to attack is §8.

---

## 10. Supporting code

| path | role |
|---|---|
| `demos/_shared/markoff.ts` | Vieta recurrence, slopes, lengths |
| `demos/_shared/markoffChart.ts` | the `(1,1,1)`-orthogonal chart and its inverse (lift) |
| `demos/_shared/stableNorm.ts` | ball samples → convex hull → area (`V_R`) |
| `demos/_shared/markoffSymmetry.ts` | orbits, reduced test, fundamental-domain test |
| `src/math/geometry/` | `convexHull`, `polygonArea`, `marchingSquares` (general tools) |
| `demos/markoff-surface` | interactive: a point of moduli space → its traces and norm ball |
| `demos/markoff-volume` | the volume surface + level sets over the symmetric chart |
| `demos/markoff-volume-tiled` | the same over a large window — the `SL(2,ℤ)` tiling |
| `demos/markoff-contraction` | the contraction ratio `q` over the fundamental domain (the feasibility instrument) |

---

## 11. First milestone

Make the contraction lemma's constant explicit and the renormalization argument
concrete:

1. Measure the **asymptotic** `q` (depth → ∞) over `K` rigorously enough to
   conjecture the renormalization fixed point and its rate.
2. Attempt the **`k`-step contraction** as the path of least resistance to a
   certifiable `q* < 1` uniform on `K`.
3. In parallel, derive the explicit tail constant `C` and the horoball size from
   `q*`, so `τ_R ≤ C·(q*)^{depth}` is a stated, citable bound.

If step 2 closes, the remaining work is interval-arithmetic engineering and a
branch-and-bound sweep — and the result is a genuine theorem: *the hexagonal
once-punctured torus strictly minimizes the stable-norm volume.*
