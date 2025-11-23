/**
 * Inferno colormap (GLSL)
 * Perceptually uniform, dark background friendly
 * Black -> Purple -> Orange -> Yellow
 *
 * @param t - Value in range [0, 1]
 * @returns RGB color
 */
vec3 inferno(float t) {
  t = clamp(t, 0.0, 1.0);

  float r = 0.001462 + t * (0.354580 + t * (3.553005 + t * (-9.219393 + t * (9.693872 - t * 3.5))));
  float g = 0.000466 + t * (0.206756 + t * (1.109628 + t * (-3.168896 + t * (4.512265 - t * 2.5))));
  float b = 0.013866 + t * (1.126992 + t * (-2.755415 + t * (5.168534 + t * (-5.863076 + t * 2.5))));

  return vec3(r, g, b);
}
