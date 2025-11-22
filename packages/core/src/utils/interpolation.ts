/**
 * Interpolation and easing functions
 *
 * All functions take t ∈ [0, 1] unless otherwise noted
 */

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value to range [min, max]
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map value from one range to another
 */
export function remap(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  const t = (value - fromMin) / (fromMax - fromMin);
  return lerp(toMin, toMax, t);
}

/**
 * Smoothstep interpolation (cubic Hermite)
 * Smooth ease in/out with zero derivatives at endpoints
 */
export function smoothstep(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Smootherstep interpolation (quintic)
 * Even smoother than smoothstep, zero first and second derivatives at endpoints
 */
export function smootherstep(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Cubic interpolation between four points
 * Uses Catmull-Rom spline
 *
 * @param p0 - Point before start
 * @param p1 - Start point
 * @param p2 - End point
 * @param p3 - Point after end
 * @param t - Parameter [0,1]
 */
export function cubicInterpolate(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;

  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Ease in (quadratic)
 */
export function easeInQuad(t: number): number {
  return t * t;
}

/**
 * Ease out (quadratic)
 */
export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

/**
 * Ease in/out (quadratic)
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Ease in (cubic)
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * Ease out (cubic)
 */
export function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

/**
 * Ease in/out (cubic)
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

/**
 * Ease in (sine)
 */
export function easeInSine(t: number): number {
  return 1 - Math.cos(t * Math.PI / 2);
}

/**
 * Ease out (sine)
 */
export function easeOutSine(t: number): number {
  return Math.sin(t * Math.PI / 2);
}

/**
 * Ease in/out (sine)
 */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * Ease in (exponential)
 */
export function easeInExpo(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
}

/**
 * Ease out (exponential)
 */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Ease in/out (exponential)
 */
export function easeInOutExpo(t: number): number {
  if (t === 0 || t === 1) return t;
  if (t < 0.5) {
    return Math.pow(2, 20 * t - 10) / 2;
  }
  return (2 - Math.pow(2, -20 * t + 10)) / 2;
}

/**
 * Elastic ease out (overshoots and bounces back)
 */
export function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 :
    Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/**
 * Bounce ease out
 */
export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * Collection of easing functions
 */
export const Easing = {
  linear: (t: number) => t,
  smoothstep,
  smootherstep,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeOutElastic,
  easeOutBounce
} as const;
