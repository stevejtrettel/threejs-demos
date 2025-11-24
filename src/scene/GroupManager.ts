/**
 * GroupManager - Organize and manage scene objects in groups
 *
 * Provides smart group management for organizing complex scenes:
 * - Named groups with hierarchical organization
 * - Show/hide entire groups
 * - Bulk operations (transform, clear, etc.)
 * - Object naming and lookup
 * - Tags for categorization
 *
 * Usage:
 *   app.groups.create('geodesics');
 *   app.groups.add(curve1, 'geodesics');
 *   app.groups.add(curve2, 'geodesics');
 *   app.groups.hide('geodesics');
 *   app.groups.applyTransform('geodesics', matrix);
 */

import * as THREE from 'three';

export interface GroupOptions {
  visible?: boolean;      // Initial visibility (default: true)
  parent?: string;        // Parent group name (for nested groups)
  tags?: string[];        // Tags for categorization
}

export interface ObjectMetadata {
  group?: string;         // Group name
  tags: Set<string>;      // Tags for this object
  name?: string;          // Object name
}

export class GroupManager {
  private scene: THREE.Scene;

  // Named groups (group name → THREE.Group)
  private groups = new Map<string, THREE.Group>();

  // Object metadata (object → metadata)
  private metadata = new WeakMap<THREE.Object3D, ObjectMetadata>();

  // Object name lookup (name → object)
  private namedObjects = new Map<string, THREE.Object3D>();

  // Tag index (tag → set of objects)
  private taggedObjects = new Map<string, Set<THREE.Object3D>>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ===== Group Creation and Management =====

  /**
   * Create a named group
   *
   * @param name - Group name (must be unique)
   * @param options - Group options
   * @returns The created THREE.Group
   */
  create(name: string, options: GroupOptions = {}): THREE.Group {
    if (this.groups.has(name)) {
      console.warn(`GroupManager: Group '${name}' already exists`);
      return this.groups.get(name)!;
    }

    const group = new THREE.Group();
    group.name = name;
    group.visible = options.visible ?? true;

    // Add to parent group or scene
    if (options.parent) {
      const parent = this.groups.get(options.parent);
      if (parent) {
        parent.add(group);
      } else {
        console.warn(`GroupManager: Parent group '${options.parent}' not found, adding to scene`);
        this.scene.add(group);
      }
    } else {
      this.scene.add(group);
    }

    this.groups.set(name, group);

    // Set tags if provided
    if (options.tags) {
      const meta: ObjectMetadata = {
        group: undefined,
        tags: new Set(options.tags),
        name
      };
      this.metadata.set(group, meta);

      // Index tags
      for (const tag of options.tags) {
        if (!this.taggedObjects.has(tag)) {
          this.taggedObjects.set(tag, new Set());
        }
        this.taggedObjects.get(tag)!.add(group);
      }
    }

    console.log(`GroupManager: Created group '${name}'`);
    return group;
  }

  /**
   * Get a group by name
   *
   * @param name - Group name
   * @returns The group, or undefined if not found
   */
  get(name: string): THREE.Group | undefined {
    return this.groups.get(name);
  }

  /**
   * Check if a group exists
   *
   * @param name - Group name
   * @returns True if group exists
   */
  has(name: string): boolean {
    return this.groups.has(name);
  }

  /**
   * Delete a group and optionally its children
   *
   * @param name - Group name
   * @param removeChildren - If true, also remove all objects in the group (default: false)
   */
  delete(name: string, removeChildren: boolean = false): void {
    const group = this.groups.get(name);
    if (!group) {
      console.warn(`GroupManager: Group '${name}' not found`);
      return;
    }

    if (removeChildren) {
      // Remove all children and dispose
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);

        // Dispose if it's a mesh
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      }
    } else {
      // Move children to parent
      const parent = group.parent || this.scene;
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        parent.add(child);
      }
    }

    // Remove from scene
    group.removeFromParent();

    // Clean up metadata
    this.metadata.delete(group);

    // Remove from named objects
    if (group.name) {
      this.namedObjects.delete(group.name);
    }

    // Remove from groups map
    this.groups.delete(name);

    console.log(`GroupManager: Deleted group '${name}'${removeChildren ? ' (with children)' : ''}`);
  }

  /**
   * Get all group names
   *
   * @returns Array of group names
   */
  list(): string[] {
    return Array.from(this.groups.keys());
  }

  // ===== Adding Objects to Groups =====

  /**
   * Add an object to a group
   *
   * @param object - Object to add
   * @param groupName - Group name
   * @param name - Optional name for the object
   * @param tags - Optional tags for the object
   */
  add(object: THREE.Object3D, groupName: string, name?: string, tags?: string[]): void {
    const group = this.groups.get(groupName);
    if (!group) {
      console.warn(`GroupManager: Group '${groupName}' not found`);
      return;
    }

    // Add to group
    group.add(object);

    // Store metadata
    const meta: ObjectMetadata = {
      group: groupName,
      tags: new Set(tags || []),
      name: name || object.name
    };
    this.metadata.set(object, meta);

    // Register name if provided
    if (name) {
      object.name = name;
      this.namedObjects.set(name, object);
    }

    // Index tags
    if (tags) {
      for (const tag of tags) {
        if (!this.taggedObjects.has(tag)) {
          this.taggedObjects.set(tag, new Set());
        }
        this.taggedObjects.get(tag)!.add(object);
      }
    }
  }

  /**
   * Remove an object from its group (but keep it in the scene)
   *
   * @param object - Object to remove
   */
  remove(object: THREE.Object3D): void {
    const meta = this.metadata.get(object);
    if (!meta || !meta.group) {
      console.warn('GroupManager: Object not in any managed group');
      return;
    }

    const group = this.groups.get(meta.group);
    if (group) {
      // Remove from group, add to scene
      group.remove(object);
      this.scene.add(object);
    }

    // Clean up metadata
    this.metadata.delete(object);

    // Clean up name lookup
    if (meta.name) {
      this.namedObjects.delete(meta.name);
    }

    // Clean up tag index
    for (const tag of meta.tags) {
      const tagged = this.taggedObjects.get(tag);
      if (tagged) {
        tagged.delete(object);
        if (tagged.size === 0) {
          this.taggedObjects.delete(tag);
        }
      }
    }
  }

  // ===== Bulk Operations =====

  /**
   * Show a group (set visible = true)
   *
   * @param name - Group name
   */
  show(name: string): void {
    const group = this.groups.get(name);
    if (group) {
      group.visible = true;
      console.log(`GroupManager: Group '${name}' is now visible`);
    } else {
      console.warn(`GroupManager: Group '${name}' not found`);
    }
  }

  /**
   * Hide a group (set visible = false)
   *
   * @param name - Group name
   */
  hide(name: string): void {
    const group = this.groups.get(name);
    if (group) {
      group.visible = false;
      console.log(`GroupManager: Group '${name}' is now hidden`);
    } else {
      console.warn(`GroupManager: Group '${name}' not found`);
    }
  }

  /**
   * Toggle group visibility
   *
   * @param name - Group name
   */
  toggle(name: string): void {
    const group = this.groups.get(name);
    if (group) {
      group.visible = !group.visible;
      console.log(`GroupManager: Group '${name}' is now ${group.visible ? 'visible' : 'hidden'}`);
    } else {
      console.warn(`GroupManager: Group '${name}' not found`);
    }
  }

  /**
   * Apply a transformation matrix to all objects in a group
   *
   * @param name - Group name
   * @param matrix - Transformation matrix
   */
  applyTransform(name: string, matrix: THREE.Matrix4): void {
    const group = this.groups.get(name);
    if (!group) {
      console.warn(`GroupManager: Group '${name}' not found`);
      return;
    }

    group.applyMatrix4(matrix);
    console.log(`GroupManager: Applied transform to group '${name}'`);
  }

  /**
   * Set position of a group
   *
   * @param name - Group name
   * @param x - X position
   * @param y - Y position
   * @param z - Z position
   */
  setPosition(name: string, x: number, y: number, z: number): void {
    const group = this.groups.get(name);
    if (group) {
      group.position.set(x, y, z);
    } else {
      console.warn(`GroupManager: Group '${name}' not found`);
    }
  }

  /**
   * Set rotation of a group
   *
   * @param name - Group name
   * @param x - X rotation (radians)
   * @param y - Y rotation (radians)
   * @param z - Z rotation (radians)
   */
  setRotation(name: string, x: number, y: number, z: number): void {
    const group = this.groups.get(name);
    if (group) {
      group.rotation.set(x, y, z);
    } else {
      console.warn(`GroupManager: Group '${name}' not found`);
    }
  }

  /**
   * Set scale of a group
   *
   * @param name - Group name
   * @param x - X scale
   * @param y - Y scale
   * @param z - Z scale
   */
  setScale(name: string, x: number, y: number, z: number): void {
    const group = this.groups.get(name);
    if (group) {
      group.scale.set(x, y, z);
    } else {
      console.warn(`GroupManager: Group '${name}' not found`);
    }
  }

  /**
   * Clear all objects from a group
   *
   * @param name - Group name
   * @param dispose - If true, dispose geometries and materials (default: false)
   */
  clear(name: string, dispose: boolean = false): void {
    const group = this.groups.get(name);
    if (!group) {
      console.warn(`GroupManager: Group '${name}' not found`);
      return;
    }

    const count = group.children.length;

    if (dispose) {
      // Remove and dispose all children
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);

        // Dispose if it's a mesh
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material?.dispose();
          }
        }

        // Clean up metadata
        this.metadata.delete(child);
      }
    } else {
      // Just remove children (no disposal)
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        this.metadata.delete(child);
      }
    }

    console.log(`GroupManager: Cleared ${count} objects from group '${name}'${dispose ? ' (with disposal)' : ''}`);
  }

  // ===== Object Lookup =====

  /**
   * Get an object by name
   *
   * @param name - Object name
   * @returns The object, or undefined if not found
   */
  getObject(name: string): THREE.Object3D | undefined {
    return this.namedObjects.get(name);
  }

  /**
   * Get all objects with a specific tag
   *
   * @param tag - Tag name
   * @returns Array of objects with this tag
   */
  getObjectsByTag(tag: string): THREE.Object3D[] {
    const tagged = this.taggedObjects.get(tag);
    return tagged ? Array.from(tagged) : [];
  }

  /**
   * Get all objects in a group
   *
   * @param name - Group name
   * @param recursive - If true, include nested children (default: false)
   * @returns Array of objects in the group
   */
  getObjectsInGroup(name: string, recursive: boolean = false): THREE.Object3D[] {
    const group = this.groups.get(name);
    if (!group) {
      console.warn(`GroupManager: Group '${name}' not found`);
      return [];
    }

    if (recursive) {
      const objects: THREE.Object3D[] = [];
      group.traverse((obj) => {
        if (obj !== group) {
          objects.push(obj);
        }
      });
      return objects;
    } else {
      return [...group.children];
    }
  }

  /**
   * Get the group name for an object
   *
   * @param object - The object
   * @returns Group name, or undefined if not in a managed group
   */
  getGroupName(object: THREE.Object3D): string | undefined {
    const meta = this.metadata.get(object);
    return meta?.group;
  }

  /**
   * Get all tags for an object
   *
   * @param object - The object
   * @returns Array of tags
   */
  getTags(object: THREE.Object3D): string[] {
    const meta = this.metadata.get(object);
    return meta ? Array.from(meta.tags) : [];
  }

  // ===== Scene Inspection =====

  /**
   * Count objects in a group
   *
   * @param name - Group name
   * @param recursive - If true, count nested children (default: true)
   * @returns Number of objects in the group
   */
  count(name: string, recursive: boolean = true): number {
    const group = this.groups.get(name);
    if (!group) {
      console.warn(`GroupManager: Group '${name}' not found`);
      return 0;
    }

    if (recursive) {
      let count = 0;
      group.traverse(() => count++);
      return count - 1;  // Exclude the group itself
    } else {
      return group.children.length;
    }
  }

  /**
   * Print group hierarchy to console
   */
  printHierarchy(): void {
    console.log('=== Group Hierarchy ===');

    // Find root groups (not children of other groups)
    const rootGroups: THREE.Group[] = [];
    for (const [name, group] of this.groups) {
      let isRoot = true;
      for (const [, otherGroup] of this.groups) {
        if (otherGroup.children.includes(group)) {
          isRoot = false;
          break;
        }
      }
      if (isRoot) {
        rootGroups.push(group);
      }
    }

    // Print each root group
    for (const group of rootGroups) {
      this.printGroup(group, 0);
    }
  }

  private printGroup(group: THREE.Group, indent: number): void {
    const prefix = '  '.repeat(indent);
    const count = group.children.length;
    const visible = group.visible ? '👁️' : '🚫';

    console.log(`${prefix}${visible} Group: ${group.name} (${count} children)`);

    for (const child of group.children) {
      if (child instanceof THREE.Group) {
        this.printGroup(child, indent + 1);
      } else {
        const childPrefix = '  '.repeat(indent + 1);
        const childName = child.name || '(unnamed)';
        const childType = child.type;
        console.log(`${childPrefix}  └─ ${childType}: ${childName}`);
      }
    }
  }

  /**
   * Get statistics about all groups
   *
   * @returns Object with group statistics
   */
  getStats(): { totalGroups: number; totalObjects: number; taggedObjects: number } {
    let totalObjects = 0;
    for (const group of this.groups.values()) {
      group.traverse((obj) => {
        if (obj !== group) totalObjects++;
      });
    }

    let taggedObjects = 0;
    for (const tagged of this.taggedObjects.values()) {
      taggedObjects += tagged.size;
    }

    return {
      totalGroups: this.groups.size,
      totalObjects,
      taggedObjects
    };
  }

  // ===== Cleanup =====

  /**
   * Dispose all groups and clean up
   */
  dispose(): void {
    // Delete all groups
    const groupNames = Array.from(this.groups.keys());
    for (const name of groupNames) {
      this.delete(name, true);
    }

    // Clear all maps
    this.groups.clear();
    this.namedObjects.clear();
    this.taggedObjects.clear();

    console.log('GroupManager: Disposed');
  }
}
