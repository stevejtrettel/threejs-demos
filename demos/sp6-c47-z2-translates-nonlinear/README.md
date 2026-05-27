# Sp(6,ℤ) — C-47 Z²-translates · `weirdfun` (nonlinear chart)

Direct port of the cells in [`c47 in sp6r (1).nb`](../../c47%20in%20sp6r%20%281%29.nb)
leading to `ListPointPlot3D[Map[weirdfun, morepointsinR3]]` (In[120]).

## What it draws

Three constructions stacked together:

1. **Seed orbit** ($64$ points): all length-$6$ forward words in $\{B, T\}$ (no
   inverses) applied to the proximal eigenvector $\xi_+(\gamma)$ for
   $\gamma = T \cdot B \cdot T$. Same as the notebook's `points`.
2. **Z²-translates**: a commuting pair $X_1 = T$, $X_2 = W T W^{-1}$ from the
   witness word $W$ given in the notebook. We exhaustively apply all $441$
   matrices $X_1^m X_2^n$ for $(m, n) \in [-10, 10]^2$ to each of the $64$ seed
   points. Same as the notebook's `morepoints`.
3. **Nonlinear chart**: project to $\mathbb{R}^3$ via the standard chart
   $\pi(v) = (v_2, v_3, v_4)/v_1$, then apply (extended) `weirdfun`:

$$\psi(x, y, z) \;=\; \Bigl(\log(x + 1),\; \log(y) + 1,\; \mathrm{sgn}(z) \cdot \log(|z| + 1)\Bigr).$$

The notebook leaves $z$ raw; we signed-log $z$ as well so the cloud doesn't
get stretched into a needle when $z$ takes large values. (If the c47 Float64
collapse is as severe as c55's, $z$ may end up tight anyway; we'll see.)

Result: a 2D fan structure — $64$ seed clusters, each smeared along the
Z²-lattice direction by the $(m, n)$ grid.

## The math, condensed

The construction's correctness hinges on **$[X_1, X_2] = 0$** (verified
exact-integer at load via BigInt). Given commutativity and the fact that each
$X_i = I + N_i$ with $N_i^2 = 0$, we get

$$X_1^m X_2^n \;=\; I + m N_1 + n N_2 + mn\, N_1 N_2.$$

For commuting transvections one further shows $N_1 N_2 = 0$, so the action on
any seed point $\xi$ is just $\xi + m N_1 \xi + n N_2 \xi$ — an affine $\mathbb{Z}^2$
orbit in $\mathbb{R}^6$.

## Conventions

The notebook uses **lowercase = matrix, uppercase = inverse** for the witness
string (so `b = BB`, `B = Inverse[BB]`). This demo uses the opposite
convention to stay consistent with [`sp6-c55-z2-translates`](../sp6-c55-z2-translates/).
The notebook string is stored verbatim as `W_STR_NOTEBOOK` and case-swapped
at load via `swapCase`, so the source of truth is the exact string from the
notebook (`c47 in sp6r (1).nb`, line 2357).

## No autofit

Camera is fixed at $(6, 6, 6)$ looking at the origin. Use the mouse to orbit
and zoom. The reason: when the projection formula lives only in the vertex
shader (GPU), there's no CPU-side autofit logic that has to keep its
projection in sync. One formula, one place.

## Comparison with the limit-set demos

| | [sp6-limit-set-c47](../sp6-limit-set-c47/) | this demo |
| --- | --- | --- |
| what's drawn | $\Lambda$ (BFS sample, ~$10^6$ pts) | Z²-translates of 64 seeds |
| orbit alphabet | $\{B, B^{-1}, T, T^{-1}\}$ | $\{B, T\}$ forward; then $X_1^m X_2^n$ |
| chart | $\pi$ (linear) | $\psi$ (log) |
| matches notebook | no (different construction) | yes (cells up to In[120]) |

The naive limit-set demo gives a faithful sample of $\Lambda \subset \mathbb{RP}^5$;
this demo gives the notebook's specific image, which is a constrained orbit
(not $\Lambda$) under a log chart.

## File

[`main.ts`](./main.ts). Console output walks through Steps 1–11 with sanity
checks (companion-inverse, commutativity, $\|\lambda_{\max}(\gamma)\|$).

## Running

```bash
npm run dev sp6-c47-z2-translates-nonlinear
```
