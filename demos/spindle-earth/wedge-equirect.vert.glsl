varying vec3 vWorldNormal;

void main() {
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
}
