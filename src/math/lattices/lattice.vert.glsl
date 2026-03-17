varying vec2 vWorldPos;

void main() {
    // Use the local position (before model transform) so the lattice
    // coordinates are always in the plane's own xy, regardless of how
    // the mesh is rotated in the scene.
    vWorldPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
