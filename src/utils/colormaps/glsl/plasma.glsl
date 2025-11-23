/**
 * Plasma colormap (GLSL)
 * Perceptually uniform, high contrast
 * Purple -> Pink -> Orange -> Yellow
 *
 * @param t - Value in range [0, 1]
 * @returns RGB color
 */
vec3 plasma(float t) {
  t = clamp(t, 0.0, 1.0);

  float r = 0.050383 + t * (0.759486 + t * (3.427291 + t * (-8.903461 + t * (10.221717 - t * 4.0))));
  float g = 0.029803 + t * (0.278443 + t * (0.753308 + t * (-1.888724 + t * (2.518137 - t * 1.5))));
  float b = 0.527975 + t * (1.477843 + t * (-4.960887 + t * (10.558896 + t * (-11.913923 + t * 5.0))));

  return vec3(r, g, b);
}
