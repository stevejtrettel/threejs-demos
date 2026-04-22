// Multi-scale coordinate grid overlay.
// Returns a float intensity suitable for additive blending onto a base color.
float coordGrid(vec2 uv, float scale) {
    float spacing = 3.14159265 * scale;
    float grid1 = (1.0 - pow(abs(sin(spacing * uv.x) * sin(10.0 * 3.14159265 * uv.y)), 0.1)) / 10.0;
    float grid2 = (1.0 - pow(abs(sin(5.0 * spacing * uv.x) * sin(50.0 * 3.14159265 * uv.y)), 0.1)) / 25.0;
    float grid3 = (1.0 - pow(abs(sin(10.0 * spacing * uv.x) * sin(100.0 * 3.14159265 * uv.y)), 0.1)) / 50.0;
    return grid1 + grid2 + grid3;
}
