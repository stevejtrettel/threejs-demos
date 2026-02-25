// Wedge equirectangular texture mapping
// Maps a wedge of the equirect texture onto a surface of revolution,
// using only a fraction uSinAlpha of the longitude range.
// This gives the correct isometric map from the sphere to a K=+1 spindle.

uniform sampler2D uDay;
uniform sampler2D uNight;
uniform float a;
uniform vec3 uLightDir;



varying vec3 vWorldNormal;

void main() {
    vec2 uv = vMapUv;
    uv.x *= a;

    vec4 dayColor = texture2D(uDay, uv);
    vec4 nightColor = texture2D(uNight, uv);

    float NdotL = dot(normalize(vWorldNormal), normalize(uLightDir));
    float dayFactor = smoothstep(-0.2, 0.2, NdotL);

    csm_DiffuseColor = mix(nightColor, dayColor, dayFactor);
}
