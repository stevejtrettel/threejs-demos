import type { ParamOptions, ParamDefinition } from '../types';

export class ComponentParams {
  private owner: any;
  private params = new Map<string, ParamDefinition>();

  constructor(owner: any) {
    this.owner = owner;
  }

  define(name: string, defaultValue: any, options: ParamOptions): void {
    // Create reactive property on owner
    let currentValue = defaultValue;

    Object.defineProperty(this.owner, name, {
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
