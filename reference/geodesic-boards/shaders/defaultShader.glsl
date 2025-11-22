
varying vec3 vPosition;

void main() {
    vec3 baseColor = vec3(0.5,0.6,vPosition.z);
    csm_DiffuseColor = vec4(baseColor, 1.0);
}
