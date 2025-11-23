## Group Management System

Organize and manage scene objects via the `GroupManager`.

**Location**: `src/app/GroupManager.ts`
**Access**: `app.groups`

## Overview

The GroupManager provides smart organization for complex scenes:
- **Named Groups**: Create groups with meaningful names
- **Hierarchical Organization**: Nest groups for structure
- **Bulk Operations**: Show/hide, transform, clear entire groups
- **Object Lookup**: Find objects by name or tag
- **Scene Inspection**: View hierarchy and statistics

## Quick Start

```typescript
import { App } from '../src/app/App';
import * as THREE from 'three';

const app = new App();

// Create named groups
app.groups.create('geodesics');
app.groups.create('surfaces');

// Add objects to groups
const curve1 = new THREE.Mesh(geometry1, material1);
app.groups.add(curve1, 'geodesics', 'curve1');

const curve2 = new THREE.Mesh(geometry2, material2);
app.groups.add(curve2, 'geodesics', 'curve2');

// Hide entire group
app.groups.hide('geodesics');

// Show again
app.groups.show('geodesics');

// Transform entire group
const matrix = new THREE.Matrix4().makeRotationY(Math.PI / 2);
app.groups.applyTransform('geodesics', matrix);
```

## Creating Groups

### create(name, options?)

Create a named group.

```typescript
// Basic group
app.groups.create('myGroup');

// With options
app.groups.create('myGroup', {
  visible: true,           // Initial visibility (default: true)
  parent: 'parentGroup',   // Parent group for nesting
  tags: ['mathematical']   // Tags for categorization
});
```

**Parameters:**
- `name` - Unique group name
- `options` - Optional configuration:
  - `visible` - Initial visibility (default: true)
  - `parent` - Parent group name for nesting
  - `tags` - Array of tags for categorization

**Returns**: The created THREE.Group

**Example:**
```typescript
// Create root group
app.groups.create('visualization');

// Create nested group
app.groups.create('surfaces', {
  parent: 'visualization',
  tags: ['mathematical', 'parametric']
});

// Create another nested group
app.groups.create('curves', {
  parent: 'visualization',
  tags: ['mathematical', 'curves']
});
```

### get(name)

Get a group by name.

```typescript
const group = app.groups.get('myGroup');
if (group) {
  console.log('Group found:', group.name);
}
```

**Returns**: THREE.Group or undefined

### has(name)

Check if a group exists.

```typescript
if (app.groups.has('myGroup')) {
  console.log('Group exists');
}
```

**Returns**: boolean

### delete(name, removeChildren?)

Delete a group.

```typescript
// Delete group, move children to parent
app.groups.delete('myGroup');

// Delete group and all children
app.groups.delete('myGroup', true);
```

**Parameters:**
- `name` - Group name
- `removeChildren` - If true, removes and disposes all children (default: false)

### list()

Get all group names.

```typescript
const groupNames = app.groups.list();
console.log('All groups:', groupNames);
// ['primitives', 'curves', 'surfaces', 'visualization']
```

**Returns**: Array of group names

## Adding Objects

### add(object, groupName, name?, tags?)

Add an object to a group.

```typescript
const sphere = new THREE.Mesh(geometry, material);

// Basic add
app.groups.add(sphere, 'primitives');

// With name
app.groups.add(sphere, 'primitives', 'redSphere');

// With name and tags
app.groups.add(sphere, 'primitives', 'redSphere', ['geometric', 'sphere']);
```

**Parameters:**
- `object` - THREE.Object3D to add
- `groupName` - Group name
- `name` - Optional name for lookup
- `tags` - Optional tags for categorization

**What it does:**
- Adds object to group
- Stores metadata (group name, tags)
- Registers name for lookup if provided
- Indexes tags for fast searching

### remove(object)

Remove an object from its group (keeps it in scene).

```typescript
app.groups.remove(sphere);
```

Removes object from managed group and cleans up metadata, but doesn't dispose it.

## Visibility Operations

### show(name) / hide(name)

Show or hide a group.

```typescript
// Hide group
app.groups.hide('geodesics');

// Show group
app.groups.show('geodesics');
```

**How it works:**
- Sets `group.visible = true/false`
- Affects all children (THREE.js behavior)
- Hidden objects don't render

### toggle(name)

Toggle group visibility.

```typescript
app.groups.toggle('curves');
// Visible → Hidden, or Hidden → Visible
```

## Transform Operations

### applyTransform(name, matrix)

Apply a transformation matrix to a group.

```typescript
// Rotate group 90° around Y axis
const matrix = new THREE.Matrix4().makeRotationY(Math.PI / 2);
app.groups.applyTransform('primitives', matrix);

// Translate group
const matrix2 = new THREE.Matrix4().makeTranslation(0, 5, 0);
app.groups.applyTransform('curves', matrix2);

// Scale group
const matrix3 = new THREE.Matrix4().makeScale(2, 2, 2);
app.groups.applyTransform('surfaces', matrix3);
```

**Note**: Uses `applyMatrix4()` which bakes the transform into children's transforms.

### setPosition(name, x, y, z)

Set group position.

```typescript
app.groups.setPosition('myGroup', 0, 5, 0);
```

### setRotation(name, x, y, z)

Set group rotation (in radians).

```typescript
app.groups.setRotation('myGroup', 0, Math.PI / 2, 0);
```

### setScale(name, x, y, z)

Set group scale.

```typescript
app.groups.setScale('myGroup', 2, 2, 2);
```

## Bulk Operations

### clear(name, dispose?)

Clear all objects from a group.

```typescript
// Remove objects (don't dispose)
app.groups.clear('myGroup');

// Remove and dispose objects
app.groups.clear('myGroup', true);
```

**Parameters:**
- `name` - Group name
- `dispose` - If true, calls `geometry.dispose()` and `material.dispose()` (default: false)

**Use Cases:**
- Rebuilding visualization (clear then add new objects)
- Memory management (clear with dispose=true)
- Resetting a group to empty state

## Object Lookup

### getObject(name)

Get an object by name.

```typescript
const sphere = app.groups.getObject('redSphere');
if (sphere) {
  sphere.position.y += 1;
}
```

**Returns**: THREE.Object3D or undefined

**Example:**
```typescript
// Add objects with names
app.groups.add(surface1, 'surfaces', 'kleinBottle');
app.groups.add(surface2, 'surfaces', 'mobiusStrip');

// Later: look up by name
const klein = app.groups.getObject('kleinBottle');
klein.material.color.set(0xff0000);
```

### getObjectsByTag(tag)

Get all objects with a specific tag.

```typescript
const parametricObjects = app.groups.getObjectsByTag('parametric');
console.log(`Found ${parametricObjects.length} parametric objects`);

// Do something with all tagged objects
for (const obj of parametricObjects) {
  obj.visible = false;
}
```

**Returns**: Array of THREE.Object3D

**Example:**
```typescript
// Add objects with tags
app.groups.add(curve1, 'curves', 'helix', ['parametric', '3d']);
app.groups.add(curve2, 'curves', 'lissajous', ['parametric', '3d']);
app.groups.add(plane, 'surfaces', 'ground', ['geometric', '2d']);

// Find by tag
const parametric = app.groups.getObjectsByTag('parametric');  // [helix, lissajous]
const threeD = app.groups.getObjectsByTag('3d');              // [helix, lissajous]
const geometric = app.groups.getObjectsByTag('geometric');    // [ground]
```

### getObjectsInGroup(name, recursive?)

Get all objects in a group.

```typescript
// Get direct children only
const objects = app.groups.getObjectsInGroup('primitives');

// Get all descendants (recursive)
const allObjects = app.groups.getObjectsInGroup('visualization', true);
```

**Parameters:**
- `name` - Group name
- `recursive` - If true, includes nested children (default: false)

**Returns**: Array of THREE.Object3D

### getGroupName(object)

Get the group name for an object.

```typescript
const groupName = app.groups.getGroupName(sphere);
console.log(`Object is in group: ${groupName}`);
```

**Returns**: Group name or undefined

### getTags(object)

Get all tags for an object.

```typescript
const tags = app.groups.getTags(sphere);
console.log('Object tags:', tags);
```

**Returns**: Array of tag strings

## Scene Inspection

### count(name, recursive?)

Count objects in a group.

```typescript
// Direct children only
const directCount = app.groups.count('primitives', false);

// All descendants (default)
const totalCount = app.groups.count('visualization');
```

**Returns**: Number of objects

### printHierarchy()

Print the group hierarchy to console.

```typescript
app.groups.printHierarchy();
```

**Output Example:**
```
=== Group Hierarchy ===
👁️ Group: visualization (1 children)
  👁️ Group: surfaces (2 children)
    └─ Mesh: torusKnot
    └─ Mesh: kleinBottle
👁️ Group: primitives (3 children)
  └─ Mesh: sphere
  └─ Mesh: cube
  └─ Mesh: cone
👁️ Group: curves (2 children)
  └─ Mesh: helix
  └─ Mesh: lissajous
```

Shows:
- Hierarchy with indentation
- Visibility status (👁️ visible, 🚫 hidden)
- Child count
- Object types and names

### getStats()

Get statistics about all groups.

```typescript
const stats = app.groups.getStats();
console.log('Total groups:', stats.totalGroups);
console.log('Total objects:', stats.totalObjects);
console.log('Tagged objects:', stats.taggedObjects);
```

**Returns**: Object with statistics:
- `totalGroups` - Number of groups
- `totalObjects` - Total objects in all groups (recursive)
- `taggedObjects` - Number of tagged objects

## Common Patterns

### Pattern 1: Organize by Type

```typescript
// Create groups by object type
app.groups.create('curves');
app.groups.create('surfaces');
app.groups.create('vectors');

// Add objects to appropriate groups
app.groups.add(helix, 'curves', 'helix');
app.groups.add(kleinBottle, 'surfaces', 'klein');
app.groups.add(normalVector, 'vectors', 'normal1');

// Toggle visibility by type
app.groups.hide('vectors');  // Hide all vectors
app.groups.show('curves');   // Show all curves
```

### Pattern 2: Hierarchical Organization

```typescript
// Create hierarchical structure
app.groups.create('visualization');
app.groups.create('geometry', { parent: 'visualization' });
app.groups.create('analysis', { parent: 'visualization' });

// Add objects to nested groups
app.groups.add(surface, 'geometry', 'surface1');
app.groups.add(curvatureViz, 'analysis', 'curvature');

// Hide entire visualization (includes all children)
app.groups.hide('visualization');
```

### Pattern 3: Tag-Based Organization

```typescript
// Add objects with descriptive tags
app.groups.add(surface1, 'main', 'surface1', ['parametric', 'minimal']);
app.groups.add(surface2, 'main', 'surface2', ['parametric', 'developable']);
app.groups.add(curve1, 'main', 'curve1', ['geodesic', 'closed']);

// Find by property
const parametric = app.groups.getObjectsByTag('parametric');  // [surface1, surface2]
const minimal = app.groups.getObjectsByTag('minimal');        // [surface1]

// Apply operation to all matching objects
for (const obj of parametric) {
  obj.material.wireframe = true;
}
```

### Pattern 4: Dynamic Group Management

```typescript
// Create group for current visualization
app.groups.create('current');

// Add many objects
for (let i = 0; i < 100; i++) {
  const curve = createGeodesic(i);
  app.groups.add(curve, 'current', `geodesic${i}`);
}

// Later: clear and rebuild
app.groups.clear('current', true);  // Dispose all objects

// Rebuild with different parameters
for (let i = 0; i < 50; i++) {
  const curve = createGeodesic(i, newParams);
  app.groups.add(curve, 'current', `geodesic${i}`);
}
```

### Pattern 5: Coordinated Transforms

```typescript
// Group objects that should move together
app.groups.create('rotatingSystem');
app.groups.add(planet, 'rotatingSystem', 'planet');
app.groups.add(moon, 'rotatingSystem', 'moon');
app.groups.add(orbit, 'rotatingSystem', 'orbit');

// Animate the entire system
app.addAnimateCallback((time) => {
  const angle = time * 0.001;
  app.groups.setRotation('rotatingSystem', 0, angle, 0);
});
```

### Pattern 6: Show/Hide Based on Parameters

```typescript
// Organize visualization layers
app.groups.create('baseSurface');
app.groups.create('curvatureViz');
app.groups.create('annotations');

// Toggle based on UI parameters
surface.params.add('showCurvature', false, (value) => {
  if (value) {
    app.groups.show('curvatureViz');
  } else {
    app.groups.hide('curvatureViz');
  }
});

surface.params.add('showAnnotations', false, (value) => {
  if (value) {
    app.groups.show('annotations');
  } else {
    app.groups.hide('annotations');
  }
});
```

## Integration with App.add()

While GroupManager provides explicit group management, you can still use `App.add()` for objects:

```typescript
// Using App.add() (adds to scene root)
app.add(surface);

// Using GroupManager (adds to named group)
app.groups.add(surface.mesh, 'surfaces', 'surface1');
```

**When to use which:**
- **App.add()** - For simple scenes, single objects, prototype
- **GroupManager** - For complex scenes, many objects, organization needed

## Examples

### Example 1: Basic Grouping

```typescript
const app = new App();

// Create group
app.groups.create('shapes');

// Add objects
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
app.groups.add(sphere, 'shapes', 'redSphere');

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
app.groups.add(cube, 'shapes', 'greenCube');

// Hide all shapes
app.groups.hide('shapes');

// Show again
app.groups.show('shapes');
```

### Example 2: Nested Groups

```typescript
// Create hierarchy
app.groups.create('scene');
app.groups.create('foreground', { parent: 'scene' });
app.groups.create('background', { parent: 'scene' });

// Add to nested groups
app.groups.add(mainObject, 'foreground', 'main');
app.groups.add(skybox, 'background', 'sky');

// Hide background only
app.groups.hide('background');

// Or hide entire scene
app.groups.hide('scene');  // Hides foreground and background
```

### Example 3: Tag-Based Operations

```typescript
// Add objects with tags
app.groups.add(surface1, 'main', 'klein', ['surface', 'nonorientable']);
app.groups.add(surface2, 'main', 'mobius', ['surface', 'nonorientable']);
app.groups.add(sphere, 'main', 'sphere', ['surface', 'orientable']);

// Hide all non-orientable surfaces
const nonorientable = app.groups.getObjectsByTag('nonorientable');
for (const obj of nonorientable) {
  obj.visible = false;
}

// Or set color for all surfaces
const surfaces = app.groups.getObjectsByTag('surface');
for (const obj of surfaces) {
  if (obj instanceof THREE.Mesh) {
    obj.material.color.set(0xff0000);
  }
}
```

### Example 4: Rebuild Pattern

```typescript
// Initial creation
app.groups.create('geodesics');
for (let i = 0; i < 10; i++) {
  const curve = createGeodesic(i);
  app.groups.add(curve, 'geodesics', `geo${i}`);
}

// User changes parameters - rebuild everything
surface.params.add('resolution', 10, (value) => {
  // Clear old geodesics
  app.groups.clear('geodesics', true);  // true = dispose

  // Create new ones
  for (let i = 0; i < value; i++) {
    const curve = createGeodesic(i);
    app.groups.add(curve, 'geodesics', `geo${i}`);
  }
});
```

## Best Practices

1. **Use meaningful names**
   ```typescript
   // Good
   app.groups.create('geodesicsOnSphere');
   app.groups.create('curvatureVisualization');

   // Bad
   app.groups.create('group1');
   app.groups.create('temp');
   ```

2. **Organize hierarchically for complex scenes**
   ```typescript
   app.groups.create('visualization');
   app.groups.create('geometry', { parent: 'visualization' });
   app.groups.create('analysis', { parent: 'visualization' });
   app.groups.create('annotations', { parent: 'visualization' });
   ```

3. **Use tags for cross-cutting concerns**
   ```typescript
   app.groups.add(obj1, 'main', 'obj1', ['dynamic', 'pickable']);
   app.groups.add(obj2, 'main', 'obj2', ['static', 'background']);

   // Later: hide all background objects
   const bg = app.groups.getObjectsByTag('background');
   bg.forEach(obj => obj.visible = false);
   ```

4. **Always dispose when clearing**
   ```typescript
   // Good (prevents memory leaks)
   app.groups.clear('temp', true);

   // Bad (leaks geometry/material memory)
   app.groups.clear('temp', false);
   ```

5. **Use groups for bulk operations**
   ```typescript
   // Instead of:
   curve1.visible = false;
   curve2.visible = false;
   curve3.visible = false;

   // Do this:
   app.groups.hide('curves');
   ```

## Performance

### Group Operations Cost

- **create()**: O(1) - Very fast
- **add()**: O(1) - Very fast
- **show/hide()**: O(1) - Very fast
- **getObject()**: O(1) - Hash map lookup
- **getObjectsByTag()**: O(k) where k = number of objects with tag
- **count()**: O(n) where n = children (O(all descendants) if recursive)

### Memory Overhead

- **Per group**: ~200 bytes (THREE.Group + metadata)
- **Per object**: ~50 bytes (WeakMap entry + tag set)
- **Per tag**: ~100 bytes (Map entry + Set)

Negligible for typical scenes (<1000 objects).

### Best Practices

1. **Use groups instead of individual visibility**
   ```typescript
   // Slow (100 operations)
   for (const curve of curves) {
     curve.visible = false;
   }

   // Fast (1 operation)
   app.groups.hide('curves');
   ```

2. **Batch adds when possible**
   ```typescript
   // Create group first
   app.groups.create('curves');

   // Then add many objects
   for (const curve of curves) {
     app.groups.add(curve, 'curves');
   }
   ```

3. **Use tags sparingly**
   - Tags add overhead for indexing
   - Only tag objects you'll search for
   - Consider using groups instead if possible

## Demo

See `demos/groups-demo.ts` for a complete example showing:
- Creating named groups
- Nested group hierarchy
- Adding objects with names and tags
- Show/hide operations
- Bulk transforms
- Object lookup by name/tag
- Scene inspection and statistics
- Interactive keyboard controls

Run with: `npm run dev demos/groups-demo.ts`
