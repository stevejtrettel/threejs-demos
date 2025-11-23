/**
 * Viridis colormap (GLSL)
 * Perceptually uniform, colorblind-friendly
 * Blue -> Green -> Yellow
 *
 * @param t - Value in range [0, 1]
 * @returns RGB color
 */
vec3 viridis(float t) {
  t = clamp(t, 0.0, 1.0);

  float r = 0.267004 + t * (0.329415 + t * (3.408124 + t * (-9.555742 + t * (10.891033 - t * 5.0))));
  float g = 0.004874 + t * (0.426331 + t * (2.227228 + t * (-5.469903 + t * (6.046136 - t * 2.642517))));
  float b = 0.329415 + t * (1.570919 + t * (-4.462119 + t * (8.786157 + t * (-10.624373 + t * 4.987208))));

  return vec3(r, g, b);
}
