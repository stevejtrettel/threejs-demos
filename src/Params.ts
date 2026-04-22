import type { ParamOptions, ParamDefinition } from './types';

/**
 * Walk the dependent DAG rooted at `node` in **topological order** (sources
 * before dependents) and call `method` on each reachable node at most once.
 *
 * Why topological: a node with multiple sources (e.g., a renderer that
 * depends on both a surface and a cached curve, both downstream of the same
 * root) must be rebuilt *after* all of its sources have been rebuilt.
 * Naive DFS with a visited-set gives no such guarantee and lets stale data
 * leak into renderers. Topological order fixes this for every diamond in
 * the DAG uniformly.
 *
 * Algorithm (Kahn's): discover the reachable sub-DAG, compute in-degrees
 * restricted to that sub-DAG, then repeatedly emit zero-in-degree nodes.
 * Nodes reached through a non-`Parametric` intermediate still get their
 * method called, but we can't recurse through them (they own no `params`
 * graph), so they appear as leaves.
 *
 * Cycle guard: if any nodes remain after the Kahn queue drains, the DAG
 * has a cycle. We log a warning and fall back to calling them in arbitrary
 * order, so a bug in user code doesn't silently lose updates.
 */
function cascade(root: any, method: 'rebuild' | 'update'): void {
  // 1. Discover reachable nodes (BFS) and record parametric edges.
  const reachable = new Set<any>();
  const dependentsOf = new Map<any, any[]>();

  const stack: any[] = [root];
  while (stack.length > 0) {
    const n = stack.pop();
    if (reachable.has(n)) continue;
    reachable.add(n);

    const p = n?.params;
    if (p && typeof p.getDependents === 'function') {
      const deps = Array.from(p.getDependents());
      dependentsOf.set(n, deps);
      for (const d of deps) {
        if (!reachable.has(d)) stack.push(d);
      }
    }
  }

  // 2. Compute in-degree within the reachable sub-DAG.
  const indeg = new Map<any, number>();
  for (const n of reachable) indeg.set(n, 0);
  for (const [, deps] of dependentsOf) {
    for (const d of deps) {
      indeg.set(d, (indeg.get(d) ?? 0) + 1);
    }
  }

  // 3. Kahn: queue zero-in-degree nodes, emit, decrement dependents' in-degree.
  const queue: any[] = [];
  for (const [n, d] of indeg) {
    if (d === 0) queue.push(n);
  }

  let emitted = 0;
  while (queue.length > 0) {
    const n = queue.shift();
    emitted++;

    if (typeof n?.[method] === 'function') {
      n[method]();
    }

    const deps = dependentsOf.get(n);
    if (deps) {
      for (const d of deps) {
        const nd = (indeg.get(d) ?? 1) - 1;
        indeg.set(d, nd);
        if (nd === 0) queue.push(d);
      }
    }
  }

  // 4. Cycle guard.
  if (emitted < reachable.size) {
    const stranded: any[] = [];
    for (const n of reachable) {
      if ((indeg.get(n) ?? 0) > 0) stranded.push(n);
    }
    // eslint-disable-next-line no-console
    console.warn(
      `Params cascade: cycle detected in dependency graph. ` +
      `${stranded.length} node(s) reached in fallback order.`,
    );
    for (const n of stranded) {
      if (typeof n?.[method] === 'function') n[method]();
    }
  }
}

/**
 * Reactive parameter system for math objects
 *
 * Creates reactive properties on owner object with automatic lifecycle hooks.
 * When a parameter changes, it can automatically trigger rebuild() or update()
 * and cascade that call transitively through the dependent DAG.
 *
 * Supports dependency tracking in both directions:
 * - dependents: objects that depend on THIS object (notified when we change)
 * - sources: objects that THIS object depends on (auto-cleanup on dispose)
 *
 * **Transitive cascade.** When a param fires, every reachable dependent's
 * `rebuild()` / `update()` is called. Intermediate "pass-through" nodes do
 * not need to implement a notification handler — they only need to call
 * `dependOn(...)` so they're part of the graph.
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
 * @example Dependency tracking (transitive)
 *   class SurfaceMesh {
 *     readonly params = new Params(this);
 *
 *     constructor(surface: Surface) {
 *       this.surface = surface;
 *       this.params
 *         .define('color', 0xff0000, { triggers: 'update' })
 *         .dependOn(surface);  // Rebuilds when surface OR anything upstream changes
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

        // Auto-trigger rebuild/update based on declaration.
        // Cascade walks the full dependent DAG in topological order
        // (sources before dependents), so diamonds resolve correctly.
        if (options.triggers === 'rebuild' || options.triggers === 'update') {
          cascade(owner, options.triggers);
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
