// Equirectangular texture mapping
// Samples a texture using the surface UV coordinates directly.

uniform sampler2D uMap;

void main() {
    csm_DiffuseColor = texture2D(uMap, vMapUv);
}
