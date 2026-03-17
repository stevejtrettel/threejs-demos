// Draws an anti-aliased grid on the surface using UV coordinates.

uniform float uGridCount;  // cells per axis (e.g. 10)
uniform float uLineWidth;  // line half-width in UV space
uniform vec3  uGridColor;
uniform vec3  uFillColor;

void main() {
  vec2 cell = fract(vMapUv * uGridCount);

  // Anti-aliased grid lines via smoothstep + fwidth
  vec2 fw = fwidth(vMapUv * uGridCount);
  float lineU = 1.0 - smoothstep(uLineWidth - fw.x, uLineWidth + fw.x, cell.x)
                     * smoothstep(uLineWidth - fw.x, uLineWidth + fw.x, 1.0 - cell.x);
  float lineV = 1.0 - smoothstep(uLineWidth - fw.y, uLineWidth + fw.y, cell.y)
                     * smoothstep(uLineWidth - fw.y, uLineWidth + fw.y, 1.0 - cell.y);
  float line = max(lineU, lineV);

  vec3 color = mix(uFillColor, uGridColor, line);
  csm_DiffuseColor = vec4(color, 1.0);
}
