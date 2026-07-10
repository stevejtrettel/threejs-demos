# Three.js Demo: Supporting Lines from Farey Sequences

## Goal

Build a 2D Three.js visualization of how the stable-norm supporting line at a rational direction \(u\) is obtained from the sequence of primitive classes

\[
nu+v,
\qquad n=1,2,3,\ldots,
\]

where \(u,v\in\mathbb Z^2\) satisfy

\[
\det(u,v)=1.
\]

Projectively,

\[
[nu+v]
=
\left[u+\frac1n v\right],
\]

so these slopes approach the slope of \(u\) from one side.

The key visual fact is:

> The secant line through the boundary points for \(u\) and \(nu+v\) converges to the one-sided supporting line at the vertex for \(u\).

---

## Mathematical data

Assume the project already provides a length oracle

```ts
length(p: number, q: number): number
```

returning the simple-geodesic length

\[
N(p,q).
\]

For each primitive class \(h=(p,q)\), its stable-norm boundary point is

\[
P(h)=\frac{h}{N(h)}.
\]

For the chosen class \(u\), define

\[
L=N(u),
\qquad
P_u=\frac{u}{L}.
\]

For each \(n\ge1\), define

\[
h_n=nu+v,
\qquad
N_n=N(h_n),
\qquad
P_n=\frac{h_n}{N_n}.
\]

Then

\[
P_n\longrightarrow P_u.
\]

---

## The finite secant line

Use \(u,v\) as a basis. In these coordinates,

\[
P_u=\left(\frac1L,0\right),
\qquad
P_n=\left(\frac{n}{N_n},\frac1{N_n}\right).
\]

The line through \(P_u\) and \(P_n\) is

\[
L\,s+d_n\,t=1,
\]

where

\[
\boxed{
d_n=N(nu+v)-nN(u).
}
\]

This is easy to verify:

\[
L\left(\frac1L\right)=1,
\]

and

\[
L\frac{n}{N_n}
+
d_n\frac1{N_n}
=
\frac{nL+N_n-nL}{N_n}
=
1.
\]

As \(n\to\infty\),

\[
d_n\longrightarrow d=D_v^+N(u),
\]

and the secant lines converge to the one-sided supporting line

\[
\boxed{
L\,s+d\,t=1.
}
\]

---

## Convert the line to standard \((x,y)\)-coordinates

Write

\[
u=(p,q),
\qquad
v=(a,b),
\qquad
pb-qa=1.
\]

A functional satisfying

\[
\lambda(u)=L,
\qquad
\lambda(v)=d_n
\]

has coefficients

\[
\alpha_n=bL-q\,d_n,
\qquad
\beta_n=-aL+p\,d_n.
\]

Therefore the finite secant line is

\[
\boxed{
\alpha_n x+\beta_n y=1.
}
\]

The limiting support line uses \(d\) instead of \(d_n\).

---

## Default modular-torus example

Use

```ts
u = [1, 0]
v = [0, 1]
```

so that

\[
h_n=(n,1).
\]

Then

\[
P_u=\left(\frac1{N(1,0)},0\right),
\]

and the secant/support lines are simply

\[
N(1,0)\,x+d_n y=1.
\]

For the modular torus,

\[
N(p,q)
=
2\operatorname{arcosh}\left(\frac{3m_{p/q}}2\right),
\]

where \(m_{p/q}\) is the corresponding Markoff number.

---

## Scene layout

Use an orthographic camera looking at the \(xy\)-plane.

Draw:

1. **Axes** and a light grid.
2. **Known stable-norm boundary points**
   \[
   P(h)=h/N(h)
   \]
   for a finite set of primitive classes.
3. Their **inner convex hull** as a thin polygon.
4. The chosen vertex \(P_u\), emphasized.
5. The sequence points
   \[
   P_1,P_2,\ldots,P_{n_{\max}}
   \]
   approaching \(P_u\).
6. For the currently selected \(n\), draw:
   - the ray from the origin in direction \(nu+v\);
   - the point \(P_n\);
   - the secant line through \(P_u\) and \(P_n\).
7. If the exact limiting value \(d\) is available, also draw the limiting supporting line.

The important animation is to increase \(n\) and watch:

- the slope \(nu+v\) approach the slope of \(u\);
- the point \(P_n\) approach \(P_u\);
- the secant line converge to the support line.

---

## Suggested controls

```ts
interface DemoControls {
  u: [number, number];
  v: [number, number];
  n: number;
  nMax: number;
  showBoundarySamples: boolean;
  showInnerHull: boolean;
  showAllSequencePoints: boolean;
  showSecant: boolean;
  showExactSupport: boolean;
  animateN: boolean;
}
```

Display numerically:

```text
u
v
n
h_n = n*u + v
N(u)
N(h_n)
d_n = N(h_n) - n*N(u)
```

If the exact support value is available, also display

```text
d
|d_n - d|
```

---

## Useful implementation helpers

```ts
type Vec2 = readonly [number, number];

function add(a: Vec2, b: Vec2): Vec2;
function scale(k: number, v: Vec2): Vec2;
function det(a: Vec2, b: Vec2): number;

function boundaryPoint(h: Vec2): Vec2 {
  const L = length(h[0], h[1]);
  return [h[0] / L, h[1] / L];
}
```

Compute the \(n\)-th sequence item:

```ts
function sequenceItem(u: Vec2, v: Vec2, n: number) {
  const h: Vec2 = [
    n * u[0] + v[0],
    n * u[1] + v[1],
  ];

  const Lu = length(u[0], u[1]);
  const Lh = length(h[0], h[1]);
  const point: Vec2 = [h[0] / Lh, h[1] / Lh];
  const dn = Lh - n * Lu;

  return { h, Lu, Lh, point, dn };
}
```

Compute standard line coefficients:

```ts
function secantLine(
  u: Vec2,
  v: Vec2,
  Lu: number,
  dn: number,
) {
  const [p, q] = u;
  const [a, b] = v;

  // Assumes det(u,v) = +1.
  const alpha = b * Lu - q * dn;
  const beta = -a * Lu + p * dn;

  // Line equation: alpha*x + beta*y = 1.
  return { alpha, beta };
}
```

To draw the line inside a viewport rectangle, intersect

\[
\alpha x+\beta y=1
\]

with the four viewport edges and keep the two valid intersection points.

---

## Optional second-side comparison

Also allow

\[
h_n^-=nu-v.
\]

This approaches \(u\) from the opposite side and produces the other extreme support line at the rational corner.

Draw both families:

\[
nu+v
\qquad\text{and}\qquad
nu-v.
\]

The two limiting support lines meet at

\[
P_u=\frac{u}{N(u)}
\]

and visually reveal the corner of the stable-norm ball.

---

## Acceptance criteria

The demo is successful when:

1. \(P_n\) visibly converges to \(P_u\).
2. The secant line always passes through both \(P_u\) and \(P_n\).
3. The displayed value
   \[
   d_n=N(nu+v)-nN(u)
   \]
   stabilizes as \(n\) grows.
4. The secant lines visibly converge to a limiting line.
5. Using both \(nu+v\) and \(nu-v\) reveals the two sides of the corner.
