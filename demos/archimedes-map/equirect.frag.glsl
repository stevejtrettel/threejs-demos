// Equirectangular texture mapping
// Samples a texture using the surface UV coordinates directly.
// For a sphere parameterized by (longitude, latitude), this gives
// standard equirectangular projection.

uniform sampler2D uMap;

void main() {
    csm_DiffuseColor = texture2D(uMap, vMapUv);
}
