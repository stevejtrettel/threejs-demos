import * as THREE from 'three';

/**
 * Vertex shader for cubemap to equirectangular conversion
 * Passes through UVs for the fullscreen quad
 */
const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Fragment shader for cubemap to equirectangular conversion
 * Converts UV coordinates to 3D direction and samples the cubemap
 */
const fragmentShader = `
#define PI 3.14159265359

uniform samplerCube tCube;
varying vec2 vUv;

void main() {
  // Convert equirectangular UV to spherical coordinates
  // Flip V to match expected orientation (origin at top)
  // Offset phi by +90° to correct rotation
  float phi = vUv.x * 2.0 * PI + PI * 0.5;  // Longitude: π/2 to 5π/2 (rotated 90° CW)
  float theta = (1.0 - vUv.y) * PI;         // Latitude: 0 to π (top to bottom)

  // Convert spherical to Cartesian direction vector
  // theta=0 is +Y (top), theta=π is -Y (bottom)
  // Adjust direction to match Three.js cubemap orientation
  vec3 dir = vec3(
    -sin(theta) * sin(phi),  // X - negated to fix left/right flip
    cos(theta),              // Y
    sin(theta) * cos(phi)    // Z
  );

  // Sample the cubemap using the direction vector
  // textureCube preserves HDR values from the cubemap
  gl_FragColor = textureCube(tCube, dir);
}
`;

/**
 * Convert a cubemap texture to equirectangular format
 *
 * This is essential for pathtracer support, which requires equirectangular
 * environment maps for importance sampling. The conversion preserves HDR
 * values by using floating-point render targets.
 *
 * @param renderer - WebGL renderer to use for conversion
 * @param cubemap - Source cubemap texture (can be from CubeCamera, etc.)
 * @param resolution - Height of output equirect (width will be 2x this)
 * @returns Equirectangular texture with HDR values preserved
 *
 * @example
 *   // Convert a cubemap from a CubeCamera
 *   const cubeCamera = new THREE.CubeCamera(0.1, 1000, 256);
 *   cubeCamera.update(renderer, skyScene);
 *   const equirect = cubemapToEquirect(renderer, cubeCamera.renderTarget.texture, 256);
 *   scene.environment = equirect;  // Use for pathtracer IBL
 */
export function cubemapToEquirect(
  renderer: THREE.WebGLRenderer,
  cubemap: THREE.Texture,
  resolution: number = 512
): THREE.Texture {
  // Create HDR render target (FloatType preserves values > 1.0)
  const width = resolution * 2;  // Equirect aspect ratio is 2:1
  const height = resolution;

  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.FloatType,           // HDR: allows values > 1.0
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,   // Smooth sampling
    magFilter: THREE.LinearFilter,
    generateMipmaps: false           // Mipmaps generated later if needed
  });

  // Create fullscreen quad with conversion shader
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tCube: { value: cubemap }
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });

  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),  // Fullscreen quad in NDC
    material
  );

  // Setup orthographic camera for fullscreen rendering
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new THREE.Scene();
  scene.add(quad);

  // Render the conversion
  const oldRenderTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(oldRenderTarget);

  // Read back pixel data from GPU for pathtracer
  // Pathtracer needs access to pixel data for importance sampling
  const pixelBuffer = new Float32Array(width * height * 4);
  renderer.readRenderTargetPixels(
    renderTarget,
    0, 0, width, height,
    pixelBuffer
  );

  // Create DataTexture with the pixel data
  const dataTexture = new THREE.DataTexture(
    pixelBuffer,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  dataTexture.needsUpdate = true;
  dataTexture.mapping = THREE.EquirectangularReflectionMapping;
  dataTexture.minFilter = THREE.LinearFilter;
  dataTexture.magFilter = THREE.LinearFilter;

  // Cleanup
  material.dispose();
  quad.geometry.dispose();
  renderTarget.dispose();

  // Return the DataTexture (has pixel data for pathtracer)
  return dataTexture;
}
