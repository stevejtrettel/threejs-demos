import * as THREE from 'three';
import type { ParamOptions } from '../types';
import type { Params } from '../components/Params';

interface RegisteredParam {
  object: any;
  property: string;
  options: ParamOptions;
  type: 'adhoc' | 'component';
}

export class ParameterManager {
  private registeredParams: RegisteredParam[] = [];

  /**
   * Register an ad-hoc parameter
   */
  add(object: any, property: string, options: ParamOptions): void {
    const originalValue = object[property];
    let currentValue = originalValue;

    // Create reactive property
    Object.defineProperty(object, property, {
      get() {
        return currentValue;
      },
      set(value) {
        const oldValue = currentValue;
        currentValue = value;

        if (options.onChange && oldValue !== value) {
          options.onChange(value);
        }
      },
      enumerable: true,
      configurable: true
    });

    // Register
    this.registeredParams.push({
      object,
      property,
      options,
      type: 'adhoc'
    });
  }

  /**
   * Expose a component parameter
   */
  expose(componentParams: Params, paramName: string, overrideOptions?: Partial<ParamOptions>): void {
    const definition = componentParams.getDefinition(paramName);
    if (!definition) {
      console.warn(`Parameter ${paramName} not found in component`);
      return;
    }

    // Merge options
    const finalOptions = {
      ...definition.options,
      ...overrideOptions
    };

    // Register
    this.registeredParams.push({
      object: (componentParams as any).owner,
      property: paramName,
      options: finalOptions,
      type: 'component'
    });
  }

  /**
   * Expose all component parameters
   */
  exposeAll(componentParams: Params): void {
    componentParams.getAllDefinitions().forEach((def, name) => {
      this.expose(componentParams, name);
    });
  }

  /**
   * Get all registered parameters
   */
  getAll(): RegisteredParam[] {
    return this.registeredParams;
  }

  /**
   * Clear all parameters
   */
  clear(): void {
    this.registeredParams = [];
  }

  /**
   * Add position parameters (x, y, z)
   */
  addPosition(object: THREE.Object3D, options?: Partial<ParamOptions>): void {
    const defaults = { min: -10, max: 10, ...options };

    this.add(object.position, 'x', { ...defaults, label: 'Position X' });
    this.add(object.position, 'y', { ...defaults, label: 'Position Y' });
    this.add(object.position, 'z', { ...defaults, label: 'Position Z' });
  }

  /**
   * Add rotation parameters (x, y, z)
   */
  addRotation(object: THREE.Object3D, options?: Partial<ParamOptions>): void {
    const defaults = { min: 0, max: Math.PI * 2, ...options };

    this.add(object.rotation, 'x', { ...defaults, label: 'Rotation X' });
    this.add(object.rotation, 'y', { ...defaults, label: 'Rotation Y' });
    this.add(object.rotation, 'z', { ...defaults, label: 'Rotation Z' });
  }

  /**
   * Add scale parameters (x, y, z)
   */
  addScale(object: THREE.Object3D, options?: Partial<ParamOptions>): void {
    const defaults = { min: 0.1, max: 5, ...options };

    this.add(object.scale, 'x', { ...defaults, label: 'Scale X' });
    this.add(object.scale, 'y', { ...defaults, label: 'Scale Y' });
    this.add(object.scale, 'z', { ...defaults, label: 'Scale Z' });
  }

  /**
   * Add color parameter for material
   */
  addColor(material: THREE.Material, options?: Partial<ParamOptions>): void {
    this.add(material, 'color', {
      type: 'color',
      onChange: (v) => (material as any).color.setHex(v),
      label: 'Color',
      ...options
    });
  }
}
