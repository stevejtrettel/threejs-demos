/**
 * Rainbow colormap (GLSL)
 * HSV-based rainbow
 * Red -> Yellow -> Green -> Cyan -> Blue -> Magenta -> Red
 *
 * Note: Not perceptually uniform, use with caution.
 * Consider viridis/plasma for scientific visualization.
 *
 * @param t - Value in range [0, 1]
 * @returns RGB color
 */
vec3 rainbow(float t) {
  t = clamp(t, 0.0, 1.0);

  float h = t * 6.0; // 0-6 for full hue cycle
  float c = 1.0;
  float x = c * (1.0 - abs(mod(h, 2.0) - 1.0));

  vec3 rgb;
  if (h < 1.0) rgb = vec3(c, x, 0.0);
  else if (h < 2.0) rgb = vec3(x, c, 0.0);
  else if (h < 3.0) rgb = vec3(0.0, c, x);
  else if (h < 4.0) rgb = vec3(0.0, x, c);
  else if (h < 5.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);

  return rgb;
}
