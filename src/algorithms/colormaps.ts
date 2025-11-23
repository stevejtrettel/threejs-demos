/**
 * Scientific and perceptually uniform colormaps
 *
 * All functions take t ∈ [0, 1] and return a hex color number
 */

/**
 * Viridis colormap - perceptually uniform, colorblind-friendly
 * Purple → Blue → Green → Yellow
 */
export function viridis(t: number): number {
  t = Math.max(0, Math.min(1, t));

  // Viridis control points (sampled from matplotlib)
  const r = 0.267004 + t * (0.329415 + t * (1.163230 - t * 1.640820));
  const g = 0.004874 + t * (0.762373 + t * (1.423537 - t * 1.513238));
  const b = 0.329415 + t * (0.388668 + t * (0.020780 - t * 0.382813));

  return rgbToHex(r, g, b);
}

/**
 * Plasma colormap - perceptually uniform
 * Purple → Pink → Orange → Yellow
 */
export function plasma(t: number): number {
  t = Math.max(0, Math.min(1, t));

  const r = 0.050383 + t * (1.065780 + t * (0.020924 - t * 0.318298));
  const g = 0.029803 + t * (0.762373 + t * (1.423537 - t * 1.513238));
  const b = 0.527975 + t * (-0.214982 + t * (-1.654052 + t * 1.397840));

  return rgbToHex(r, g, b);
}

/**
 * Inferno colormap - perceptually uniform
 * Black → Purple → Red → Orange → Yellow
 */
export function inferno(t: number): number {
  t = Math.max(0, Math.min(1, t));

  const r = 0.001462 + t * (0.961195 + t * (1.543713 - t * 1.463943));
  const g = 0.000466 + t * (0.203430 + t * (2.103710 - t * 1.820216));
  const b = 0.013866 + t * (0.653659 + t * (0.318353 - t * 1.094894));

  return rgbToHex(r, g, b);
}

/**
 * Cool-Warm diverging colormap
 * Blue → White → Red
 * Good for showing deviations from zero
 */
export function coolWarm(t: number): number {
  t = Math.max(0, Math.min(1, t));

  // Smooth transition through white at t=0.5
  if (t < 0.5) {
    const s = t * 2;
    const r = 0.23 + s * 0.77;
    const g = 0.30 + s * 0.70;
    const b = 0.75 + s * 0.25;
    return rgbToHex(r, g, b);
  } else {
    const s = (t - 0.5) * 2;
    const r = 1.0;
    const g = 1.0 - s * 0.40;
    const b = 1.0 - s * 0.75;
    return rgbToHex(r, g, b);
  }
}

/**
 * Turbo colormap - improved rainbow
 * Blue → Cyan → Green → Yellow → Orange → Red
 * Better than HSL rainbow, perceptually more uniform
 */
export function turbo(t: number): number {
  t = Math.max(0, Math.min(1, t));

  const r = Math.max(0, Math.min(1,
    0.13572138 + t * (4.61539260 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))))
  ));

  const g = Math.max(0, Math.min(1,
    0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))))
  ));

  const b = Math.max(0, Math.min(1,
    0.10667330 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))))
  ));

  return rgbToHex(r, g, b);
}

/**
 * Grayscale colormap
 * Black → White
 */
export function grayscale(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return rgbToHex(t, t, t);
}

/**
 * HSL-based rainbow (classic but has perceptual issues)
 * Use turbo() for better rainbow
 */
export function rainbow(t: number): number {
  t = Math.max(0, Math.min(1, t));
  const hue = t * 0.85; // Stop before wrapping to red
  const r = hslToRgb(hue, 1, 0.5);
  return (r.r << 16) | (r.g << 8) | r.b;
}

/**
 * Create custom colormap from discrete colors
 * Smoothly interpolates between provided colors
 *
 * @param colors - Array of hex colors
 * @returns Function that maps t ∈ [0,1] to interpolated color
 *
 * @example
 *   const sunset = customColormap([0x1a1a4a, 0xff6b35, 0xffd23f]);
 *   const color = sunset(0.5); // Orange
 */
export function customColormap(colors: number[]): (t: number) => number {
  if (colors.length === 0) return () => 0x000000;
  if (colors.length === 1) return () => colors[0];

  return (t: number) => {
    t = Math.max(0, Math.min(1, t));

    // Find which segment we're in
    const scaled = t * (colors.length - 1);
    const idx = Math.floor(scaled);
    const frac = scaled - idx;

    if (idx >= colors.length - 1) {
      return colors[colors.length - 1];
    }

    // Interpolate between colors[idx] and colors[idx+1]
    const c1 = colors[idx];
    const c2 = colors[idx + 1];

    const r1 = (c1 >> 16) & 0xff;
    const g1 = (c1 >> 8) & 0xff;
    const b1 = c1 & 0xff;

    const r2 = (c2 >> 16) & 0xff;
    const g2 = (c2 >> 8) & 0xff;
    const b2 = c2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * frac);
    const g = Math.round(g1 + (g2 - g1) * frac);
    const b = Math.round(b1 + (b2 - b1) * frac);

    return (r << 16) | (g << 8) | b;
  };
}

/**
 * Helper: Convert RGB [0,1] to hex color
 */
function rgbToHex(r: number, g: number, b: number): number {
  const rInt = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const gInt = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const bInt = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return (rInt << 16) | (gInt << 8) | bInt;
}

/**
 * Helper: Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  const h6 = h * 6;

  if (h6 < 1) { r = c; g = x; b = 0; }
  else if (h6 < 2) { r = x; g = c; b = 0; }
  else if (h6 < 3) { r = 0; g = c; b = x; }
  else if (h6 < 4) { r = 0; g = x; b = c; }
  else if (h6 < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

/**
 * Pre-made colormap collection
 */
export const Colormaps = {
  viridis,
  plasma,
  inferno,
  coolWarm,
  turbo,
  grayscale,
  rainbow,
  customColormap
} as const;
