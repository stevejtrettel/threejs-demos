# Sp(6,ℤ) — limit-set super-demo

A unified viewer for all six BDN (Bajpai–Dona–Nitsche) hypergeometric monodromy
examples currently in the collection: **A-1, A-15, C-2, C-32, C-47, C-55**.
Replaces the six per-example demos for interactive use; those stay as
self-contained read-only references.

```bash
npm run dev sp6-limit-sets
```

## What's in here

The demo is split across five files, each with a narrow responsibility:

| File | Responsibility |
| --- | --- |
| [`examples.ts`](./examples.ts) | All example data (`coefflistf`, `coefflistg`, γ word, iter count); `deriveBC` / `deriveTCol` helpers. |
| [`orbit.ts`](./orbit.ts) | `GroupAction` (closure over an example's $B_C, T_{\text{COL}}, \gamma$), proximal-basepoint power iteration, non-backtracking BFS. |
| [`projection.ts`](./projection.ts) | `Projection` type, `Vec6`, 6×6 Jacobi eigensolver, chart-/chart-PCA-/auto-chart fitters, instance attribute packing. |
| [`render.ts`](./render.ts) | Shaders, material factory, instanced mesh build, percentile-bbox autofit camera. |
| [`validate.ts`](./validate.ts) | Startup checks: structural (palindromic, integer) + dynamical (power iteration converges, optional $|\lambda_{\max}|$ check). |
| [`main.ts`](./main.ts) | State, HUD, event handlers. Wires everything together. |

## UI

- **example** — dropdown of all six. Switching resets depth to 12, refits
  the projection on the new orbit, and autofits the camera.
- **depth N** — slider. Re-runs BFS but **preserves camera and projection**;
  scroll through depths to see the cloud densify without losing your view.
- **ball radius** — sphere size.
- **chart** — single dropdown selecting either:
  - $v_k$ **chart (PCA axes)** for $k = 1 \ldots 6$: the denominator is the
    coordinate axis $v_k$; the 3 projection rows are picked by PCA on the
    centered affine cloud inside that chart.
  - **auto-chart (overall PCA)**: both the chart denominator and the 3
    projection rows come from one eigendecomposition of $M = \tfrac{1}{n}\sum_i v_i v_i^\top$
    on $S^5$ ($d = v_1$, rows $= v_2, v_3, v_4$).
- **reset** — back to $v_1$ chart, depth → 12, autofit.
- **screenshot** — `sp6-<id>_<projection-label>_<kept>pts_<timestamp>.png`.

## Adding a new example

Append one entry to `EXAMPLES` in [`examples.ts`](./examples.ts):

```ts
{
  id: 'c91',
  label: 'C-91',
  nature: 'open',
  coefflistf: [1, ..., 1],     // palindromic, length 7
  coefflistg: [1, ..., 1],     // palindromic, length 7
  gamma: [2, 0, 2],            // loxodromic word in {0=B,1=B⁻¹,2=T,3=T⁻¹}
  gammaName: 'TBT',
  powerIter: 30,
  alpha: '...',
  beta:  '...',
  expectedLambdaMax: 9.42,     // optional, BDN's reported |λ_max|
},
```

`B_C` and `T_COL` are derived. Startup validation throws if anything is
mistyped; warns if the loxodromic word fails to converge or $|\lambda_{\max}|$
disagrees with the BDN value.

## Math note

Projection convention is

$$\pi(v) \;=\; (R \cdot v) \,/\, (d \cdot v) \;\in\; \mathbb{R}^3$$

with $R \in \mathbb{R}^{3 \times 6}$ and $d \in \mathbb{R}^6$. The auto-chart
mode uses $d = v_1$, $R = (v_2, v_3, v_4)$ where $v_1, \ldots, v_6$ are
eigenvectors of $M = \frac{1}{n} \sum_i v_i v_i^\top$ ordered by descending
eigenvalue. The same eigendecomposition gives both the chart and the
projection axes — they're automatically orthonormal because $M$ is symmetric.
