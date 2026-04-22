# Symplectic geometry and Hamiltonian mechanics

A symplectic manifold is an even-dimensional manifold `(M, ω)` equipped with a closed, non-degenerate 2-form. The dynamics of Hamiltonian mechanics are the flow of the Hamiltonian vector field `X_H` defined by `ι_{X_H} ω = dH`, which on the canonical cotangent bundle reproduces Hamilton's equations.

## What's here

| File | What |
|---|---|
| `types.ts` | `SymplecticManifold` interface (dim, bounds, `symplecticForm: TwoForm`) |
| `CotangentBundle.ts` | `cotangentBundle(M)` — builds `T*M` from a `Manifold` with the canonical `ω = Σ dq^i ∧ dp_i` |
| `SymplecticGradient.ts` | `SymplecticGradient` class — `X_H` satisfying `ι_{X_H} ω = dH` |

## `SymplecticManifold` does not extend `Manifold`

Symplectic and Riemannian are orthogonal structures. A symplectic manifold has a 2-form but no canonical metric; a Riemannian manifold has a metric but no canonical symplectic form. We keep them as sibling interfaces so the type system reflects the math.

## Canonical cotangent bundle convention

Coordinates on `T*M` with `dim M = n` are laid out as `[q^1, …, q^n, p_1, …, p_n]` — position half followed by momentum half. The symplectic form in that basis is

```
ω = [  0    I_n ]
    [ -I_n   0  ]
```

— i.e. `ω_{i, n+i} = +1`, `ω_{n+i, i} = −1`, all else zero. This is constant over the bundle, so the `Matrix` is built once in `cotangentBundle(M)` and reused on every evaluation.

Momenta have unbounded domain (`±∞`); position bounds inherit from `M.getDomainBounds()`.

## Symplectic gradient of a Hamiltonian

The symplectic gradient `X_H` of a scalar `H` on `(M, ω)` is the unique vector field with `ι_{X_H} ω = dH`. It's the symplectic analogue of the Riemannian gradient — raise the index on `dH` using the 2-form's inverse instead of the metric's inverse:

```
X_H = −ω^{-1} · dH
```

On canonical `T*M` this specializes to Hamilton's equations

```
q̇^i = ∂H/∂p_i,    ṗ_i = −∂H/∂q^i.
```

## Integration

`SymplecticGradient` implements `VectorField`, so it plugs into the generic n-D integrator infrastructure. For a 2D phase space (one DOF) it can use `FlowIntegrator` directly; for 2n-D with n > 1, use `math/ode/integrate` (which is n-D).

## Sanity checks that should hold

- Pendulum `H = p²/2 − cos q`: `X_H(q, p) = (p, −sin q)`.
- Energy conservation: integrating `X_H` with RK4 keeps `H` constant to O(h⁴).
- Geodesic flow via Hamiltonian: `H = ½ g^{ij}(q) p_i p_j` on `T*M` reproduces geodesics of `M`.

## Out of scope for now

- General symplectic manifolds that aren't cotangent bundles (e.g. symplectic quotients, coadjoint orbits).
- Symplectic integrators (Verlet, Yoshida) — current RK4 is energy-drifting. Add when drift becomes visible.
- Poisson brackets and Poisson manifolds.
- Contact geometry.
