import type { ParamOptions } from '../types';
import type { ComponentParams } from '../components/ComponentParams';

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
  expose(componentParams: ComponentParams, paramName: string, overrideOptions?: Partial<ParamOptions>): void {
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
  exposeAll(componentParams: ComponentParams): void {
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
}
