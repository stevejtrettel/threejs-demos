import type { ParamOptions, ParamDefinition } from './types';

/**
 * Reactive parameter system for math objects
 *
 * Creates reactive properties on owner object with automatic lifecycle hooks.
 * When a parameter changes, it can automatically trigger rebuild() or update().
 *
 * Also supports dependency tracking: objects can register as dependents to be
 * notified when parameters change.
 *
 * @example
 *   class MyCurve {
 *     constructor() {
 *       this.params = new Params(this);
 *       this.params.define('segments', 100, { triggers: 'rebuild' });
 *       this.params.define('color', 0xff0000, { triggers: 'update' });
 *     }
 *   }
 *
 * @example Dependency tracking
 *   class Geodesic {
 *     constructor(surface: ParametricSurface) {
 *       this.surface = surface;
 *       // When surface parameters change, geodesic rebuilds automatically
 *       surface.params.addDependent(this);
 *     }
 *   }
 */
export class Params {
  private owner: any;
  private params = new Map<string, ParamDefinition>();
  private dependents = new Set<any>();

  constructor(owner: any) {
    this.owner = owner;
  }

  /**
   * Register a dependent object to be notified when parameters change
   *
   * When any parameter changes, the dependent's rebuild() or update() method
   * will be called based on the parameter's trigger setting.
   *
   * @param dependent - Object with rebuild() and/or update() methods
   */
  addDependent(dependent: any): void {
    this.dependents.add(dependent);
  }

  /**
   * Unregister a dependent object
   *
   * @param dependent - Previously registered dependent
   */
  removeDependent(dependent: any): void {
    this.dependents.delete(dependent);
  }

  /**
   * Get all registered dependents
   */
  getDependents(): Set<any> {
    return new Set(this.dependents);
  }

  /**
   * Define a reactive parameter on the owner object
   *
   * @param name - Property name to create on owner
   * @param defaultValue - Initial value
   * @param options - Parameter options (min, max, triggers, onChange, etc.)
   */
  define(name: string, defaultValue: any, options: ParamOptions = {}): void {
    // Create reactive property on owner
    let currentValue = defaultValue;
    const owner = this.owner;
    const paramsInstance = this; // Capture Params instance for closure

    Object.defineProperty(this.owner, name, {
      get() {
        return currentValue;
      },
      set(value) {
        const oldValue = currentValue;
        currentValue = value;

        // Skip if value didn't actually change
        if (oldValue === value) {
          return;
        }

        // Call user's onChange callback first (if provided)
        if (options.onChange) {
          options.onChange(value);
        }

        // Auto-trigger rebuild/update based on declaration
        if (options.triggers === 'rebuild') {
          if (typeof owner.rebuild === 'function') {
            owner.rebuild();
          }
          // Notify all dependents
          for (const dependent of paramsInstance.dependents) {
            if (typeof dependent.rebuild === 'function') {
              dependent.rebuild();
            }
          }
        } else if (options.triggers === 'update') {
          if (typeof owner.update === 'function') {
            owner.update();
          }
          // Notify all dependents
          for (const dependent of paramsInstance.dependents) {
            if (typeof dependent.update === 'function') {
              dependent.update();
            }
          }
        }
        // If triggers === 'none' or undefined, do nothing (manual control via onChange)
      },
      enumerable: true,
      configurable: true
    });

    // Store definition
    this.params.set(name, {
      name,
      defaultValue,
      options
    });
  }

  get(name: string): any {
    return this.owner[name];
  }

  set(name: string, value: any): void {
    this.owner[name] = value;
  }

  has(name: string): boolean {
    return this.params.has(name);
  }

  getDefinition(name: string): ParamDefinition | undefined {
    return this.params.get(name);
  }

  getAllDefinitions(): Map<string, ParamDefinition> {
    return this.params;
  }
}
