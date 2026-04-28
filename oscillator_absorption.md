---
title: "Oscillators and Overtones"
date: '2026-04-28'
description: "The linear and nonlinear story of light absorption in 1D"
draft: true
featured: false
tags:
  - physics
  - differential equations
subject:
  - differential equations
---


It's a goal of mine to eventually understand why water is blue, and this post is one in a collection of related ideas working toward that.

The linear theory of molecular vibration is beautiful. Model a molecule as point masses sitting at a minimum of a potential $V$, approximate $V$ by its quadratic part, and the equations of motion become a coupled system of simple harmonic oscillators with a finite list of normal frequencies $\omega_1, \omega_2, \ldots$.

But from here, we need to know what frequencies of light can be absorbed. It's tempting to guess that the $\omega$ themselves are the absorption frequencies, but are there others? What about frequencies nearby to $\omega$, or integer multiples of them? To sort this out, we need a definition of absorption — which requires thinking carefully through the interaction of the system with its environment.

Also, I've heard the color of water actually comes from *nonlinearities*, effects the linear theory cannot see. So once we have absorption defined and computed in the linear case, we should ask: how do nonlinear corrections to $V$ change the picture?

<!-- This post takes up both questions in the simplest setting where they make sense — a single oscillator, treated classically. -->


## Modeling absorption

We will work with the simplest classical *toy model* of a material: a single point mass on a line, moving under a potential energy $V \colon \mathbb R \to \mathbb R$ with a non-degenerate minimum. There is no electromagnetic field, no quantum mechanics, no thermal bath — just a particle in a one-dimensional potential well. This is a less-than-honest model of any real material, but it is enough to set up the question we want to ask: *what does it mean for such a system to absorb light?*

Newton's second law gives

$$
\ddot x \;=\; -V'(x).
$$

*(We work in dimensionless units throughout: $m = 1$, equilibrium at $x = 0$ with $V(0) = V'(0) = 0$ and $V''(0) = 1$.)*

The dynamics near equilibrium are governed by this single ODE; everything that follows is built on top of it.

### Light as a forcing term

To ask whether the system absorbs light at frequency $\omega$, we need to model what "shining light" means. Our toy model is to simple to derive this from electromagnetism, and we simply posit light enters the equation of motion as a time-dependent external force at frequency $\omega$:

$$
\ddot x \;=\; -V'(x) \;+\; A \cos(\omega t).
$$

The crucial new feature is that the right-hand side now depends explicitly on $t$. The system is no longer autonomous. The amplitude $A$ is set by the strength of the incoming wave; the frequency $\omega$ is the parameter we get to vary. Absorption becomes a question about the *driven* system: how does it respond as $\omega$ changes?

### Dissipation

Our equation $\ddot x = -V'(x) + A\cos(\omega t)$ is incomplete as a model of a real material. A real molecule is never isolated: it collides with neighbors, it reradiates into the electromagnetic field, and it couples to its own internal degrees of freedom that the "point mass" abstraction hides. Each of these is a channel through which energy leaks away from our oscillator.

A fully honest model would couple our coordinate $x$ to every variable describing every one of these channels. This is hopeless. We would be modeling the entire environment to ask a single question about a single oscillator. So we adopt an *effective* description: the cumulative effect of the unmodeled world is summarized by a single phenomenological term $f(x, \dot x)$ that drains energy from our oscillator. Two structural constraints narrow down the form of $f$ before we have to choose anything specific.

**The drag cannot depend on $x$ alone.** A force depending only on position is conservative — it can be absorbed into the potential, and the system still enjoys energy conservation. Such a term cannot dissipate any energy; it just reshapes the potential well. So dissipation requires the force to depend on velocity.

**The drag shouldn't depend on $x$ at all.** If we assume that the environment around the molecule is homogeneous, the same environmental disappation factors occur no matter where the particle is.  So the drag force should be independent of $x$, a function $f(\dot{x})$ of velocity alone.

**The drag must extract energy.** This is the substantive constraint. The work done by $-f(\dot x)$ on the oscillator over a time $dt$ is $-f(\dot x)\,\dot x\, dt$. For the term to remove energy at every instant — the meaning we want for "dissipative" — we require

$$
f(\dot x)\,\dot x \;\geq\; 0 \qquad \text{for all } \dot x,
$$

with equality only at $\dot x = 0$. This forces $f(0) = 0$ and $f$ to have the same sign as $\dot x$.

Taylor expanding $f$ around zero,

$$
f(\dot x) \;=\; a_1 \dot x \,+\, a_2\dot x^2 \,+\, a_3 \dot x^3 \,+\, \cdots,
$$

the dissipativity inequality near $\dot x = 0$ forces the leading nonzero term to be at an *odd* power with positive coefficient: were the leading term $a_2 \dot x^2$, we would have $f(\dot x)\dot x \sim a_2 \dot x^3$ near zero, sign-indefinite. So at leading order,

$$
f(\dot x) \;\approx\; 2\gamma\, \dot x, \qquad \gamma > 0.
$$

Higher-order corrections to $f$ are present in general, but matter only at large amplitudes. For small-amplitude motion every dissipative mechanism contributes the same leading $2\gamma \dot x$. We keep only this leading term. The equation of motion becomes

$$
\boxed{
\ddot x \;+\; 2\gamma\, \dot x \;=\; -V'(x) \;+\; A \cos(\omega t).}
$$



### The absorption spectrum

We are now ready to define what we mean by absorption. The total mechanical energy of the oscillator at any moment is

$$
E(t) \;=\; \tfrac12 \dot x^2 \,+\, V(x).
$$

Differentiating along a solution and using $\ddot x + V'(x) = -2\gamma\dot x + A\cos(\omega t)$,

$$
\frac{dE}{dt} \;=\; \dot x\,\bigl(\ddot x + V'(x)\bigr) \;=\; -2\gamma\,\dot x^2 \,+\, A\cos(\omega t)\cdot \dot x.
$$

The two terms on the right have natural physical interpretations: $-2\gamma\dot x^2$ is the rate at which damping does work on the oscillator (always non-positive, by construction), and $A\cos(\omega t)\cdot\dot x$ is the rate at which the driver does work.

We want a single absorption rate per drive frequency $\omega$. The instantaneous rates fluctuate, but if the system reaches a steady state — a long-time behavior in which the average energy is constant — then time-averaging $dE/dt$ over the steady state gives zero, and the two rates balance.

For any bounded function $f \colon \mathbb R \to \mathbb R$ admitting a long-time average, write

$$
\langle f \rangle \;:=\; \lim_{T \to \infty} \frac{1}{T}\int_0^T f(t)\, dt.
$$

When $f$ is periodic with period $T_0$ this reduces to a single-period integral, $\langle f \rangle = \frac{1}{T_0}\int_0^{T_0} f(t)\,dt$. For our periodic steady states $T_0 = 2\pi/\omega$, and this single-period form is what we actually compute.

Whether such a steady state exists is a real question. The linear oscillator always reaches one — every solution converges exponentially to a unique periodic attractor, because $\gamma > 0$. For nonlinear potentials this is no longer automatic. For now we assume the steady state exists, with the understanding that we will revisit the assumption when it breaks.

In steady state, $\langle dE/dt\rangle = 0$, so

$$
\bigl\langle 2\gamma \dot x^2 \bigr\rangle \;=\; \bigl\langle A\cos(\omega t)\cdot\dot x \bigr\rangle.
$$

Both sides equal the rate at which energy flows through the system in steady state — in from the driver, out through the dissipation channel. This common rate, viewed as a function of drive frequency, is the central object of the post:

> *The **absorption spectrum** at drive frequency $\omega$ is the long-time-averaged rate of energy throughput,*
> $$P_{\text{abs}}(\omega) \;:=\; \lim_{T \to \infty} \frac{1}{T}\int_0^T 2\gamma\, \dot x(t)^2 \, dt \;=\; \lim_{T \to \infty} \frac{1}{T}\int_0^T A\cos(\omega t)\,\dot x(t)\, dt,$$
> *with $\dot x$ the velocity in the steady-state solution at drive frequency $\omega$.*

The first integrand is the rate at which damping removes energy; the second is the rate at which the driver supplies it. In steady state they balance and the two long-time averages coincide. The first form is closer to the conceptual definition (energy out through the dissipation channel); the second is closer to what an experimentalist would measure (time-averaged power from the source). We will use whichever fits.

### The framework

The setup, in full, is

$$
\boxed{
\begin{gathered}
\ddot x \;+\; 2\gamma \dot x \;=\; -V'(x)  \;+\; A \cos(\omega t) \\
P_{\text{abs}}(\omega) \;=\; \bigl\langle 2\gamma \dot x^2 \bigr\rangle
\end{gathered}
}
$$

Three ingredients in: a potential $V$ encoding the system's internal dynamics, a dissipation rate $\gamma > 0$ encoding the strength of coupling to the unmodeled environment, and a driving force at frequency $\omega$ and amplitude $A$. One function out: the absorption spectrum, computed from the steady-state solution. The framework is general: it does not assume $V$ is quadratic or smooth, it does not assume small amplitudes, and it does not assume any particular relationship between drive and natural frequencies.

The rest of this post applies the recipe in two cases — first $V(x) = \tfrac12 x^2$, where everything can be computed in closed form, and then a nonlinear modification, where new features appear in the spectrum that the linear theory misses.


## The linear oscillator

The simplest non-trivial choice of potential is the quadratic one, $V(x) = \tfrac12 x^2$, for which the equation of motion reads

$$
\ddot x \,+\, 2\gamma\, \dot x \,+\, x \;=\; A \cos(\omega t).
$$

Writing $L := \partial_t^2 + 2\gamma\, \partial_t + 1$, the equation is

$$
L\,x \;=\; A\cos(\omega t).
$$

### Solving the equation

The operator $L$ is a polynomial in $\partial_t$, so it is diagonalized by exponentials: for any $\lambda \in \mathbb C$,

$$
L\, e^{\lambda t} \;=\; p(\lambda)\, e^{\lambda t}, \qquad p(\lambda) \;:=\; \lambda^2 + 2\gamma\lambda + 1.
$$

The kernel of $L$ and a particular solution both follow from this single fact.

**The kernel.** The kernel consists of $e^{\lambda t}$ with $p(\lambda) = 0$, i.e., $\lambda_\pm = -\gamma \pm \sqrt{\gamma^2 - 1}$. The qualitative regime depends on $\gamma$:

- *Underdamped* ($\gamma < 1$): $\lambda_\pm = -\gamma \pm i\sqrt{1 - \gamma^2}$, decaying oscillations.
- *Overdamped* ($\gamma > 1$): both roots real and negative, pure exponential decay.
- *Critically damped* ($\gamma = 1$): a double root $\lambda = -1$, kernel spanned by $e^{-t}$ and $t e^{-t}$.

Since $\gamma > 0$, every kernel element has $\mathrm{Re}\,\lambda < 0$ and decays exponentially. These are *transients* — solution components that depend on initial conditions but are washed out at long times — and they will not contribute to the absorption spectrum.

**A particular solution.** To invert $L$ on the drive $A\cos(\omega t)$, decompose into exponentials: $\cos(\omega t) = \tfrac12(e^{i\omega t} + e^{-i\omega t})$. These are eigenfunctions with $\lambda = ik$ and eigenvalue $p(ik) = (1-k^2) + 2i\gamma k$, so $L^{-1}$ acts on a function with Fourier support $\{k_n\}$ by multiplying each component by the **linear response function**

$$
\chi(k) \;:=\; \frac{1}{p(ik)} \;=\; \frac{1}{(1-k^2) + 2i\gamma k}, \qquad k \in \mathbb R.
$$

We use $\chi$ at $k = \omega$ in this section, and at other values of $k$ when the nonlinearity mixes frequencies. *This function is the workhorse of the entire post.*

Applying this to the drive,

$$
x_p(t) \;=\; \tfrac{A}{2}\, \chi(\omega)\, e^{i\omega t} \,+\, \tfrac{A}{2}\, \overline{\chi(\omega)}\, e^{-i\omega t} \;=\; A\,\mathrm{Re}\bigl(\chi(\omega)\, e^{i\omega t}\bigr).
$$

**The steady state.** The full solution is $x_p$ plus a transient. The transient decays; the periodic part survives. The steady state is

$$
x_{\text{ss}}(t) \;=\; A\,\mathrm{Re}\bigl(\chi(\omega)\, e^{i\omega t}\bigr)
$$

regardless of initial conditions, and this is what $P_{\text{abs}}$ is computed from.

> **Demo 1.** Solutions $x(t)$ vs $t$ for adjustable initial conditions $(x(0), \dot x(0))$ set by clicking and dragging in a small phase-space box; sliders for $\gamma$ and $\omega$. The steady state is drawn as a dashed reference. Whatever initial condition you pick, every trajectory collapses onto the same steady-state curve.

### The absorption spectrum

> **Demo 2.** The drive $A\cos(\omega t)$ and the steady-state response $x_{\text{ss}}(t)$ on the same axes, with sliders for $\gamma$ and $\omega$. As $\omega$ sweeps through $1$, watch the lag between them rotate from $0$ (in-phase) through $\pi/2$ (quadrature) to $\pi$ (anti-phase), with the response amplitude swelling at resonance.

The lag is what powers absorption. Writing $\chi(\omega) = |\chi(\omega)|\, e^{-i\varphi(\omega)}$, the steady state decomposes into pieces in-phase and out-of-phase with the drive:

$$
x_{\text{ss}}(t) \;=\; \underbrace{A|\chi|\, \cos\varphi\, \cos\omega t}_{\text{in-phase}} \;+\; \underbrace{A|\chi|\, \sin\varphi\, \sin\omega t}_{\text{out-of-phase}}.
$$

The in-phase piece's *velocity* is proportional to $\sin\omega t$, orthogonal to the drive $\cos\omega t$ — the driver does zero net work against it on time average. The out-of-phase piece's velocity is proportional to $\cos\omega t$, in step with the drive — the driver does net work against it. So absorption is driven entirely by $\sin\varphi$, which is maximized at $\omega = 1$ where $\varphi = \pi/2$ exactly.

For the explicit formula, work on the dissipation side. The steady-state velocity is $\dot x_{\text{ss}}(t) = A\,\mathrm{Re}\bigl(i\omega\, \chi(\omega)\, e^{i\omega t}\bigr)$, and for any $z \in \mathbb C$, $\langle \mathrm{Re}(z\,e^{i\omega t})^2\rangle = \tfrac12 |z|^2$, so

$$
P_{\text{abs}}(\omega) \;=\; \langle 2\gamma\,\dot x_{\text{ss}}^2\rangle \;=\; A^2\, \gamma\, \omega^2\, |\chi(\omega)|^2 \;=\; \frac{A^2\, \gamma\, \omega^2}{(1-\omega^2)^2 \,+\, 4\gamma^2\, \omega^2}.
$$

A single peak at $\omega = 1$, vanishing at $\omega = 0$, decaying as $\omega^{-2}$ for $\omega \to \infty$, narrowing and growing tall as $\gamma$ shrinks.

Without damping, $\chi$ would be real-valued: $\varphi$ would jump from $0$ to $\pi$ at $\omega = 1$ and $\sin\varphi$ would vanish elsewhere, with no absorption at any frequency.

> **Demo 3.** The steady state $x_{\text{ss}}(t)$ together with the instantaneous dissipation rate $2\gamma\,\dot x_{\text{ss}}(t)^2$ as a shaded curve below; a bar to the right shows the time-average of that curve over one period — i.e., $P_{\text{abs}}$ at this $\omega$. As $\omega$ varies, the bar height traces out the absorption spectrum one frequency at a time.

### A conservation law

> **Demo 4.** $P_{\text{abs}}(\omega)$ vs $\omega$, with a slider for $\gamma$. Shrink $\gamma$ to watch the peak narrow and grow tall in exact compensation. A second curve shows the running integral $\int_0^{\omega} P_{\text{abs}}$, which converges to the same value regardless of $\gamma$.

The integral $\int_0^\infty P_{\text{abs}}\, d\omega$ is independent of $\gamma$. By contour integration,

$$
\int_0^\infty P_{\text{abs}}(\omega)\, d\omega \;=\; \frac{\pi A^2}{4}.
$$

> *The position of the peak is fixed at $\omega = 1$ by the conservative dynamics, the width is set by the dissipation ($\gamma$), and the integrated strength by the drive amplitude ($A^2$). The three are independent.*

This is the classical limit of the Thomas–Reiche–Kuhn sum rule from quantum spectroscopy, which says that the integrated oscillator strength over all transitions is determined by the *coupling* between the system and the radiation field, not by the system's internal dynamics or its environment. The classical statement above is the same fact in toy form: total absorption is set at the source, not by what happens to the energy once it is in the system.

What we have learned: in the linear theory, a single oscillator absorbs light in a Lorentzian peak centered at the natural frequency $\omega = 1$. Of the options floated in the intro: the natural frequency is the peak location, but absorption is not concentrated there — the Lorentzian has finite width, so nearby frequencies contribute too. Integer multiples and integer fractions, by contrast, are unremarkable; the spectrum decays smoothly through them.


## Adding nonlinearity

The linear theory gives a clean answer for absorption, but it rests on a strong assumption: that $V$ is purely quadratic. Real materials are anharmonic — the harmonic approximation is just the leading-order behavior near equilibrium. The question is: what does anharmonicity add to the spectrum?

Symmetry sharply constrains where to start. Many physical systems have a reflection symmetry that forbids odd terms in $V$: homonuclear diatomics like $\text{O}_2$ or $\text{N}_2$ (interchange of atoms), the bending modes of symmetric triatomics like $\text{CO}_2$, and $\phi^4$ field theory. For all of these, the cubic correction in $V$ vanishes identically and the leading anharmonicity is quartic.

### The model

We take the simplest symmetric anharmonic potential:

$$
V(x) \;=\; \tfrac12 x^2 \,+\, \tfrac14\, \epsilon\, x^4, \qquad \epsilon \geq 0.
$$

Its equation of motion is the linear equation of the previous section, with one new term on the left:

$$
\ddot x \,+\, 2\gamma\, \dot x \,+\, x \,+\, \epsilon\, x^3 \;=\; A\cos(\omega t).
$$

This is the **Duffing equation**. At $\epsilon = 0$ we recover the linear theory exactly. For $\epsilon \geq 0$ the potential is bounded below, so trajectories cannot escape to infinity. (The asymmetric case — a cubic correction — is parallel and handled in a follow-up post.)

The Duffing equation does not admit a closed-form solution for $\epsilon \neq 0$. So, we begin our exploration numerically.

> **Demo 5.** $x(t)$ vs $t$ for the Duffing oscillator integrated from rest, with sliders for $\gamma, \omega, \epsilon, A$. The linear ($\epsilon = 0$) trajectory is drawn dashed for comparison.

A few observations as we explore. Transients still decay onto a steady state — the linear damping is unaffected by the added cubic term. But the steady state is no longer sinusoidal: the waveform is visibly distorted, peaks sharper than troughs or vice versa. And as we sweep $\omega$, something unexpected happens around $\omega \approx 1/3$: the steady-state amplitude grows much larger than at neighboring frequencies, an apparent resonance away from the natural frequency $\omega = 1$.

Something is special about $\omega = 1/3$, and the time-domain trajectory does not by itself say what. We want a sharper view of the steady state.

### Fourier content of the steady state

The natural sharper view is Fourier. The steady state is periodic with period $2\pi/\omega$, so it admits an expansion as a sum of integer harmonics of the drive,

$$
x_{\text{ss}}(t) \;=\; \sum_{k \in \mathbb Z} c_k\, e^{ik\omega t},
$$

and the amplitudes $|c_k|$ tell us what frequencies are actually present in the response.

> **Demo 6.** Fourier amplitudes $|c_k|$ of the steady-state response on a log scale, where the drive sits at $k = \pm 1$ and $k$ ranges over the integer harmonics. Sliders for $\gamma, \omega, \epsilon, A$.

Three observations as we slide:

1. **Only odd $k$ appear.** Even-$k$ amplitudes sit at machine precision regardless of the parameters. The response respects the symmetry $x \to -x$ of the equation, exactly.

2. **Cascade.** At $\epsilon = 0$, only $k = \pm 1$ has nonzero weight (the steady state is a pure cosine at the drive frequency). Turning $\epsilon$ on, the bars at $k = \pm 3$ light up; at larger $\epsilon$, $k = \pm 5$ joins them, then $k = \pm 7$, and so on. Each new harmonic is fainter than the last.

3. **Resonant amplification.** At fixed $\epsilon$, sweeping $\omega$ through $1/3$ makes the $k = \pm 3$ amplitudes grow dramatically — much more than the $k = \pm 1$ amplitude does. Sweeping through $\omega = 1/5$, the $k = \pm 5$ amplitudes do the same. The higher harmonics get large precisely when their frequency $k\omega$ matches the linear resonance at $1$.

The picture is qualitative but firm: the response contains odd-integer harmonics of the drive, the higher ones get amplified when their frequency hits the linear resonance, and that amplification is what makes the whole steady state grow when $\omega$ is near $1/k$ for some odd $k$.

### The absorption spectrum

Numerically averaging $2\gamma \dot x^2$ over a steady-state period and sweeping across $\omega$ traces out the absorption spectrum.

> **Demo 7.** $P_{\text{abs}}(\omega)$ vs $\omega$ for the Duffing oscillator, with sliders for $\gamma, \epsilon, A$. The linear ($\epsilon = 0$) spectrum is drawn dashed for comparison.

For $\epsilon = 0$ we recover the Lorentzian peak at $\omega = 1$ from the previous section. Turning $\epsilon$ on, two changes are visible:

- **The original peak shifts and bends.** What was a symmetric Lorentzian around $\omega = 1$ becomes asymmetric, with the maximum moving to slightly higher $\omega$ and the falloff stretching out on one side. At larger $\epsilon$ the asymmetry becomes severe.

- **New peaks appear at $\omega = 1/3, 1/5, 1/7, \ldots$** — at the odd integer fractions of the linear resonance. None of these were in the linear theory; the linear spectrum decayed smoothly through them. The new peaks are narrower than the linear peak, shorter, and grow with $\epsilon$, fainter for higher $k$.

These are the same observations as in the previous subsection, viewed differently. When the $k$th harmonic of the response gets large at $\omega = 1/k$, the energy throughput rises with it; the new peaks in $P_{\text{abs}}$ are the energetic shadow of the resonant Fourier cascade.

**The empirical-fact list.** Putting everything together, the numerical exploration gives the following picture for the next section to explain:

1. The steady state is periodic with period $2\pi/\omega$.
2. Its Fourier content is supported on odd integer multiples of $\omega$.
3. As $\epsilon$ grows, weight cascades from $\pm \omega$ to $\pm 3\omega$, $\pm 5\omega$, and beyond, with each new harmonic fainter than the last.
4. Peaks in the absorption spectrum sit at $\omega = 1, 1/3, 1/5, \ldots$ — at every odd integer fraction of the linear resonance, and nowhere else.
5. The peak at $\omega = 1$ shifts and bends asymmetrically as $\epsilon$ grows.
6. The new peaks are narrower than the linear peak and grow with $\epsilon$.

We turn to perturbation theory.

---

### Appendix: dimensional dictionary

The dimensionless equation $\ddot x + 2\gamma\dot x + V'(x) = A\cos(\omega t)$ corresponds to the dimensional equation

$$
M\,\ddot X \,+\, 2\,\Gamma\, \dot X \,+\, M\,\Omega_0^2\, X \,+\, \cdots \;=\; F\cos(\Omega\, T)
$$

(with $\cdots$ standing in for whatever nonlinear part is present) under the identifications

$$
t \;=\; \Omega_0\, T, \quad x \;=\; \frac{M\,\Omega_0^2}{F}\, X, \quad \gamma \;=\; \frac{\Gamma}{M\,\Omega_0}, \quad \omega \;=\; \frac{\Omega}{\Omega_0}, \quad A \;=\; 1,
$$

where $M$ is mass, $\Omega_0$ the natural frequency, $\Gamma$ the dimensional drag coefficient, $F$ the dimensional drive amplitude, and $\Omega$ the dimensional drive frequency. (Capital letters are dimensional; lowercase are our dimensionless versions throughout the post.) The dimensionless absorption spectrum and the dimensional one are related by

$$
P_{\text{abs}}^{\text{dim}}(\Omega) \;=\; \frac{F^2}{M\, \Omega_0}\, P_{\text{abs}}(\Omega/\Omega_0).
$$

Concretely, the dimensional Lorentzian and the integrated-absorption sum rule read

$$
P_{\text{abs}}^{\text{dim}}(\Omega) \;=\; \frac{F^2}{M}\,\cdot\, \frac{\Gamma\, \Omega^2}{(\Omega_0^2 - \Omega^2)^2 \,+\, 4\Gamma^2\, \Omega^2}, \qquad \int_0^\infty P_{\text{abs}}^{\text{dim}}(\Omega)\, d\Omega \;=\; \frac{\pi F^2}{4M},
$$

which we will not need anywhere in the body of the post.
