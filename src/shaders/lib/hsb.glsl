// HSB to RGB conversion (Inigo Quilez)
// h, s, b all in [0, 1]; h wraps periodically.
vec3 hsb2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    rgb = rgb * rgb * (3.0 - 2.0 * rgb); // smoothstep
    return c.z * mix(vec3(1.0), rgb, c.y);
}
