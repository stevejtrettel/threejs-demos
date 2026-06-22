# Schwarzschild optical metric & its funnel (surface of revolution)

Spec for implementing the optical (Fermat) geometry of a single Schwarzschild
black hole and the surface of revolution that isometrically embeds it.

Geometric units `G = c = 1`. Mass `M` sets the scale: horizon at `r = 2M`,
photon sphere at `r = 3M`.

## 1. Schwarzschild metric (equatorial plane)

The equatorial slice `θ = π/2` is totally geodesic, so it is an exact 2+1
spacetime on its own:

```
ds² = −f(r) dt² + f(r)⁻¹ dr² + r² dφ²,        f(r) = 1 − 2M/r.
```

## 2. Optical (Fermat) metric

For a static metric `ds² = −N² dt² + h_ij dxⁱdxʲ`, null geodesics project to
geodesics of the **optical metric** `h_ij / N²`, and the coordinate time a light
ray takes equals optical arc length (Fermat's principle). Here `N² = f`, so on
the spatial plane:

```
dℓ²_opt = f⁻² dr² + (r²/f) dφ²
        = (1 − 2M/r)⁻² dr²  +  r²/(1 − 2M/r) dφ².
```

This is a rotationally-symmetric 2D Riemannian metric. Its geodesics are the
spatial paths of light rays bending around the hole. The horizon `r = 2M` sits
at **infinite optical distance** (the `dr` integral diverges), so light
"freezes" approaching it.

Write it as `dℓ²_opt = A(r) dr² + B(r) dφ²` with

```
A(r) = (1 − 2M/r)⁻²,        B(r) = r²/(1 − 2M/r).
```

## 3. Surface of revolution

A rotationally-symmetric metric `A(r) dr² + B(r) dφ²` embeds in ℝ³ as a surface
of revolution about the `z`-axis,

```
X(r, φ) = ( ρ(r) cos φ,  ρ(r) sin φ,  z(r) ),
```

provided we can match both components.

**Circumferential radius** (from the `dφ²` term, `ρ = √B`):

```
ρ(r) = r / √(1 − 2M/r).
```

`ρ` has a minimum at the **photon sphere** `r = 3M`, where `ρ = 3√3 · M ≈ 5.196 M`
— the neck of the funnel.

**Height** (from the `dr²` term: the meridian must have squared speed `A`, so
`ρ′² + z′² = A`):

```
z′(r) = √( A(r) − ρ′(r)² ).
```

Both `ρ′` and the radicand have closed forms. With `f = 1 − 2M/r`:

```
ρ′(r) = (1 − 3M/r) / (1 − 2M/r)^{3/2}

z′(r)² = A − ρ′²
       = [ (M/r)(4 − 9M/r) ] / (1 − 2M/r)³
z′(r)  = √( (M/r)(4 − 9M/r) ) / (1 − 2M/r)^{3/2}.
```

**Embeddable region.** `z′` is real only where the numerator is non-negative,
`4 − 9M/r ≥ 0`:

```
r ≥ 9M/4 = 2.25 M.
```

So the funnel embeds from `r = ∞` (asymptotically flat, `z′ → 0`) inward to
`r = 9M/4`, necking down at the photon sphere `r = 3M` along the way. Below
`9M/4` (still outside the horizon `2M`) the surface of revolution **cannot**
embed the metric — draw only `r ∈ [9M/4, r_max]`. This is the "portion that
embeds."

## 4. Building it

Pick an outer rim `r_max` (e.g. `12M`). Then:

1. `ρ(r) = r / √(1 − 2M/r)` directly.
2. `z(r)` by integrating `z′(r)` inward from the rim (no elementary closed
   form): `z(r_max) = 0`, and `z(r) = −∫_r^{r_max} z′(r′) dr′` (sign chosen so
   the funnel descends inward). Use the closed form for `z′` above; a simple
   trapezoid/RK pass over a few hundred samples is plenty.
3. Mesh: revolve the profile `(ρ(r), z(r))` over `φ ∈ [0, 2π)`, with
   `r ∈ [9M/4, r_max]` (clamp the lower end slightly above `9M/4`, e.g.
   `2.26 M`, since `z′ = 0` exactly at the boundary).

To draw light rays on the funnel: integrate geodesics of `dℓ²_opt` in the plane
(in Cartesian `(x, y)` with `r = √(x²+y²)` to avoid the polar axis), then lift
each point `(x, y)` to the surface via `r = √(x²+y²)`, `φ = atan2(y, x)`,
`(ρ(r) cos φ, ρ(r) sin φ, z(r))`.

## 5. Cartesian form of the optical metric (for geodesic integration)

In Cartesian spatial coordinates `(x, y)`, `r = √(x²+y²)`, the optical metric
tensor is the spatial metric divided by `f`. With `A = (1−2M/r)⁻¹` for the
radial stretch of the *spatial* metric, the optical components are

```
h^opt_xx = [ A·x²/r² + y²/r² ] / f
h^opt_yy = [ A·y²/r² + x²/r² ] / f
h^opt_xy = [ (A − 1)·xy/r² ] / f          (f = 1 − 2M/r,  A = 1/f)
```

i.e. radial direction stretched by `A/f = f⁻²`, angular by `1/f` — matching
`A(r)`, `B(r)/r²` above. Geodesics of this metric are the light paths; lift them
to the funnel as in §4.
