# Lie groups — non-compact and generic-dim extensions

**Date:** 2026-04-23
**Status:** proposed, ready for greenlight
**Context:** Phases 1 and 2 of [`lie.md`](./lie.md) are done — `SO(2)`, `SO(3)`, `SU(2)`, `SE(2)`, `SE(3)` all shipped with closed-form everything, plus Padé generic exp, polar factorization, render glue, and the `stepBody` / `stepWorld` utility. Poisson primitives moved to `symplectic/`. This plan covers the next batch of matrix Lie groups: the **non-compact 2-D groups** (`SL(2,ℝ)`, `SL(2,ℂ)`) that unlock hyperbolic geometry and Möbius transformations, plus **higher-dim parameterized groups** (`SL(n,ℝ)`, `Sp(2n,ℝ)`, `SO(p,q)`) that round out the classical-groups story.

## What this plan adds

```
src/math/lie/groups/
  SL2R.ts        non-compact, 3-dim — closed form (trace-based dispatch)
  SL2C.ts        non-compact, 6-dim real — 4×4 real embedding, closed form
  SLn.ts         factory: SLn(n) → SL(n,ℝ) instance — Padé exp/log
  Spn.ts         factory: Spn(n) → Sp(2n,ℝ) instance — Padé exp/log
  SOpq.ts        factory: SOpq(p, q) → SO(p,q) instance — Padé exp/log

src/math/lie/
  factorizations/
    iwasawa.ts   `g = k·a·n` for SL(2,ℝ); closed form
    classify.ts  elliptic / parabolic / hyperbolic / loxodromic by trace
  mobius.ts      Möbius action helpers for SL(2,ℝ) on ℍ² and SL(2,ℂ) on Ĉ
  exp/
    padeLog.ts   generic matrix log — needed for higher-dim groups
```

## Goals, in priority order

1. **Hyperbolic geometry / Möbius demos.** Driven by `SL(2,ℝ)` and `SL(2,ℂ)`. This is the biggest single visual-territory expansion still on the table. Demos: animated Möbius on the upper half plane, animated Möbius on the Riemann sphere, `PSL(2,ℤ)` fundamental domain (connects to existing `lattices/`), Kleinian limit sets, hyperbolic tilings, geodesic flow on ℍ²/Γ.
2. **Lorentz / pseudo-orthogonal.** `SO(p,q)` — specifically `SO(1,3)` for special relativity boosts and `SO(1,2)` for the hyperboloid model of ℍ².
3. **Symplectic linear group.** `Sp(2n,ℝ)` for phase-space symmetries, the Maslov index, and connection to Siegel upper half space (which connects to existing elliptic-curve work).
4. **General `SL(n,ℝ)`.** Useful as a generic high-dim group; demos like polar-decomposition-on-larger-matrices.

## Design decisions

### 1. Two coding patterns: closed-form classes vs parameterized factories

`SL(2,ℝ)` and `SL(2,ℂ)` are 2×2 — small enough for closed-form `exp` / `log` via trace-based dispatch (the Cayley-Hamilton trick: a traceless 2×2 matrix `X` satisfies `X² = −det(X)·I`, so the matrix exponential collapses to a 2-term polynomial in `X`). They get singleton instances like the existing groups.

`SL(n,ℝ)`, `Sp(2n,ℝ)`, `SO(p,q)` need parameterization by dimension (`n` or `(p,q)`). They use generic Padé `exp` / `log` and ship as **factory functions** that return a `MatrixLieGroup` instance:

```ts
const SL3 = SLn(3);
const Sp4 = Spn(2);   // Sp(4, ℝ)
const SO13 = SOpq(1, 3);
```

Each factory builds the appropriate `hat` / `vee` and inherits the rest from `MatrixLieGroup`. No singleton; users instantiate per dim.

### 2. `SL(2,ℝ)` — closed-form via trace-based dispatch

Standard basis of `sl(2,ℝ)`:

```
H = [[1, 0], [0, −1]]    E = [[0, 1], [0, 0]]    F = [[0, 0], [1, 0]]
```

Bracket: `[H, E] = 2E`, `[H, F] = −2F`, `[E, F] = H`.

Convention: `hat([a, b, c]) = a·H + b·E + c·F`.

Closed-form `exp` on a traceless 2×2 `X`:

```
det X = ad − bc =: −d²    (so X² = d² · I, with d² possibly negative)
```

- If `d² > 0`  ("hyperbolic" regime): `exp(X) = cosh(d) · I + (sinh(d)/d) · X`
- If `d² < 0`  ("elliptic" regime, set `θ = √(−d²)`): `exp(X) = cos(θ) · I + (sin(θ)/θ) · X`
- If `d² = 0`  ("parabolic" regime): `exp(X) = I + X`
- Near `d² = 0`: Taylor (small-x case for both `sinh(d)/d` and `sin(θ)/θ` is `1 + …`).

Closed-form `log` on `g ∈ SL(2,ℝ)`: read off the regime from `tr(g)`:

- `|tr(g)| < 2`: elliptic, `g = exp(θ · ê)` with `θ = arccos(tr(g)/2)`
- `tr(g) = ±2`: parabolic
- `|tr(g)| > 2`: hyperbolic, `g = exp(d · ê)` with `d = arccosh(|tr(g)|/2)` and a sign

Multiply / inverse: standard `Matrix` ops (closed form for inverse: `[[d, −b], [−c, a]]`).

### 3. `SL(2,ℂ)` — 4×4 real embedding (mirrors `SU(2)` choice)

A complex 2×2 matrix has 8 real DOF; with `det = 1` the constraint imposes 2 real conditions, leaving 6 real DOF. Storage choice: **embed in `Matrix(4, 4)` real** with the block structure `α + βi ↔ [[α, −β], [β, α]]` for each complex entry. This is the same trick we considered for `SU(2)` and rejected (in favor of quaternions); for `SL(2,ℂ)` the 4×4 real embedding is the right call because:

- `SL(2,ℂ)` is non-compact and not isomorphic to a quaternion structure.
- Standard `Matrix.multiply` (4×4 real) correctly implements complex 2×2 multiplication under the embedding.
- No special arithmetic overrides needed.

`matrixSize = 4`, `dim = 6`. `hat: ℝ⁶ → 𝔰𝔩(2,ℂ) ⊂ ℂ^{2×2}` decomposes the 6 reals as three real generators (`H`, `E`, `F`) plus three imaginary copies (`iH`, `iE`, `iF`) — i.e. `sl(2,ℂ) = sl(2,ℝ) ⊗ ℂ`.

Closed-form `exp` follows the same Cayley-Hamilton trick as `SL(2,ℝ)` but with complex `d`: `exp(X) = cosh(d)·I + sinh(d)/d · X` for any traceless 2×2 (real or complex). The branch issue is in `cosh` / `sinh` of complex, which decompose to `cos(Im) + i sin(Im)` style identities. Implementable cleanly.

Möbius on the Riemann sphere `Ĉ`: `g · z = (a z + b) / (c z + d)`.

### 4. Generic Padé matrix `log`

Required for `SL(n,ℝ)`, `Sp(2n,ℝ)`, `SO(p,q)`. Algorithm (Higham, *Functions of Matrices*, ch. 11):

1. **Inverse scaling-and-squaring**: repeatedly take square roots `B ← √B` until `‖B − I‖_1 ≤ θ`.
2. **Padé log near identity**: `log(B) ≈ Σ c_k (B − I)^k` (rational approximant).
3. Return `2^s · log(B)` where `s` = number of square roots taken.

Matrix square root via **Denman-Beavers iteration**:

```
Y_0 = A,  Z_0 = I
Y_{k+1} = (Y_k + Z_k⁻¹) / 2
Z_{k+1} = (Z_k + Y_k⁻¹) / 2
```

Converges quadratically to `(√A, √A⁻¹)` for any `A` with no negative real eigenvalues. ~80 LOC.

Then `padeLog` is ~50 LOC composing sqrt + Taylor/Padé near identity.

**Promotion question**: with `padeLog` available, should `MatrixLieGroup.exp` and `MatrixLieGroup.log` become non-abstract with Padé defaults? Yes — but this is a small follow-on once `padeLog` lands. Concrete groups continue to override with closed forms where available (`SO(2)`, `SO(3)`, `SU(2)`, `SE(2)`, `SE(3)`, `SL(2,ℝ)`, `SL(2,ℂ)`); the generic factories just inherit the defaults.

### 5. Iwasawa decomposition for `SL(2,ℝ)` (closed form)

`g = k · a · n` with `k ∈ SO(2)`, `a` diagonal positive, `n` upper-unipotent. Computed by Gram-Schmidt on the columns of `g` — 1-step QR essentially.

Key insight: the Iwasawa coordinates `(x, y, θ)` of `g`, with `a = diag(√y, 1/√y)`, `n = [[1, x/y], [0, 1]]`, `k = R_θ`, **are exactly upper-half-plane coordinates** for `g · i = (x, y) ∈ ℍ²` plus a frame angle `θ`. This is what makes `ℍ² = SL(2,ℝ)/SO(2)` concrete.

`iwasawa(g) → { k, a, n }` plus optional `iwasawaCoords(g) → { x, y, theta }` for direct ℍ² use.

### 6. Element classification — module of free utilities

```ts
classifySL2(g): 'elliptic' | 'parabolic' | 'hyperbolic'
classifySL2C(g): 'elliptic' | 'parabolic' | 'hyperbolic' | 'loxodromic'
```

By trace. Free functions, not methods on the group classes — they're conceptual labels rather than algebraic operations.

### 7. `Sp(2n,ℝ)` — symplectic linear group

Standard symplectic form `J = [[0, I_n], [−I_n, 0]]` (we already use this convention in `cotangentBundle`). `g ∈ Sp(2n,ℝ)` iff `gᵀ J g = J`. Algebra: `X` Hamiltonian, `XᵀJ + JX = 0`.

Dim = `n(2n+1)`. Storage: standard `Matrix(2n, 2n)` real. `hat: ℝ^{n(2n+1)} → sp(2n,ℝ)` parametrizes the Hamiltonian-matrix space — a basis is straightforward to build explicitly.

`exp` / `log` via Padé. Factory: `Spn(n)` returns a `MatrixLieGroup` with these baked in.

### 8. `SO(p,q)` — pseudo-orthogonal

`g ∈ SO(p,q)` iff `gᵀ J_{p,q} g = J_{p,q}` with `J_{p,q} = diag(I_p, −I_q)`, `det g = +1`. Dim = `(p+q)(p+q−1)/2`. Most important specializations:

- `SO(1, n)`: hyperbolic motions. `SO(1,2)` acts on the hyperboloid model of `ℍ²`; `SO(1,3)` is the Lorentz group (proper orthochronous).

`hat: ℝ^{dim} → so(p,q)` parametrizes the antisymmetric-with-signature space. `exp` / `log` via Padé.

Factory: `SOpq(p, q)`.

### 9. `SL(n,ℝ)` — generic

Lowest-priority of the higher-dim groups (low direct visual payoff). Build mainly to round out the classical groups and have a generic n-dim consumer for `padeExp` / `padeLog`. Storage: `Matrix(n, n)` real with `det = 1`. Algebra: traceless n×n.

Factory: `SLn(n)`.

## What's intentionally NOT in this plan

- **`SU(n)` for `n > 2`.** `SU(2)` covers the rotation / quaternion / spinor stories; higher `SU(n)` is mostly representation theory with low visual payoff.
- **`SO(n)` for `n > 3`.** Same — we have `SO(2)` and `SO(3)`; higher `SO(n)` doesn't unlock new demo territory.
- **Exceptional groups** (`G_2`, `F_4`, `E_{6,7,8}`). Algebraic, no visualization payoff for this library.
- **Loop groups, diffeomorphism groups**, infinite-dim. Out of scope per `lie.md`.
- **Full representation theory** (Young tableaux, Clebsch-Gordan, character tables). Algebraic, low payoff.
- **Symmetric spaces (Phase 4 of `lie.md`)** — that's its own follow-on. Builds on this plan; not included here.

## Phased order

Each numbered phase is one session-sized chunk. Stop after any of them.

### Phase 3a — `SL(2,ℝ)` and supporting machinery (~350 LOC + 1–2 demos)

Smallest standalone piece that unlocks real demos.

- `groups/SL2R.ts` — group + closed-form `hat`/`vee`/`exp`/`log` (~200 LOC)
- `factorizations/iwasawa.ts` — Iwasawa for `SL(2,ℝ)` (~80 LOC)
- `factorizations/classify.ts` — element classification (~30 LOC)
- `mobius.ts` — Möbius action helpers (~40 LOC)
- Smoke tests covering all of the above
- Demo: animated Möbius on the upper half plane (`mobius-h2/`)

### Phase 3b — `SL(2,ℂ)` (~300 LOC + demo)

Builds on 3a's classification + Möbius pattern.

- `groups/SL2C.ts` — 4×4 real embedding, closed-form `hat`/`vee`/`exp`/`log` (~250 LOC)
- Extend `classify.ts` with `classifySL2C`
- Extend `mobius.ts` with Möbius on Ĉ
- Smoke tests
- Demo: animated Möbius on the Riemann sphere (`mobius-riemann/`)

### Phase 3c — `padeLog` utility + non-abstract `MatrixLieGroup.exp`/`log` (~150 LOC)

Pure infrastructure work, no new groups or demos. Required before Phase 4.

- `exp/padeLog.ts` — Denman-Beavers sqrt + Padé log (~120 LOC)
- Promote `MatrixLieGroup.exp` and `MatrixLieGroup.log` from abstract to having Padé defaults
- All existing groups continue to work (they override with closed forms)
- Smoke tests for Padé `log` on various inputs

### Phase 3d — first higher-dim factory: `SOpq` (~200 LOC + demo)

`SO(p,q)` is the most demo-relevant of the parameterized groups.

- `groups/SOpq.ts` — factory + smoke tests (~150 LOC)
- Demo: Lorentz boost composition (`lorentz-boost/`) using `SOpq(1, 3)`

Possible bonus demo: hyperboloid model of ℍ² using `SOpq(1, 2)`, comparing to the Poincaré-disk picture from later symmetric-spaces work.

### Phase 3e — `Spn` (~200 LOC, demo deferred)

Symplectic linear group. Build the factory + smoke tests; defer demos until a specific motivation comes up (the natural ones — Maslov index, symplectic reduction — wait on Phase 5 work).

### Phase 3f — `SLn` (~150 LOC, demo deferred)

Lowest-priority. Build the factory for completeness; demos optional (polar decomposition on `SL(3,ℝ)` matrices is the obvious one).

## Concrete demo payoffs

Per phase, the new demos this enables:

| Phase | Demo | What you see |
|---|---|---|
| 3a | Möbius on ℍ² | Drag a Möbius transformation; watch points and geodesics on the upper half plane transform |
| 3a | PSL(2,ℤ) fundamental domain | Modular surface tiling; Ford circles |
| 3a | Element classification explorer | Single `g ∈ SL(2,ℝ)`; slider for `tr(g)`; show the Möbius flow type |
| 3b | Möbius on Riemann sphere | Drag complex Möbius; classify by trace; show fixed points |
| 3b | Kleinian limit set | Iterate two `SL(2,ℂ)` generators; plot orbit closure (Indra's Pearls territory) |
| 3d | Lorentz boost composition | Two boosts; their composition isn't a boost (Wigner rotation); show the rotation |
| 3d | Hyperboloid model of ℍ² | Geodesics on the hyperboloid + comparison with Poincaré disk |

## Total scope

| Phase | LOC library | LOC demos | Sessions |
|---|---|---|---|
| 3a | ~350 | ~300 | 1–2 |
| 3b | ~300 | ~250 | 1 |
| 3c | ~150 | 0 | 1 |
| 3d | ~200 | ~250 | 1 |
| 3e | ~200 | 0 | 0.5 |
| 3f | ~150 | 0 | 0.5 |
| **Total** | **~1350** | **~800** | **~5–6 sessions** |

## Open design questions

1. **Factory return type.** Should `SLn(3)` return a `MatrixLieGroup` instance (current proposal) or a concrete subclass with extra methods? Concrete subclass would let it expose group-specific helpers (e.g. `Sp(2n,ℝ)` could expose `symplecticForm()`), but it complicates the API. Lean toward instance-only for now; add subclass methods if a demo asks.

2. **Constraint enforcement.** Should `Sp(2n,ℝ)` and `SO(p,q)` validate that input matrices satisfy their defining constraint (`gᵀJg = J`)? Probably **no** at construction time — too easy to fail by floating-point — but maybe a `verify(g)` debug helper that returns the constraint residual. Same question for `SL(n,ℝ)` (`det = 1`).

3. **Namespacing.** Should the factories be `SLn`, `Spn`, `SOpq` or `createSLn`, etc.? Lean toward the short names — they read like type constructors.

4. **`SL(2,ℝ) ≅ Sp(2,ℝ) ≅ SU(1,1) ≅ SO(2,1)°`.** All four are isomorphic Lie groups (low-dim coincidences). Should we expose this somehow? Probably not — just verify in smoke tests that our `SL2R` and `Spn(1)` produce equivalent results on the overlap.

5. **Hyperbolic-3-space and `SL(2,ℂ)`.** `SL(2,ℂ) / SU(2) ≅ ℍ³`. The natural "where does ℍ³ live" question puts hyperbolic 3-space firmly in symmetric-spaces (Phase 4) rather than here. Defer.

## Success criteria

- Each new group has a smoke test verifying group axioms, `exp(0) = I`, `log ∘ exp = id` on a sensible domain, `g · g⁻¹ = I`.
- `SL(2,ℝ)` and `SL(2,ℂ)` smoke tests verify the trace-based classifications match constructed-by-hand examples.
- Iwasawa decomposition reconstructs to the original `g` to ~1e-12.
- Padé `log` round-trips with `exp` to ~1e-10 for matrices in the convergence radius.
- For `SL2R` and `Spn(1)`, smoke test verifies they give equivalent results on a few inputs (low-dim isomorphism check).
- All Phase 3a demos run at 60 fps.

## What this plan defers

- **Phase 4: symmetric-spaces folder.** Once `SL(2,ℝ)` and `SL(2,ℂ)` ship, the natural symmetric-space constructions become available: ℍ² = SL(2,ℝ)/SO(2), ℍ³ = SL(2,ℂ)/SU(2). This is the *next* plan after this one.
- **Phase 5: moment maps + symplectic reduction.** Needs both `Sp(2n,ℝ)` (for explicit examples) and group-action infrastructure beyond what we have.
- **Phase 6: gauge theory.** 𝔤-valued forms, curvature 2-form `F = dA + A∧A`. Probably a small addition to `forms/` + `lie/` once `lie/` has the higher-dim groups.

These are *follow-on* plans, not blocked by anything in this plan beyond shipping the relevant group infrastructure.
