import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { simpleGradientSkyVertex, simpleGradientSkyFragment } from '../utils/shaders/sky/simple-gradient';

export interface StarfieldOptions {
  count?: number;
  size?: number;
}

export interface HDROptions {
  asEnvironment?: boolean;
  asBackground?: boolean;
  intensity?: number;
  rotation?: number; // Y-axis rotation in radians
}

export interface SkyOptions {
  topColor?: THREE.ColorRepresentation;
  bottomColor?: THREE.ColorRepresentation;
  offset?: number;
  exponent?: number;
}

export interface AtmosphericSkyOptions {
  turbidity?: number;      // Atmospheric turbidity (1-20, default: 10)
  rayleigh?: number;       // Rayleigh scattering (0-4, default: 3)
  mieCoefficient?: number; // Mie scattering (0-0.1, default: 0.005)
  mieDirectionalG?: number;// Mie scattering direction (0-1, default: 0.7)
  elevation?: number;      // Sun elevation in degrees (0-90, default: 2)
  azimuth?: number;        // Sun azimuth in degrees (0-360, default: 180)
  exposure?: number;       // Renderer exposure (default: 0.5)
}

export interface SceneEnvironmentOptions {
  position?: THREE.Vector3;     // Camera position for rendering (default: 0,0,0)
  resolution?: number;          // Cubemap resolution (default: 256)
  near?: number;                // Camera near plane (default: 0.1)
  far?: number;                 // Camera far plane (default: 1000)
  intensity?: number;           // Environment intensity (default: 1)
  asBackground?: boolean;       // Use as background (default: true)
  asEnvironment?: boolean;      // Use for IBL (default: true)
  backgroundBlurriness?: number; // Background blur amount 0-1 (default: 0)
}

export class BackgroundManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private pmremGenerator: THREE.PMREMGenerator;
  private hdrLoader: HDRLoader;
  private currentEnvMap?: THREE.Texture;
  private envRotation: number = 0;

  // Keep both texture formats for different renderers
  private pmremEnvMap?: THREE.Texture;      // For WebGL IBL (pre-filtered)
  private equirectEnvMap?: THREE.Texture;   // For pathtracer (original)

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.hdrLoader = new HDRLoader();
  }

  setColor(color: number): void {
    this.scene.background = new THREE.Color(color);
  }

  setGradient(color1: string, color2: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;

    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
  }

  setStarfield(options: StarfieldOptions = {}): void {
    const { count = 2000, size = 2 } = options;

    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 2048, 2048);

    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 2048;
      const y = Math.random() * 2048;
      const radius = Math.random() * size;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
  }

  loadHDR(url: string, options: HDROptions = {}, onLoad?: () => void): void {
    const {
      asEnvironment = true,
      asBackground = true,
      intensity = 1,
      rotation = 0
    } = options;

    this.hdrLoader.load(url, (texture) => {
      // Keep original equirectangular texture (needed for pathtracer)
      this.equirectEnvMap = texture;

      // Generate PMREM for WebGL IBL (better quality reflections)
      const pmremMap = this.pmremGenerator.fromEquirectangular(texture).texture;
      this.pmremEnvMap = pmremMap;

      if (rotation !== 0) {
        this.setEnvironmentRotation(rotation);
      }

      if (asEnvironment) {
        // Use PMREM for environment (WebGL needs this for IBL)
        // Pathtracer will swap this out when enabled
        this.scene.environment = pmremMap;
        this.setEnvironmentIntensity(intensity);
      }
      if (asBackground) {
        // Use PMREM for background (smoother, better quality)
        this.scene.background = pmremMap;
      }

      this.currentEnvMap = pmremMap;

      // Call the onLoad callback if provided
      if (onLoad) {
        onLoad();
      }
    });
  }

  async loadHDRAsync(url: string, options: HDROptions = {}): Promise<THREE.Texture> {
    const {
      asEnvironment = true,
      asBackground = true,
      intensity = 1,
      rotation = 0
    } = options;

    const texture = await this.hdrLoader.loadAsync(url);

    // Keep original equirectangular texture (needed for pathtracer)
    this.equirectEnvMap = texture;

    // Generate PMREM for WebGL IBL (better quality reflections)
    const pmremMap = this.pmremGenerator.fromEquirectangular(texture).texture;
    this.pmremEnvMap = pmremMap;

    if (rotation !== 0) {
      this.setEnvironmentRotation(rotation);
    }

    if (asEnvironment) {
      // Use PMREM for environment (WebGL needs this for IBL)
      // Pathtracer will swap this out when enabled
      this.scene.environment = pmremMap;
      this.setEnvironmentIntensity(intensity);
    }
    if (asBackground) {
      // Use PMREM for background (smoother, better quality)
      this.scene.background = pmremMap;
    }

    this.currentEnvMap = pmremMap;

    return texture;
  }

  /**
   * Set environment map intensity (IBL strength)
   *
   * @param intensity - Intensity multiplier (0 = no environment lighting, 1 = normal, >1 = brighter)
   */
  setEnvironmentIntensity(intensity: number): void {
    // THREE.js r155+ has scene.environmentIntensity
    // For older versions, we'd need to set envMapIntensity on each material
    if ('environmentIntensity' in this.scene) {
      (this.scene as any).environmentIntensity = intensity;
    } else {
      console.warn('scene.environmentIntensity not supported in this THREE.js version');
      console.warn('Set material.envMapIntensity manually on each material instead');
    }
  }

  /**
   * Rotate environment map around Y axis
   *
   * @param radians - Rotation in radians
   */
  setEnvironmentRotation(radians: number): void {
    this.envRotation = radians;

    // Apply rotation to current environment map
    if (this.currentEnvMap) {
      // Create rotation matrix for environment map
      // Note: This requires the environment map to use a custom shader or
      // we modify the scene's environment map rotation
      // For now, we store the rotation for future use
      console.warn('Environment rotation stored, but requires shader implementation for full support');
      console.warn('Consider using a skybox mesh with rotation instead for better compatibility');
    }
  }

  /**
   * Create a simple procedural gradient sky
   * Simple gradient sky (ground color to sky color)
   *
   * @param options - Sky configuration
   */
  setSky(options: SkyOptions = {}): void {
    const {
      topColor = 0x0077ff,
      bottomColor = 0xffffff,
      offset = 33,
      exponent = 0.6
    } = options;

    const uniforms = {
      topColor: { value: new THREE.Color(topColor) },
      bottomColor: { value: new THREE.Color(bottomColor) },
      offset: { value: offset },
      exponent: { value: exponent }
    };

    const skyGeo = new THREE.SphereGeometry(500, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: simpleGradientSkyVertex,
      fragmentShader: simpleGradientSkyFragment,
      side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Clear scene background (sky mesh will provide the background)
    this.scene.background = null;
  }

  /**
   * Create an atmospheric sky with physically-based scattering
   * Uses Three.js Sky example for realistic day/night simulation
   *
   * @param options - Atmospheric sky configuration
   * @returns Sky object for further customization
   */
  setAtmosphericSky(options: AtmosphericSkyOptions = {}): Sky {
    const {
      turbidity = 10,
      rayleigh = 3,
      mieCoefficient = 0.005,
      mieDirectionalG = 0.7,
      elevation = 2,
      azimuth = 180,
      exposure = 0.5
    } = options;

    const sky = new Sky();
    sky.scale.setScalar(450000);
    this.scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = turbidity;
    skyUniforms['rayleigh'].value = rayleigh;
    skyUniforms['mieCoefficient'].value = mieCoefficient;
    skyUniforms['mieDirectionalG'].value = mieDirectionalG;

    // Calculate sun position
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);

    const sun = new THREE.Vector3();
    sun.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sun);

    // Set renderer exposure
    this.renderer.toneMappingExposure = exposure;

    // Clear scene background (sky mesh will provide it)
    this.scene.background = null;

    return sky;
  }

  /**
   * Create environment from a custom scene
   * Renders the provided scene to a cubemap and uses it as environment/background
   *
   * This allows creating procedural environments without HDRI files.
   * Useful for stylized looks, geometric patterns, or matching scene aesthetics.
   *
   * @param environmentScene - Scene to render (can contain geometry, lights, etc.)
   * @param options - Configuration options
   * @returns The generated cubemap texture
   *
   * @example
   *   // Create a simple room environment
   *   const envScene = new THREE.Scene();
   *   const room = new THREE.Mesh(
   *     new THREE.BoxGeometry(10, 10, 10),
   *     new THREE.MeshStandardMaterial({ color: 0x404040, side: THREE.BackSide })
   *   );
   *   envScene.add(room);
   *   envScene.add(new THREE.PointLight(0xffffff, 100));
   *
   *   const cubemap = app.backgrounds.createEnvironmentFromScene(envScene);
   */
  createEnvironmentFromScene(
    environmentScene: THREE.Scene,
    options: SceneEnvironmentOptions = {}
  ): THREE.Texture {
    const {
      position = new THREE.Vector3(0, 0, 0),
      resolution = 256,
      near = 0.1,
      far = 1000,
      intensity = 1,
      asBackground = true,
      asEnvironment = true,
      backgroundBlurriness = 0
    } = options;

    // Validate resolution (should be power of 2 for mipmaps)
    if (!Number.isInteger(Math.log2(resolution))) {
      console.warn(`BackgroundManager: Resolution ${resolution} is not a power of 2. Recommended: 128, 256, 512, 1024`);
    }

    // Create cube render target
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(resolution, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });

    // Create cube camera at specified position
    const cubeCamera = new THREE.CubeCamera(near, far, cubeRenderTarget);
    cubeCamera.position.copy(position);

    // Render the environment scene to cubemap
    cubeCamera.update(this.renderer, environmentScene);

    // Generate PMREM for proper IBL
    const envMap = this.pmremGenerator.fromCubemap(cubeRenderTarget.texture).texture;

    // Apply to scene
    if (asEnvironment) {
      this.scene.environment = envMap;
      this.setEnvironmentIntensity(intensity);
    }
    if (asBackground) {
      this.scene.background = envMap;
      this.setBackgroundBlurriness(backgroundBlurriness);
    }

    this.currentEnvMap = envMap;

    // Clean up intermediate render target (we keep the PMREM result)
    cubeRenderTarget.dispose();

    return envMap;
  }

  /**
   * Set only environment lighting (no background)
   * Useful when you want IBL but a solid color background
   */
  setEnvironmentOnly(envMap: THREE.Texture, intensity: number = 1): void {
    this.scene.environment = envMap;
    this.setEnvironmentIntensity(intensity);
    this.currentEnvMap = envMap;
  }

  /**
   * Remove environment lighting but keep background
   */
  removeEnvironment(): void {
    this.scene.environment = null;
  }

  /**
   * Remove background but keep environment lighting
   */
  removeBackground(): void {
    this.scene.background = null;
  }

  /**
   * Set background blur amount
   * Blurs the background without affecting environment lighting quality
   *
   * @param blurriness - Blur amount from 0 (sharp) to 1 (maximum blur)
   *
   * @example
   *   app.backgrounds.setBackgroundBlurriness(0.3); // Subtle blur
   *   app.backgrounds.setBackgroundBlurriness(0.8); // Heavy blur
   */
  setBackgroundBlurriness(blurriness: number): void {
    this.scene.backgroundBlurriness = Math.max(0, Math.min(1, blurriness));
  }

  /**
   * Get the PMREM environment map (for WebGL IBL)
   */
  getPMREMEnvironment(): THREE.Texture | undefined {
    return this.pmremEnvMap;
  }

  /**
   * Get the equirectangular environment map (for pathtracer)
   */
  getEquirectEnvironment(): THREE.Texture | undefined {
    return this.equirectEnvMap;
  }

  dispose(): void {
    this.currentEnvMap?.dispose();
    this.equirectEnvMap?.dispose();
    this.pmremEnvMap?.dispose();
    this.pmremGenerator.dispose();
  }
}
