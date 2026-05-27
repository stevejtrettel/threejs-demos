# Sp(6,ℤ) demos — overview

A family of WebGL demos visualizing **proximal limit sets in $\mathrm{RP}^5$** for
hypergeometric monodromy subgroups of $\mathrm{Sp}(6, \mathbb{Z})$, following the examples
of Bajpai–Dona–Nitsche (BDN), *Thin monodromy in Sp(4) and Sp(6)*.

This document is the entry point for the whole sp6 collection — read this first to navigate
between demos, understand the shared math conventions, and pick up where things left off if
you're an LLM (or human) joining mid-stream.

## 1. The mathematical setup (one-paragraph version)

Each example in BDN is specified by two hypergeometric multisets
$\alpha, \beta \in \mathbb{Q}^6/\mathbb{Z}^6$ (rational numbers mod 1, length 6 each). They
define the *eigenvalue sets* of two matrices $A, B \in \mathrm{Sp}(6, \mathbb{Z})$:

$$f(x) = \prod_{j=1}^{6}\bigl(x - e^{2\pi i \alpha_j}\bigr), \qquad
  g(x) = \prod_{j=1}^{6}\bigl(x - e^{2\pi i \beta_j}\bigr).$$

Both $f, g$ have palindromic integer coefficients (this is the symplectic condition). Let
$A, B$ be their companion matrices; with $\det A = \det B = 1$ both are in
$\mathrm{SL}_6(\mathbb{Z}) \cap \mathrm{Sp}_6$. The **unipotent transvection** is

$$T \;:=\; A \cdot B^{-1} \;=\; I + c\, e_1^\top, \qquad c_i = \mathrm{coefflist}(f)_i - \mathrm{coefflist}(g)_i \text{ for } i = 1,\ldots,5.$$

(That closed form is verified by direct $6 \times 6$ matrix multiplication. $c_0 = 0$ always,
since $T_{1,1} = 1$.) The group of interest is the **monodromy subgroup**

$$\Gamma \;:=\; \langle B, T \rangle \;\subset\; \mathrm{Sp}_6(\mathbb{Z}).$$

The BDN paper classifies many specific $(\alpha, \beta)$ choices as either *thin* (the
limit set $\Lambda \subset \mathrm{RP}^5$ is a proper fractal) or *arithmetic* (the orbit
fills $\mathrm{RP}^5$ densely). Our demos draw approximations of $\Lambda$ for these examples.

## 2. The cast (current examples)

| Demo dir | BDN ID | $\alpha$ | $\beta$ | Status |
| --- | --- | --- | --- | --- |
| [sp6-limit-sets](sp6-limit-sets/) | A-1, A-15, C-2, C-32, C-47, C-55 | various | various | **super-demo**: unified viewer for all six, with chart / chart-PCA / auto-chart projection modes |
| [sp6-limit-set-c32](sp6-limit-set-c32/) | C-32 | $(0,0,0,0,\tfrac{1}{6},\tfrac{5}{6})$ | $(\tfrac{1}{4},\tfrac{3}{4},\tfrac{1}{12},\tfrac{5}{12},\tfrac{7}{12},\tfrac{11}{12})$ | open (thin?) |
| [sp6-limit-set-c47](sp6-limit-set-c47/) | C-47 | $(0,0,\tfrac{1}{5},\tfrac{2}{5},\tfrac{3}{5},\tfrac{4}{5})$ | $(\tfrac{1}{2},\tfrac{1}{2},\tfrac{1}{3},\tfrac{1}{3},\tfrac{2}{3},\tfrac{2}{3})$ | arithmetic |
| [sp6-c47-z2-translates-nonlinear](sp6-c47-z2-translates-nonlinear/) | C-47 | as above | as above | Z²-translates of 64-word seed under notebook's `weirdfun` chart |
| [sp6-limit-set-c55](sp6-limit-set-c55/) | C-55 | $(0,0,\tfrac{1}{8},\tfrac{3}{8},\tfrac{5}{8},\tfrac{7}{8})$ | $(\tfrac{1}{2},\tfrac{1}{2},\tfrac{1}{12},\tfrac{5}{12},\tfrac{7}{12},\tfrac{11}{12})$ | arithmetic |
| [sp6-limit-set-c2](sp6-limit-set-c2/) | C-2 | $(0,0,0,0,\tfrac{1}{3},\tfrac{2}{3})$ | $(\tfrac{1}{2},\tfrac{1}{2},\tfrac{1}{2},\tfrac{1}{2},\tfrac{1}{4},\tfrac{3}{4})$ | thin (BDN Thm 4) |
| [sp6-limit-set-A1](sp6-limit-set-A1/) | A-1 | $(0,0,0,0,0,0)$ | $(\tfrac{1}{2})^6$ | thin |
| [sp6-limit-set-A15](sp6-limit-set-A15/) | A-15 | $(0,0,0,0,0,0)$ | $(\tfrac{1}{3},\tfrac{1}{3},\tfrac{2}{3},\tfrac{2}{3},\tfrac{1}{6},\tfrac{5}{6})$ | arithmetic |
| [sp6-c55-z2-translates](sp6-c55-z2-translates/) | C-55 + explicit word $W$ | as above | as above | exploratory; see §5 |

The A-series is the *maximally unipotent* case ($\alpha = 0^6$, so $f = (x-1)^6$ and $A$ is a
single Jordan block) — this is the MUM-point monodromy from mirror symmetry. Of the 40
entries in BDN's Table 1, A-1 (thin) and A-15 (arithmetic) are shipped here as separate
demos with the same recipe, useful as a side-by-side comparison.

## 3. Two flavors of demo

### 3a. Naive limit-set demos (`sp6-limit-set-X`)

For each example $X$, the recipe:

1. Pick a proximal eigenvector $\xi_+ \in \Lambda$ as basepoint, computed by **power iteration**
   on a fixed loxodromic word $\gamma \in \Gamma$ (typically $\gamma = TBT$ or $BTBTBTB$ for
   c32). The dominant eigenvalue's eigenvector is in $\Lambda$ by proximality, and the orbit
   $\Gamma \cdot \xi_+ \subset \Lambda$ by $\Gamma$-invariance.
2. **BFS** through all *non-backtracking* words of length $\le K$ in $\{B, B^{-1}, T, T^{-1}\}$
   acting on $\xi_+$. Default $K = 12$ → about $10^6$ orbit points. After each matrix-vector
   product, renormalize the 6-vector to $S^5$ to avoid Float64 overflow.
3. Project each orbit point to $\mathbb{R}^3$ via the affine chart
   $\pi(v) = (v_2, v_3, v_4)/v_1$. Filter out points with $|v_1| < 10^{-3}$ (chart-singular).
4. Render as a `THREE.InstancedMesh` of low-poly spheres in a flat monochrome gray.
5. Auto-fit the camera with a 15–85 percentile bounding box (robust to chart-singular
   outliers) and place the camera so the bbox fills ~50% of the vertical view.

All naive demos share this pipeline. The only data that differs between examples:
`coefflistf`, `coefflistg` (or equivalently $\alpha, \beta$), and the choice of loxodromic
word $\gamma$ for power iteration.

UI: a small panel at top-left has:
- a depth slider for $N$ (BFS depth)
- a ball-radius slider

Console logs include: BFS time, point count, $|\lambda_{\max}(\gamma)|$ from power iteration
(use as a sanity check against the BDN-notebook values), camera-fit center & radius.

### 3b. Z²-translates demo (`sp6-c55-z2-translates`)

Currently exists only for C-55. The idea is to extend $\Lambda$-coverage *algebraically*
rather than by deeper BFS, by exploiting a known commuting pair inside $\Gamma$.

The construction:
1. Choose an explicit word $W \in \Gamma$ (for C-55: a specific 49-letter word in
   $\{A, A^{-1}, B, B^{-1}\}$ given by a collaborator). $W$ is a $6 \times 6$ integer matrix
   with $\sim 50$-digit entries.
2. Form $X_1 := T$ and $X_2 := W T W^{-1}$. Both are unipotent transvections (conjugates of $T$).
3. **Verify $[X_1, X_2] = 0$** by computing the commutator as exact integers (BigInt arithmetic
   throughout) and checking entrywise equality with the zero matrix. The demo does this on
   load, prints the full step-by-step writeup to console, and throws if it fails.
4. Use $\langle X_1, X_2 \rangle \cong \mathbb{Z}^2$: assemble all $(2N+1)^2$ matrices
   $M_{m,n} := X_1^m X_2^n = I + m N_1 + n N_2 + mn\, N_1 N_2$ (closed form from
   $(X_i - I)^2 = 0$).
5. Generate a BFS seed orbit $\mathcal{O}_K \subset \Lambda$ as in the naive demo.
6. For each $(\xi, m, n)$: compute $M_{m,n} \cdot \xi$ (with $M_{m,n}$ rescaled by max-entry to
   live in $[-1, 1]$ in Float64), normalize, project to $\mathbb{R}^3$, dedup, render.

The hope was a 2-D lattice of translated cluster-copies tiling $\Lambda$. The reality (see §5
below) is more nuanced.

## 4. File conventions (all sp6 demos)

- `main.ts`: the single-file demo (no shared modules — each demo is self-contained for easy
  reading and modification).
- `README.md`: per-demo math writeup + parameters.
- Console output uses Unicode box-drawing for section headers and emits sanity-check values
  (eigenvalue moduli, identity-check booleans) that match the original BDN Mathematica
  notebooks in [c32 in sp6r.nb](../c32%20in%20sp6r.nb), [c47 in sp6r.nb](../c47%20in%20sp6r.nb),
  [c55 in sp6r.nb](../c55%20in%20sp6r.nb).

**Coding conventions used throughout:**
- 6-vector indexing is **0-based** in code (`v[0]` ... `v[5]`); the math comments use 1-based
  ($v_1$ ... $v_6$). The chart denominator is `v[0]` (= $v_1$), and the 3D projection takes
  `(v[1], v[2], v[3])` (= $(v_2, v_3, v_4)$) divided by `v[0]`.
- Generator codes in BFS: `0 = B`, `1 = B⁻¹`, `2 = T`, `3 = T⁻¹`; the inverse map is
  `INV = [1, 0, 3, 2]`. Non-backtracking BFS skips the inverse of the previous generator.
- Hand-coded sparse mat-vec for $B, B^{-1}, T, T^{-1}$: each is $O(6)$ rather than $O(36)$
  thanks to the companion + transvection structure. The two relevant constants are
  `T_COL_F[i] = T[i, 0]` (length 6, with `T_COL_F[0] = 1`) and
  `B_C_F[i] = coefflistg[i+1]` (length 5, the polynomial coefficients between the leading
  and trailing $1$s).
- Renormalization to $S^5$ after every multiplication keeps Float64 stable through depth
  $\sim$15 or so without BigInt.

## 5. Important discovery: the Float64 collapse in z2-translates

Documented in detail in [sp6-c55-z2-translates/README.md](sp6-c55-z2-translates/README.md) §7,
but the headline:

When $[X_1, X_2] = 0$, one can show $u_0 = (Wc)_0 = 0$ and $v \cdot c = 0$ (where
$N_2 = u v^\top$, $v = (e_1^\top W^{-1})^\top$). So $N_1 N_2 = 0$ identically, and

$$X_1^m X_2^n \xi \;=\; \xi \;+\; m\,\xi_0\,c \;+\; n\,p_\xi\,u.$$

The abelian orbit of any single $\xi$ is contained in the 2-plane
$\xi + \mathrm{span}(c, u) \subset \mathbb{R}^6$. **But the two directions are wildly
anisotropic**: $|c| \sim 10$, $|u| \sim 10^{51}$. In any Float64 chart, the lattice spacing
along $u$ is $\sim 10^{50}$ times the spacing along $c$, so for any $n \neq 0$ the
contribution of $\xi$ and of $m\xi_0 c$ both fall below Float64 precision relative to the
dominant $n p_\xi u$ term. Visually you see a 1-D bundle (the $X_1$-sweep curves for each
seed point), not the 2-D lattice that mathematically exists.

The compression factor scales as $\|W\|^2$, so a much shorter $W$ would yield a visible
lattice; the friend's 49-letter $W$ gives $\|W\|^2 \sim 10^{112}$, which is the source of
the trouble.

Two natural escape routes if someone wants to push further:
- **Use a short test $W$** as a sanity-check: confirms the construction works and the lattice
  is real.
- **Render residuals**: compute the projective image exactly in BigInt, subtract the rank-1
  attractor direction $(u + m u_0 c)$, rescale the residual by $\sim 10^{300}$, and render
  that. Shows the lattice in coordinates moving with the attractor.

Neither is implemented yet.

## 6. The export script (`scripts/sp6-export-orbit.mjs`)

A standalone Node ESM script that:
1. Power-iterates a loxodromic word $\gamma$ to find $\xi_+(\gamma)$ in Float64.
2. Runs the same non-backtracking BFS to depth $N$.
3. Projects to an affine chart (configurable denominator $v_k$, default $v_6$).
4. Optionally dedups using a hash of quantized chart coordinates.
5. Streams the result to a text file `LABEL-orbit-depthN-chartK.txt`, one point per line,
   with a header recording the matrices used.

Edit the top constants to switch examples (reference values for all 6 examples are listed in
comments). Used to produce the `*-orbit-*.txt` files at the repo root.

For $N \le 13$ memory is comfortable; for $N \ge 14$ the dedup hash becomes the limiting
factor (it auto-disables at $N \ge 14$). For $N = 15$, runtime is ~25 s, output ~2 GB.

## 7. Source notebooks

The BDN Mathematica notebooks (gifts from the collaborator) live at the repo root:
- [`c32 in sp6r.nb`](../c32%20in%20sp6r.nb)
- [`c47 in sp6r.nb`](../c47%20in%20sp6r.nb)
- [`c55 in sp6r.nb`](../c55%20in%20sp6r.nb)

They contain the original analyses, including the proximal-eigenvector computations and
the choice of loxodromic words ($BTBTBTB$ for c32, $TBT$ for c47/c55), which our demos
mirror exactly. Useful as a cross-check.

## 8. Recipe for adding a new example

To add a naive limit-set demo for a new $(\alpha, \beta)$:

1. Compute polynomials: $f, g$ from the eigenvalue-exponent multisets.
2. Compute coefficient lists: $\mathrm{coefflistf}, \mathrm{coefflistg}$ (length 7, palindromic,
   leading and trailing $1$).
3. Derive $B$-coefficients ($\mathrm{coefflistg}[1..5]$ — used in the sparse mat-vec for $B$
   and $B^{-1}$).
4. Derive the transvection column $T_\text{col} = (1, c_1, \ldots, c_5)$ where
   $c_i = \mathrm{coefflistf}[i] - \mathrm{coefflistg}[i]$ for $i = 1, \ldots, 5$.
5. Choose a loxodromic word $\gamma$ (start with $\gamma = TBT$; if its top eigenvalue isn't
   real and dominant, try $BTBTBTB$ — power-iteration "drift" diagnostic in the demo tells
   you if it didn't converge).
6. Copy any existing `sp6-limit-set-X` directory, swap in the new constants, update the
   header comment and README. Update [`../index.html`](../../index.html) to point at it.
7. Run `npm run dev sp6-limit-set-NEWEXAMPLE` and inspect.

To add a z2-translates demo, you also need:
- An explicit word $W \in \Gamma$ as a string in `{A, a, B, b}` (uppercase = matrix,
  lowercase = inverse).
- Verification that $[X_1, X_2] = 0$ holds for this $W$ (the demo will throw at load time
  if not).

Copy [sp6-c55-z2-translates](sp6-c55-z2-translates/) and edit the polynomial constants and
`W_STR`. Note that the Float64 collapse issue (§5) applies generally — you'll likely see
a 1-D bundle rather than a 2-D lattice unless $W$ is very short.

## 9. Running the demos

```bash
npm run dev sp6-limit-sets       # super-demo (all six examples, with PCA UI)
npm run dev sp6-limit-set-c55    # individual example (legacy, simpler UI)
npm run dev sp6-c55-z2-translates
# etc.
```

The dev script rewrites `index.html` to point at the chosen demo before launching Vite.

## 10. Open / unresolved threads

- For most examples we don't yet have a long word $W$ giving a commuting pair — only C-55.
  When other examples acquire a $W$, the z2-translates pattern can be copied.
- The Float64 collapse in §5 — a more honest visualization (BigInt residuals, or short-$W$
  sanity check) would clarify whether the abelian-translate construction actually buys us
  anything new beyond what naive BFS already shows.
- The chart choice ($v_1$ denominator) is the BDN-notebook convention. Different charts can
  reveal different features; for c55-z2-translates we briefly experimented with $v_5$
  denominator but reverted to $v_1$ for consistency with the naive demos.
