// Two-level anti-aliased grid shader for parametric surfaces.
// Coarse grid + finer subdivision grid, composited over a fill color.

uniform float uGridCount;  // coarse cells per axis (e.g. 10)
uniform float uLineWidth;  // coarse line half-width in UV space
uniform float uSubCount;   // fine cells per coarse cell (e.g. 5)
uniform float uSubWidth;   // fine line half-width
uniform vec3  uGridColor;
uniform vec3  uSubColor;
uniform vec3  uFillColor;

float gridLine(vec2 uv, float count, float width) {
  vec2 cell = fract(uv * count);
  vec2 fw = fwidth(uv * count);
  float lU = 1.0 - smoothstep(width - fw.x, width + fw.x, cell.x)
                  * smoothstep(width - fw.x, width + fw.x, 1.0 - cell.x);
  float lV = 1.0 - smoothstep(width - fw.y, width + fw.y, cell.y)
                  * smoothstep(width - fw.y, width + fw.y, 1.0 - cell.y);
  return max(lU, lV);
}

void main() {
  float coarse = gridLine(vMapUv, uGridCount, uLineWidth);
  float fine   = gridLine(vMapUv, uGridCount * uSubCount, uSubWidth);

  // Layer: fill -> fine grid -> coarse grid
  vec3 color = mix(uFillColor, uSubColor, fine);
  color = mix(color, uGridColor, coarse);
  csm_DiffuseColor = vec4(color, 1.0);
}
