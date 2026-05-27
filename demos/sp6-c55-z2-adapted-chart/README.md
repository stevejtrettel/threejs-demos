# Sp(6,ℤ) — C-55 abelian translates in an adapted chart

A sister demo to [`sp6-c55-z2-translates`](../sp6-c55-z2-translates/), differing
only in the projective chart used to render the orbit. The math up through
$X_1, X_2$ and the commutativity check is identical; see the parent README and
[`SP6.md`](../SP6.md) §3b, §5 for the full setup.

The point of this demo is to build a chart **aligned to the two transvection
axes themselves**, so they appear as identifiable points in the picture and the
$\mathbb{Z}^2$-lattice structure is no longer compressed by the
$|u|/|c| \approx 10^{50}$ anisotropy.

## 1. What we use

From the structural decomposition:

- $c \in \mathbb{Z}^6$ — the 0-th column of $N_1 = X_1 - I$ (the transvection
  axis of $X_1$).
- $u \in \mathbb{Z}^6$ — the 0-th column of $N_2 = X_2 - I$, equal to $Wc$.
- $v \in \mathbb{Z}^6$ — the 0-th row of $W^{-1}$.

These satisfy two structural identities (verified at load):

$$u_0 = 0, \qquad v \cdot c = 0,$$

which together force $N_1 N_2 = N_2 N_1 = 0$ and yield the clean closed form

$$X_1^m X_2^n \, \xi \;=\; \xi \;+\; m\,\xi_0\,c \;+\; n\,p_\xi\,u, \qquad p_\xi := v \cdot \xi.$$

Geometrically: $[c] \in \mathbb{RP}^5$ is the fixed axis of $X_1$ (and lies in
the fixed hyperplane of $X_2$, hence is fixed by both), and similarly $[u]$ is
fixed by both. The vectors $c, u$ are isotropic and symplectically orthogonal,
so $\mathrm{span}(c, u) \subset \mathbb{R}^6$ is a 2-dimensional isotropic plane.

## 2. The adapted basis

Pick indices $j_1 < j_2 \in \{1, \ldots, 5\}$ maximizing

$$|D| \;=\; |c_{j_1} u_{j_2} - c_{j_2} u_{j_1}|,$$

and let $\{i_1, i_2, i_3\} = \{1, \ldots, 5\} \setminus \{j_1, j_2\}$. The
adapted basis of $\mathbb{R}^6$ is

$$\{\, c, \;u, \;e_0, \;e_{i_1}, \;e_{i_2}, \;e_{i_3} \,\}.$$

Both $c_0$ and $u_0$ vanish, so $e_0$ is forced into the completion. The other
three completion vectors are picked so the change-of-basis matrix is
well-conditioned in Float64 (large $|D|$).

Write the coordinates of $\xi \in \mathbb{R}^6$ in this basis as
$(\alpha_1, \alpha_2, \alpha_3, \alpha_4, \alpha_5, \alpha_6)$. Rows $j_1, j_2$
give the $2 \times 2$ Cramer-rule system for $(\alpha_1, \alpha_2)$:

$$\alpha_1 \;=\; \frac{u_{j_2} \xi_{j_1} - u_{j_1} \xi_{j_2}}{D}, \qquad
  \alpha_2 \;=\; \frac{c_{j_1} \xi_{j_2} - c_{j_2} \xi_{j_1}}{D}.$$

Row 0 gives $\alpha_3 = \xi_0$. Rows $i_k$ give
$\alpha_{3+k} = \xi_{i_k} - \alpha_1 c_{i_k} - \alpha_2 u_{i_k}$ for $k = 1, 2, 3$.

By construction, $[c]$ has $(\alpha_1 : \alpha_2 : \cdots) = (1 : 0 : 0 : \cdots)$
and $[u]$ has $(0 : 1 : 0 : \cdots)$.

## 3. The chart

Define

$$\ell(\xi) \;=\; \alpha_1(\xi) \;+\; s\,\alpha_2(\xi), \qquad s := |c|_\infty / |u|_\infty.$$

Both $\ell(c) = 1$ and $\ell(u) = s \neq 0$, so neither axis is at infinity in
this affine chart. The 3-D projection is

$$\pi(\xi) \;=\; \left(\,\frac{\alpha_1 - s\,\alpha_2}{\ell},\;\; \frac{\alpha_3}{\ell},\;\; \frac{\alpha_4}{\ell}\,\right).$$

Then

$$\pi([c]) = (+1,\,0,\,0), \qquad \pi([u]) = (-1,\,0,\,0).$$

The two transvection axes sit at the endpoints of a segment along the
$x$-axis, marked in the rendered scene with red and blue marker spheres.

**Why the rebalance scale $s$?** A unit step in $n$ shifts $\alpha_2$ by
$p_\xi \approx 10^{50}$, while a unit step in $m$ shifts $\alpha_1$ by
$\xi_0 \approx 1$. Without the $s$ rescaling, the chart denominator
$\alpha_1 + \alpha_2$ would balloon by $10^{50}$ for any $|n| \geq 1$, collapsing
all such points to $[u]$. Multiplying $\alpha_2$ by $s = |c|_\infty / |u|_\infty$
brings the two contributions onto a common scale. Rescaling the dual functional
$\phi^2$ in this way does **not** move $[c]$ or $[u]$ in the chart — they
remain at $(\pm 1, 0, 0)$ regardless of $s$.

## 4. The orbit, in adapted coords

By the closed-form formula, $X_1^m X_2^n \xi$ has adapted coords
$(\alpha_1 + m\xi_0, \;\alpha_2 + n p_\xi, \;\alpha_3, \;\alpha_4, \;\alpha_5, \;\alpha_6)$
— only $\alpha_1, \alpha_2$ change under the abelian action.

So for each seed $\xi$, we compute $(\alpha_1, \alpha_2, \alpha_3, \alpha_4)$
and $(\xi_0, p_\xi)$ once. Then for each $(m, n)$ we compute the chart values
directly from an affine formula:

$$a = \alpha_1 + m\xi_0, \quad b = s(\alpha_2 + n p_\xi), \quad \pi = \left(\frac{a-b}{a+b}, \frac{\alpha_3}{a+b}, \frac{\alpha_4}{a+b}\right).$$

No matrix-vector product, no $S^5$-renormalization, no Float64 overflow.

For each seed, the $\mathbb{Z}^2$-orbit projects onto a half-plane through the
$(\pi_2, \pi_3) = (0, 0)$ axis, parametrized by the Möbius variable
$\pi_1 = (a - b)/(a + b) \in (-1, 1)$. Different seeds project to different
half-planes, fanning out around the common $[c]$–$[u]$ edge.

## 5. What you should see

- **Two highlighted points** at $(\pm 1, 0, 0)$: $[c]$ in red, $[u]$ in blue.
- **A bouquet of lattice patches** stretching between them, organized by seed.
  Each seed contributes a 2-D lattice (Möbius-deformed) on its own half-plane
  through the $[c]$–$[u]$ segment.
- The grid coloring (`hue = arg(m+in)`, saturation $\propto$ radius) is shared
  with the parent demo, so individual translate slices remain identifiable.
- Asymptotic behavior: $m \to \pm\infty$ pushes a point toward $[c]$;
  $n \to \pm\infty$ pushes it toward $[u]$; "diagonal" $(m, n)$ with
  $a + b \approx 0$ projects to the chart-singular locus and is filtered out.

## 6. Caveats and future moves

- The choice $(\pi_2, \pi_3) = (\alpha_3/\ell, \alpha_4/\ell)$ uses only 2 of
  the 4 transverse coordinates — a deliberate dimensional reduction from
  $\mathbb{R}^5$ to $\mathbb{R}^3$. Swapping in $\alpha_5$ or $\alpha_6$ reveals
  different cross-sections of the seed orbit; for now this is hard-coded but
  trivial to expose in the HUD.
- Float64 precision of $\alpha_1, \alpha_2$ depends on $|D|$ being numerically
  robust; the chosen $(j_1, j_2)$ maximizes $|D|$ exactly in BigInt. For C-55
  with this $W$, $|D|$ has $\sim 51$ digits, comfortably above Float64 noise.
- A single 3-D view inevitably overlays many seeds' half-planes. If a region
  gets cluttered, toggle monochrome off and zoom near the $[c]$–$[u]$ edge.
- The natural next step (Chart 2 from SP6.md §5) is to project with a denominator
  *transverse* to $\mathrm{span}(c, u)$, putting $[c]$ and $[u]$ at infinity in
  exchange for a clean undeformed 2-D lattice per seed. Requires BigInt
  arithmetic to evade the anisotropy.

## 7. Files

- [`main.ts`](./main.ts) — single-file demo with the adapted-chart pipeline.
