import * as THREE from 'three';
import type { ParamOptions } from '../types';
import type { Params } from '../Params';

interface RegisteredParam {
  object: any;
  property: string;
  options: ParamOptions;
  type: 'adhoc' | 'component';
}

export class ParameterManager {
  private registeredParams: RegisteredParam[] = [];

  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  /**
   * Subscribe to parameter events
   */
  on(event: 'param-added' | 'param-removed', callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  /**
   * Unsubscribe from parameter events
   */
  off(event: 'param-added' | 'param-removed', callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  private emit(event: 'param-added' | 'param-removed', data: any): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

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

    const param: RegisteredParam = {
      object,
      property,
      options,
      type: 'adhoc'
    };

    // Register
    this.registeredParams.push(param);
    this.emit('param-added', param);
  }

  /**
   * Expose a component parameter
   */
  expose(componentParams: Params, paramName: string, overrideOptions?: Partial<ParamOptions>): void {
    const definition = componentParams.getDefinition(paramName);
    if (!definition) {
      throw new Error(
        `Parameter '${paramName}' not found in component. Available parameters: ${Array.from(componentParams.getAllDefinitions().keys()).join(', ')}`
      );
    }

    // Merge options
    const finalOptions = {
      ...definition.options,
      ...overrideOptions
    };

    const param: RegisteredParam = {
      object: (componentParams as any).owner,
      property: paramName,
      options: finalOptions,
      type: 'component'
    };

    // Register
    this.registeredParams.push(param);
    this.emit('param-added', param);
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
    // Emit remove for all params
    this.registeredParams.forEach(param => {
      this.emit('param-removed', param);
    });
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
