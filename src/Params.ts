import type { ParamOptions, ParamDefinition } from './types';

/**
 * Reactive parameter system for math objects
 *
 * Creates reactive properties on owner object with automatic lifecycle hooks.
 * When a parameter changes, it can automatically trigger rebuild() or update().
 *
 * Supports dependency tracking in both directions:
 * - dependents: objects that depend on THIS object (notified when we change)
 * - sources: objects that THIS object depends on (auto-cleanup on dispose)
 *
 * @example Basic usage
 *   class MyCurve {
 *     readonly params = new Params(this);
 *
 *     constructor() {
 *       this.params
 *         .define('segments', 100, { triggers: 'rebuild' })
 *         .define('color', 0xff0000, { triggers: 'update' });
 *     }
 *   }
 *
 * @example Dependency tracking
 *   class SurfaceMesh {
 *     readonly params = new Params(this);
 *
 *     constructor(surface: Surface) {
 *       this.surface = surface;
 *       this.params
 *         .define('color', 0xff0000, { triggers: 'update' })
 *         .dependOn(surface);  // Rebuild when surface changes
 *     }
 *
 *     dispose() {
 *       this.params.dispose();  // Auto-cleanup subscriptions
 *     }
 *   }
 */
export class Params {
  private owner: any;
  private definitions = new Map<string, ParamDefinition>();
  private dependents = new Set<any>();      // Objects that depend on US
  private sources = new Set<Params>();       // Params we depend ON (for cleanup)

  constructor(owner: any) {
    this.owner = owner;
  }

  /**
   * Define a reactive parameter on the owner object
   *
   * @param name - Property name to create on owner
   * @param defaultValue - Initial value
   * @param options - Parameter options (min, max, triggers, onChange, etc.)
   * @returns this (for chaining)
   */
  define(name: string, defaultValue: any, options: ParamOptions = {}): this {
    // Create reactive property on owner
    let currentValue = defaultValue;
    const owner = this.owner;
    const paramsInstance = this;

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
    this.definitions.set(name, {
      name,
      defaultValue,
      options
    });

    return this;
  }

  /**
   * Declare dependency on one or more source objects
   *
   * When any source's parameters change, this object's rebuild() or update()
   * will be called automatically. Subscriptions are tracked for auto-cleanup
   * when dispose() is called.
   *
   * Safe to call with non-Parametric objects (they're silently ignored).
   *
   * @param sources - Objects to depend on (must have params property)
   * @returns this (for chaining)
   *
   * @example
   *   this.params.dependOn(surface);
   *   this.params.dependOn(surface, colormap, field);  // Multiple
   */
  dependOn(...sources: unknown[]): this {
    for (const source of sources) {
      if (isParametric(source)) {
        source.params.addDependent(this.owner);
        this.sources.add(source.params);
      }
    }
    return this;
  }

  /**
   * Dispose and clean up all subscriptions
   *
   * Call this in your object's dispose() method to:
   * - Unsubscribe from all sources this object depends on
   * - Clear the sources set
   *
   * @example
   *   dispose(): void {
   *     this.params.dispose();
   *     // ... other cleanup (geometry, materials, etc.)
   *   }
   */
  dispose(): void {
    // Unsubscribe from all sources
    for (const sourceParams of this.sources) {
      sourceParams.removeDependent(this.owner);
    }
    this.sources.clear();
  }

  /**
   * Register a dependent object to be notified when parameters change
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
   * Get all source Params this object depends on
   */
  getSources(): Set<Params> {
    return new Set(this.sources);
  }

  get(name: string): any {
    return this.owner[name];
  }

  set(name: string, value: any): void {
    this.owner[name] = value;
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  getDefinition(name: string): ParamDefinition | undefined {
    return this.definitions.get(name);
  }

  getAllDefinitions(): Map<string, ParamDefinition> {
    return this.definitions;
  }
}

/**
 * Helper to check if an object has the Params system
 *
 * @param obj - Any object
 * @returns true if object has a params property that is a Params instance
 */
export function isParametric(obj: unknown): obj is { params: Params } {
  return obj !== null &&
    typeof obj === 'object' &&
    'params' in obj &&
    (obj as any).params instanceof Params;
}
