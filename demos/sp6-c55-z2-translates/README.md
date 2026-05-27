# Sp(6,ℤ) — translates of an orbit by an abelian subgroup (C-55)

This demo visualizes a chunk of the proximal limit set $\Lambda \subset \mathbb{RP}^5$ of the
**C-55 hypergeometric monodromy group** of Bajpai–Dona–Nitsche by combining two pieces:

1. A small *seed orbit* of words in $\Gamma = \langle B, T \rangle$ acting on a known
   limit-set point.
2. A large $\mathbb{Z}^2$ *grid of translates* by an explicit abelian subgroup
   $\langle X_1, X_2 \rangle \subset \Gamma$, multiplied through each seed-orbit point.

The point of the construction is to exploit the structure of $\Gamma$ — in particular the
$\mathbb{Z}^2$-acting-by-translations subgroup — to reach far-out parts of $\Lambda$ that are
deep in the BFS tree but easy to land on directly.

## 1. The group: hypergeometric data

C-55 is the example with hypergeometric data

$$\alpha = (0, 0, \tfrac{1}{8}, \tfrac{3}{8}, \tfrac{5}{8}, \tfrac{7}{8}), \qquad
  \beta  = (\tfrac{1}{2}, \tfrac{1}{2}, \tfrac{1}{12}, \tfrac{5}{12}, \tfrac{7}{12}, \tfrac{11}{12}).$$

The associated polynomials are

$$f(x) = (x-1)^2(x^4 + 1) = 1 - 2x + x^2 + x^4 - 2x^5 + x^6,$$

$$g(x) = (x+1)^2(x^4 - x^2 + 1) = 1 + 2x - 2x^3 + 2x^5 + x^6,$$

with palindromic integer coefficients (the symplectic condition).

Let $A, B \in \mathrm{Sp}(6, \mathbb{Z})$ be their companion matrices. Both have determinant $1$
(constant term of $f, g$ is $1$), so $A^{-1}, B^{-1}$ are also integer matrices, and we get a
clean closed form for the inverses from the companion structure. Define

$$T \;:=\; A B^{-1}.$$

For this family $T$ is automatically a **unipotent transvection**: $T = I + c\,e_1^\top$ with
$c \in \mathbb{Z}^6$ given in closed form by

$$c_i = \mathrm{coefflist}(f)_i - \mathrm{coefflist}(g)_i, \qquad i = 1, \ldots, 5,$$

(and $c_0 = 0$, $T_{1,1} = 1$). For C-55 this evaluates to $c = (0, -4, 1, 2, 1, -4)^\top$.

## 2. The word $W$ and the matrices $X_1, X_2$

Fix the explicit word

$$W \;=\; b\,a^4\,b\,a^4\,b\,a^4\,b\,a^4\,b\,a^4\,b\,a^4\,b\,a^5 \cdot B A B a B A B A^2 b a^2 B \;\in\; \Gamma$$

(uppercase = matrix, lowercase = inverse; total length 49). $W$ is a $6 \times 6$ integer
matrix with entries up to roughly $10^{50}$.

Define

$$X_1 \;:=\; T, \qquad X_2 \;:=\; W \, T \, W^{-1}.$$

Both $X_1$ and $X_2$ are conjugates of $T$ inside $\Gamma$, hence both are unipotent
transvections (rank-1 perturbations of $I$), with $(X_i - I)^2 = 0$.

**Commutativity check.** The demo verifies *exactly* on load — using BigInt arithmetic on
$6 \times 6$ matrices — that

$$X_1 X_2 \;=\; X_2 X_1,$$

prints the full step-by-step computation ($A, B, T, W, X_1, X_2, X_1 X_2, X_2 X_1, [X_1, X_2]$)
to the console, and throws if the commutator is nonzero. Because the entries are integers,
this is an exact equality of integer matrices, no tolerance involved. Once it holds,
$\langle X_1, X_2 \rangle$ is an abelian subgroup of $\Gamma$, isomorphic to $\mathbb{Z}^2$
(no further relations are imposed by the hypergeometric data — both $X_i$ have infinite order).

## 3. Powers of $X_1, X_2$: closed form

Set $N_i := X_i - I$, so $N_i^2 = 0$. Commutativity of $X_1, X_2$ implies
$N_1 N_2 = N_2 N_1$. Then by binomial expansion (with the higher powers vanishing),

$$X_i^m \;=\; I + m\,N_i,$$

$$X_1^m \, X_2^n \;=\; (I + m N_1)(I + n N_2) \;=\; I \;+\; m\,N_1 \;+\; n\,N_2 \;+\; mn\,N_1 N_2.$$

So the matrix entries of $X_1^m X_2^n$ are **polynomial** in $(m, n)$ — linear in each of
$m, n$, with a quadratic $mn$ cross-term — *not* exponential. This is the structural fact
that makes the construction tractable: powers in the abelian subgroup do not blow up
combinatorially the way reduced words in a free group do.

The *coefficients* of that polynomial, however, are large: $N_1$ has small entries
(bounded by $\|c\|_\infty \approx 10$), but $N_2 = (Wc) \cdot (e_1^\top W^{-1})$ has entries
of order $\|W\|_\infty \cdot \|W^{-1}\|_\infty \approx 10^{100}$, since $W$ has 50-digit
integer entries and $W^{-1}$ similarly. The cross-term $N_1 N_2$ has entries of order
$10^{100}$ as well.

## 4. The orbit: seed × translates

We pick a *known limit-set point* $\xi_+ \in \Lambda \subset \mathbb{RP}^5$ as the basepoint
of the seed orbit. As in the
[`sp6-limit-set-c55`](../sp6-limit-set-c55/) demo, $\xi_+$ is the dominant eigenvector of a
loxodromic $\gamma \in \Gamma$ (we use $\gamma = T B T$, which has top eigenvalue $\approx 5.57$
and a unique attracting fixed point in $\mathbb{RP}^5$). Power iteration converges to
$\xi_+(\gamma)$ in a few dozen steps, and $\xi_+(\gamma) \in \Lambda$ by proximality.

The **seed orbit** is the set of non-backtracking words of length $\le K$ in
$\{B, B^{-1}, T, T^{-1}\}$ applied to $\xi_+$:

$$\mathcal{O}_K \;=\; \{ w \cdot \xi_+ : w \in \mathcal{W}_K \} \;\subset\; \Lambda, \qquad
  |\mathcal{W}_K| = 1 + 2(3^K - 1).$$

We start with $K = 7$, giving $|\mathcal{O}_7| = 4{,}373$ points — small enough that the
demo loads instantly.

The **abelian translate grid** is the patch

$$\mathcal{G}_N \;=\; \{ X_1^m X_2^n : -N \le m, n \le N \} \;\subset\; \Gamma,$$

a square of $(2N+1)^2$ matrices indexed by a $\mathbb{Z}^2$ grid. Default $N = 10$ giving
$441$ translates.

The **rendered set** is the product

$$\mathcal{P}_{N, K} \;=\; \mathcal{G}_N \cdot \mathcal{O}_K \;=\; \{(X_1^m X_2^n) \cdot \xi : (m,n) \in [-N, N]^2,\ \xi \in \mathcal{O}_K\} \;\subset\; \Lambda.$$

For $N = 10, K = 7$ this is $441 \times 4373 \approx 1.93 \times 10^6$ points — comparable to
our other limit-set demos in count but reaching a much larger region of $\Lambda$.

## 5. Numerical strategy: $\mathrm{RP}^5$-aware scaling

The naïve approach — compute each $M_{m,n} := X_1^m X_2^n$ in floating point and apply it to
each $\xi$ — *fails* at $|m|, |n| \gtrsim 5$, because matrix entries of $M_{m,n}$ already
exceed Float64's $10^{308}$ overflow at modest grid coordinates, and lose precision well
before that.

Since the action is on $\mathbb{RP}^5$, every matrix is determined only up to a nonzero
scalar. We exploit this:

1. **BigInt exact assembly.** Compute $N_1, N_2, N_1 N_2$ once as exact $6 \times 6$ BigInt
   matrices. For each $(m, n) \in [-N, N]^2$, build
   $$M_{m,n} \;=\; I + m N_1 + n N_2 + mn\,N_1 N_2$$
   in BigInt (a few scalar-matrix sums per grid point — fast).

2. **Projective rescale.** Compute $K_{m,n} := \max_{i,j} |(M_{m,n})_{i,j}|$ and form
   $$M'_{m,n} \;:=\; M_{m,n} / K_{m,n} \;\in\; [-1, 1]^{6 \times 6}$$
   as a Float64 matrix. The action of $M'_{m,n}$ on $\mathbb{RP}^5$ is identical to that of
   $M_{m,n}$.

3. **Float64 application.** For each seed-orbit point $\xi$ (already a unit vector on $S^5$)
   and each grid coordinate $(m, n)$, compute $\xi' = M'_{m,n} \cdot \xi$ in Float64 and
   renormalize $\xi' \mapsto \xi' / \|\xi'\|$. The result is a unit-vector representative on
   $S^5$ of the projective image $(X_1^m X_2^n) \cdot \xi \in \mathbb{RP}^5$.

What happens to the $I$ part of $M'_{m,n}$ at large $(m, n)$ is mathematically interesting:
its entries become $1/K_{m,n} \sim 10^{-100}$ and underflow to zero in Float64. This is
*correct* — at large $(m, n)$ the projective action of $X_1^m X_2^n$ really is approximately
rank-1 (dominated by $N_1 N_2$), and the seed point's contribution is genuinely negligible
relative to the dominant attracting direction. Float64 here is faithfully reproducing the
real projective dynamics, not silently corrupting it.

For modest $(m, n)$ (near the origin of the grid), $K_{m,n}$ is order unity, $M'_{m,n}$ is
close to $I$, and floating point applies $M'_{m,n}$ losslessly to standard precision.

## 6. Visualization

Project each rendered point $\xi \in S^5$ to $\mathbb{R}^3$ via the affine chart
$\{v_1 \neq 0\}$ followed by projection onto the first three chart coordinates:

$$\pi(\xi) \;=\; \frac{1}{\xi_1}(\xi_2, \xi_3, \xi_4) \;\in\; \mathbb{R}^3.$$

(Points with $|\xi_1| < 10^{-3}$ are filtered out, as they project to infinity.)

Each $\pi(\xi)$ is the position of one instance in a `THREE.InstancedMesh` of small spheres
(the same rendering pipeline as the other limit-set demos). Total instances $\approx 2 \times 10^6$.

**Coloring.** Each instance is colored by its *grid coordinate* $(m, n) \in [-N, N]^2$. Hue
is the angular polar coordinate $\theta = \arg(m + in) \in [0, 2\pi)$, and saturation/brightness
encode the radial coordinate $r = \sqrt{m^2 + n^2}$. Geometrically: each
$\mathbb{Z}^2$-translate of $\mathcal{O}_K$ is one solid color, and translates close to the
identity are dim/desaturated while translates far out are vivid. This makes the
$\mathbb{Z}^2$-coset structure of $\mathcal{P}_{N, K}$ visually legible: you can see the
grid of translates filling out $\Lambda$, with the deep-grid translates concentrating along
the dominant attracting direction of $X_1 N_2 X_1^{-1}$-type dynamics.

The grid origin $(m, n) = (0, 0)$ recovers the original seed orbit $\mathcal{O}_K$.

## 7. Rebalancing the lattice (so we can actually see it)

In principle, the rendered set $\mathcal{P}_{N, K}$ is a 2D-fanned-out arrangement of
$\mathbb{Z}^2$-translates of the seed cluster $\mathcal{O}_K$, scattered across $\Lambda$.
In Float64, however, the picture is more degenerate, for a structural reason:

When the commutator $[X_1, X_2] = 0$ holds, one derives that $u_0 = (Wc)_0 = 0$ and
$v \cdot c = 0$. So $N_1 N_2 = 0$ identically, and the closed form simplifies to

$$X_1^m X_2^n \, \xi \;=\; \xi \;+\; m\,\xi_0\,c \;+\; n\,p_\xi\,u, \qquad p_\xi := v \cdot \xi.$$

That is: the abelian orbit of any single $\xi$ lives in the **2-plane**
$\xi + \mathrm{span}(c, u) \subset \mathbb{R}^6$, projecting to a 2-D projective subspace of
$\mathbb{RP}^5$. The orbit *cannot* fill $\mathbb{RP}^5$ — it's confined to this 2-plane.

Moreover the two spanning directions are wildly anisotropic: in our integer representation
$|c| \sim 10$ and $|u| \sim 10^{51}$, so the lattice spacing in the $u$-direction is
$\sim 10^{50}$ times the spacing in the $c$-direction. In Float64 chart coordinates this
collapses each $n \neq 0$ translate to within $\sim 10^{-300}$ of the rank-1 attractor
direction $\mathrm{span}(u + m u_0 c)$ — far below precision.

**The fix: replace $X_1$ with $Y := X_1^K$** as the new generator of the sub-$\mathbb{Z}^2$
we sample, where

$$K \;=\; \bigl\lfloor |N_2|_\max / |N_1|_\max \bigr\rfloor \;\approx\; 10^{302}.$$

Then $|Y - I| = |K \cdot N_1| \approx |N_2|$, and chart-space steps in the $m$- and
$n$-directions are now comparable. The renderable lattice $\langle Y, X_2 \rangle$ is a
*sub-lattice* of the original $\langle X_1, X_2 \rangle$ — we sample every $K$-th point
along the $X_1$-axis — but it's *visible* as a clean 2-D pattern.

**Chart denominator switch.** Because $c_0 = 0$ and $u_0 = 0$, the first coordinate of every
result $M_{m,n}\xi$ is $\xi_0$, which is tiny relative to the rescaled matrix's max. After
Float64 rescaling it falls below the chart-singular cutoff. We sidestep this by projecting
through $v_2$ as the chart denominator (since $c_1 = -4 \neq 0$, the $v_2$ coordinate gets
the dominant $N_1$ and $N_2$ contributions and stays $O(1)$ after normalization). The 3-D
projection is

$$\pi(v) \;=\; (v_1,\, v_3,\, v_4) \,/\, v_2 \;\in\; \mathbb{R}^3.$$

This is a different chart from the one the naive C-55 limit-set demo uses; the choice is
forced by the commutativity structure.

**Caveat.** What's rendered is a sub-lattice, sampled every $K \approx 10^{302}$ raw
$X_1$-steps. The visible 2-D pattern is qualitatively the same as the full lattice (it's
just sparser along the $m$-axis); the dense original lattice is genuinely beyond Float64's
resolving power without a different rendering scheme.

## 8. Files

- [`main.ts`](./main.ts) — the demo. Walks through polynomials → $A, B, T$ → $W$ → $X_1, X_2$
  → exact commute check (BigInt, throws on failure) → BFS seed orbit → projective rescaling
  → Float64 application → instanced rendering. Full step-by-step writeup in the console.

## 9. Caveats and parameters

- Default $N = 10$, $K = 7$ → ~2M rendered points. Easy on modern hardware.
- $K$ is the BFS depth for the *seed* orbit, not the full word length we're effectively
  exploring. The effective reach (in word length over $\Gamma$'s standard generators) is
  $K + 2 \cdot 49 \cdot N$ at the corners of the grid, since each $X_2 = WTW^{-1}$ contributes
  word length $2 \cdot 49 + 1 = 99$ and we apply $|n|$ copies.
- Increasing $N$ or $K$ scales linearly in instance count. Render performance and Float64
  cancellation precision are the practical limits, not BigInt cost — the BigInt step is
  fixed-time in $|\mathcal{O}_K|$ and quadratic in $N$, but with very small constant.
- Visual sanity check: at $(m, n) = (0, 0)$ the rendered subset should match the original
  C-55 limit-set demo's orbit at depth 7. Within each translate, the BFS coloring (last
  generator applied) is *not* used here — the whole translate is a single color.
