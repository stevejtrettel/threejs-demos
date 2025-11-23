/**
 * AssetManager - Centralized asset loading and caching
 *
 * Handles loading of textures, HDRIs, shaders, and models with caching
 * to avoid re-loading the same asset multiple times.
 *
 * @example
 *   const texture = await app.assets.loadTexture('path/to/texture.png');
 *   const hdri = await app.assets.loadHDRI('path/to/env.hdr');
 *   const {vertex, fragment} = await app.assets.loadShader('vert.glsl', 'frag.glsl');
 */

import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface TextureOptions {
  // Future: flipY, generateMipmaps, encoding, etc.
  // For now, keep simple - user can configure texture after loading
}

export class AssetManager {
  // Loading manager for progress tracking
  private loadingManager: THREE.LoadingManager;

  // Individual loaders (created once, reused)
  private textureLoader: THREE.TextureLoader;
  private hdrLoader: HDRLoader;
  private exrLoader: EXRLoader;
  private gltfLoader: GLTFLoader;

  // Caches: Map<path, loadedAsset>
  private textureCache = new Map<string, THREE.Texture>();
  private modelCache = new Map<string, THREE.Group>();
  private shaderCache = new Map<string, { vertex: string; fragment: string }>();

  // Progress tracking
  private itemsLoaded = 0;
  private itemsTotal = 0;

  constructor() {
    // Create loading manager
    this.loadingManager = new THREE.LoadingManager();

    this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
      this.itemsLoaded = itemsLoaded;
      this.itemsTotal = itemsTotal;
    };

    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      this.itemsLoaded = itemsLoaded;
      this.itemsTotal = itemsTotal;
    };

    this.loadingManager.onError = (url) => {
      console.error(`AssetManager: Error loading ${url}`);
    };

    // Create loaders with loading manager
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    this.hdrLoader = new HDRLoader(this.loadingManager);
    this.exrLoader = new EXRLoader(this.loadingManager);
    this.gltfLoader = new GLTFLoader(this.loadingManager);
  }

  // ===== Texture Loading =====

  /**
   * Load a texture (PNG, JPG, etc.)
   *
   * @param path - Path to texture file
   * @param options - Texture options (future: flipY, mipmaps, etc.)
   * @returns Promise<Texture> or null if failed
   */
  async loadTexture(path: string, options?: TextureOptions): Promise<THREE.Texture | null> {
    // Check cache first
    if (this.textureCache.has(path)) {
      return this.textureCache.get(path)!;
    }

    try {
      const texture = await this.textureLoader.loadAsync(path);
      this.textureCache.set(path, texture);
      return texture;
    } catch (error) {
      console.warn(`AssetManager: Failed to load texture '${path}':`, error);
      return null;
    }
  }

  /**
   * Load an HDRI environment map (.hdr or .exr)
   *
   * @param path - Path to HDRI file
   * @returns Promise<DataTexture> or null if failed
   */
  async loadHDRI(path: string): Promise<THREE.DataTexture | null> {
    // Check cache first
    const cached = this.textureCache.get(path);
    if (cached) {
      return cached as THREE.DataTexture;
    }

    try {
      let texture: THREE.DataTexture;

      // Choose loader based on file extension
      if (path.endsWith('.hdr')) {
        texture = await this.hdrLoader.loadAsync(path);
      } else if (path.endsWith('.exr')) {
        texture = await this.exrLoader.loadAsync(path);
      } else {
        throw new Error(`Unsupported HDRI format: ${path}. Use .hdr or .exr`);
      }

      // Configure for environment use
      texture.mapping = THREE.EquirectangularReflectionMapping;

      this.textureCache.set(path, texture);
      return texture;
    } catch (error) {
      console.warn(`AssetManager: Failed to load HDRI '${path}':`, error);
      return null;
    }
  }

  /**
   * Load shader code from files
   *
   * @param vertexPath - Path to vertex shader (.glsl, .vert)
   * @param fragmentPath - Path to fragment shader (.glsl, .frag)
   * @returns Promise<{vertex, fragment}> or null if failed
   */
  async loadShader(
    vertexPath: string,
    fragmentPath: string
  ): Promise<{ vertex: string; fragment: string } | null> {
    const cacheKey = `${vertexPath}|${fragmentPath}`;

    // Check cache first
    if (this.shaderCache.has(cacheKey)) {
      return this.shaderCache.get(cacheKey)!;
    }

    try {
      const [vertexResponse, fragmentResponse] = await Promise.all([
        fetch(vertexPath),
        fetch(fragmentPath)
      ]);

      if (!vertexResponse.ok) {
        throw new Error(`Failed to load vertex shader: ${vertexResponse.statusText}`);
      }
      if (!fragmentResponse.ok) {
        throw new Error(`Failed to load fragment shader: ${fragmentResponse.statusText}`);
      }

      const vertex = await vertexResponse.text();
      const fragment = await fragmentResponse.text();

      const shaderCode = { vertex, fragment };
      this.shaderCache.set(cacheKey, shaderCode);

      return shaderCode;
    } catch (error) {
      console.warn(`AssetManager: Failed to load shaders '${vertexPath}', '${fragmentPath}':`, error);
      return null;
    }
  }

  /**
   * Load shader from inline strings (useful for testing/small shaders)
   *
   * @param vertexCode - Vertex shader code
   * @param fragmentCode - Fragment shader code
   * @param cacheKey - Optional cache key (if you want to cache inline shaders)
   * @returns {vertex, fragment}
   */
  loadShaderFromString(
    vertexCode: string,
    fragmentCode: string,
    cacheKey?: string
  ): { vertex: string; fragment: string } {
    const shader = { vertex: vertexCode, fragment: fragmentCode };

    if (cacheKey) {
      this.shaderCache.set(cacheKey, shader);
    }

    return shader;
  }

  /**
   * Load a GLTF/GLB model
   *
   * @param path - Path to model file
   * @returns Promise<Group> or null if failed
   */
  async loadModel(path: string): Promise<THREE.Group | null> {
    // Check cache first
    if (this.modelCache.has(path)) {
      // Clone the cached model to avoid sharing the same instance
      return this.modelCache.get(path)!.clone();
    }

    try {
      const gltf = await this.gltfLoader.loadAsync(path);
      this.modelCache.set(path, gltf.scene);

      // Return a clone so the cached version stays pristine
      return gltf.scene.clone();
    } catch (error) {
      console.warn(`AssetManager: Failed to load model '${path}':`, error);
      return null;
    }
  }

  // ===== Utilities =====

  /**
   * Get current loading progress
   *
   * @returns {loaded, total} number of items
   */
  getProgress(): { loaded: number; total: number } {
    return {
      loaded: this.itemsLoaded,
      total: this.itemsTotal
    };
  }

  /**
   * Check if an asset is already cached
   *
   * @param path - Asset path
   * @returns true if cached
   */
  isCached(path: string): boolean {
    return (
      this.textureCache.has(path) ||
      this.modelCache.has(path) ||
      this.shaderCache.has(path)
    );
  }

  /**
   * Get total number of cached assets
   *
   * @returns number of cached assets
   */
  getCacheSize(): number {
    return this.textureCache.size + this.modelCache.size + this.shaderCache.size;
  }

  /**
   * Clear all caches (does not dispose assets)
   */
  clearCache(): void {
    this.textureCache.clear();
    this.modelCache.clear();
    this.shaderCache.clear();
  }

  /**
   * Dispose all cached assets and clear caches
   */
  dispose(): void {
    // Dispose textures
    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }

    // Dispose models (geometry and materials)
    for (const model of this.modelCache.values()) {
      model.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    }

    // Clear caches
    this.clearCache();
  }
}
