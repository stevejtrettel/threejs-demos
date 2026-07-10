# Three.js Math Demos

A personal framework and mathematics library for building interactive
mathematical-visualization demos in the browser, with [Three.js](https://threejs.org)
and TypeScript. Each *demo* is a small self-contained scene (`demos/<name>/main.ts`);
everything reusable — a rendering harness, a large typed math library, a UI
toolkit, shaders, and scene helpers — lives in `src/` and is shared across all of
them.

There are ~140 demos spanning differential geometry, algebraic geometry,
dynamical systems, general relativity, Teichmüller theory, and classical
mechanics.

---

## Quick start

```bash
npm install
npm run dev <demo-name>      # start the Vite dev server on one demo
```

For example:

```bash
npm run dev stable-norm-graph
npm run dev schwarzschild-lightcones
npm run dev hopf-torus
```

`npm run dev <name>` rewrites the `<script>` entry in `index.html` to point at
`demos/<name>/main.ts`, then launches Vite — so exactly one demo is served at a
time. Build a static, self-contained copy of a demo with:

```bash
npm run build <name>         # → dist/<name>/  (index.html + main.js, relative paths)
npm run preview <name>       # preview the built output
```

Each `dist/<name>/` is fully self-contained (relative asset paths), so it can be
dropped into a blog, an iframe, or any static host.

---

## Repository layout

```
demos/          one folder per visualization; entry point is demos/<name>/main.ts
  _shared/      math shared by a family of demos but not general enough for src/
src/            the reusable engine + math library (imported as @/…)
  app/          the App harness and its managers (render, camera, controls, …)
  math/         the typed mathematics library (see below)
  scene/        lights, materials, labels, helper objects
  ui/           control-room UI toolkit (panels, sliders, toggles, …)
  shaders/      shared GLSL + shader-material helpers
  utils/        colormaps, cubemap tools, misc
scripts/        run-demo.mjs (the dev/build driver) and offline render/export tools
docs/           architecture, guides, and design notes
dist/           built demos (git-ignored)
assets/  data/  static assets and precomputed datasets
```

Path aliases: `@/…` → `src/…` and `@assets/…` → `assets/…` (see `vite.config.ts`
and `tsconfig.json`).

---

## The math library (`src/math/`)

A typed, framework-independent library of the mathematics the demos draw. Highlights:

| area | contents |
|---|---|
| `algebra`, `algebraic-curves`, `cp2` | complex numbers, finite fields & extensions, projective plane, ℂP² moment maps / Veronese, complex algebraic-curve sampling |
| `lie` | matrix Lie groups (SO(2/3), SE(2/3), SL(2,ℝ/ℂ), SU(2), SU(1,1)), exp/factorizations (Iwasawa/polar), rigid-body & Lie–Poisson dynamics, Möbius |
| `manifolds`, `surfaces`, `patchcurves` | metrics, Christoffel symbols, parallel transport; parametric/metric/numeric surfaces; curves-on-surfaces, streamlines, flow tubes |
| `geodesics`, `relativity` | geodesic integrators; Schwarzschild & Majumdar–Papapetrou spacetimes, optical metrics, null geodesics, light cones, funnels |
| `linear-algebra`, `ode`, `geometry` | matrices, eigensym, LU/Cholesky/RREF/nullspace; ODE steppers & Poincaré maps; convex hull, marching squares, polygon area |
| `lattices` | 2-D lattices, Eisenstein integers, Weierstrass ℘, theta functions, fundamental domains, invariants |
| `hopf`, `sine-gordon`, `symplectic`, `forms` | Hopf fibration/tori; sine-Gordon surfaces (Breather/Kuen/pseudosphere via Goursat); Poisson/symplectic gradients; differential forms (d, ∧, ι, Hodge) |
| `mesh`, `linkages`, `weave`, `vectorfields` | half-edge meshes with spring energies & relaxation, OBJ I/O; planar linkages; weave/strand generation; vector fields, arrows, flow integration |

Many subpackages carry their own `README.md`. Design conventions are in
[`docs/math-type-design.md`](docs/math-type-design.md).

---

## The demo framework (`src/app/`)

Demos are built on the `App` class, which wires up a Three.js renderer, scene,
camera, and orbit controls, plus a set of managers (render loop, camera, controls,
layout, parameters, export/screenshot, timeline). A minimal demo:

```ts
import { App } from '@/app/App';
import * as THREE from 'three';

const app = new App({ antialias: true });
app.scene.add(new THREE.Mesh(/* … */));
app.start();
```

Common building blocks used across demos:

- **`SurfaceMesh` / `buildGeometry`** (`@/math`) — turn a parametric/numeric
  `Surface` into geometry, with per-vertex masking and optional custom fragment
  shaders (via [`three-custom-shader-material`](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial)).
- **`@/ui`** — a small control-room toolkit (panels, sliders, toggles, buttons)
  for interactive parameters; many demos instead roll a lightweight HTML control
  bar inline.
- **`@/scene`** — lights, materials, labels, and helper objects.
- Some demos support offline high-quality rendering via
  [`three-gpu-pathtracer`](https://github.com/gkjohnson/three-gpu-pathtracer).

### Writing a demo

1. Create `demos/<name>/main.ts` and build a scene (usually with `App`).
2. `npm run dev <name>`.
3. Math that is specific to one demo lives in its folder; math shared by a
   *family* of demos (but not general enough for `src/`) goes in `demos/_shared/`.
   **Demos never import from one another** — shared code goes through `_shared/`.

---

## Demo families

A non-exhaustive tour:

- **Oscillators** (`oscillator-*`) — linear/quadratic/Duffing driven oscillators:
  motion, transients, steady state, absorption/phase-lag, coupled systems,
  diagonalization, phase portraits.
- **General relativity** (`schwarzschild-*`, `mp-*`, `bh-*`) — Schwarzschild
  geodesics, light cones (incl. Eddington–Finkelstein), optical metric, funnels;
  Majumdar–Papapetrou two-black-hole optics.
- **Geometry & topology** — Hopf fibration/tori, Boys surface, Klein bottle,
  pseudospheres, sine-Gordon surfaces (breather/Kuen), Möbius/ℍ², modular tiling,
  triangle tilings, Poincaré disk.
- **Algebraic geometry** — cubic/Veronese surfaces, elliptic & hyperelliptic
  curves, curves in ℂP², finite-field pictures (𝔽₂₅, 𝔽ₚ, ζ₁₃).
- **Mechanics & dynamics** — pendula/n-pendulum, spinning top, Dzhanibekov,
  rolling ball, Kepler, Hénon–Heiles, tumbling flight, lattice flows.
- **Mesh & linkages** — spring-relaxed mesh embeddings, planar linkages and their
  curvature/geodesics, translation-surface flow/fold/refine/relax, weaves.
- **Markoff / stable norm** — the featured project below.

---

## Featured: the Markoff / stable-norm project

`stable-norm-*` and `markoff-*` visualize the **Teichmüller/moduli space of the
once-punctured hyperbolic torus** — the Markoff cubic `x²+y²+z²=xyz` — and the
**stable-norm unit-ball volume** `V` as a function on it, toward a
computer-assisted proof that the hexagonal (modular) torus minimizes `V`.

- `stable-norm-points` / `-inner` / `-outer` — boundary samples of the stable-norm
  ball, and its inner (convex-hull, lower bound) and outer (support-line, upper
  bound) approximations.
- `stable-norm-teichmuller` — the `(1,1,1)⊥` chart of the character variety next
  to the live norm ball.
- `stable-norm-graph` — the volume landscape over moduli space, coloured by height
  with one fundamental domain outlined.
- `stable-norm-cusp-graph` / `-cusp-cutoff` — the volume up the cusp, and the 3-D
  exclusion picture (lower-bound surface cut by the modular-torus upper-bound plane).
- `markoff-contraction`, `markoff-support-*`, `markoff-volume-*` — supporting
  experiments (area-contraction ratios, Farey/support lines, tiled landscapes).

The underlying mathematics is written up in `docs/notes/`:
`markoff-chart-parameterization.md` (the ℝ² → surface chart),
`stable-norm-extremal-supports.md` (closed-form support lines), and
`stable-norm-volume-minimization.md` (the proof strategy).

---

## Documentation

See [`docs/`](docs/) — architecture, the getting-started guide, math-type-design
notes, UI-system notes, and historical planning. Research notes for the
mathematics behind specific demos are in `docs/notes/`.
