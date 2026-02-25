// Equirectangular texture mapping
// Samples a texture using the surface UV coordinates directly.

uniform sampler2D uMap;
uniform float a;

void main() {
    vec2 uv = vMapUv;
    uv.x *= a;
    csm_DiffuseColor = texture2D(uMap, uv);
}
