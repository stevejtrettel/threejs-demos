# Selection & Picking System

Object picking and selection via the `SelectionManager`.

**Location**: `src/app/SelectionManager.ts`
**Access**: `app.selection`

## Overview

The SelectionManager provides:
- **Raycasting**: Click and hover detection on 3D objects
- **Visual Highlighting**: Selected objects get wireframe overlay
- **Event Callbacks**: Global and per-object onClick/onHover handlers
- **Filtering**: Control which objects are pickable or ignored
- **Lightweight**: Wraps Three.js Raycaster for optimal performance

## Quick Start

```typescript
import { App } from '../src/app/App';

const app = new App();

// Enable selection
app.selection.enable();

// Add object with click handler
const sphere = new THREE.Mesh(geometry, material);
sphere.name = 'My Sphere';
sphere.onClick = (result) => {
  console.log('Sphere clicked at', result.point);
};
app.scene.add(sphere);

// Listen to selection changes globally
app.selection.onSelectionChange((object) => {
  if (object) {
    console.log('Selected:', object.name);
  }
});
```

## Enabling Selection

**`enable(): void`**

Enable picking and selection. Adds mouse event listeners.

```typescript
app.selection.enable();
```

**`disable(): void`**

Disable picking and selection. Removes event listeners.

```typescript
app.selection.disable();
```

## Per-Object Callbacks

Objects can define `onClick` and `onHover` properties to handle their own interaction.

### onClick

```typescript
const mesh = new THREE.Mesh(geometry, material);
mesh.name = 'Clickable Object';

// Define onClick handler
mesh.onClick = (result) => {
  console.log(`${mesh.name} was clicked!`);
  console.log('Clicked at world position:', result.point);
  console.log('Distance from camera:', result.distance);

  // Example: Start animation
  gsap.to(mesh.rotation, { y: mesh.rotation.y + Math.PI * 2 });

  // Example: Show UI for this object's parameters
  showParameterPanel(mesh);
};

app.scene.add(mesh);
```

### onHover

```typescript
const mesh = new THREE.Mesh(geometry, material);

// Define onHover handler
mesh.onHover = (result) => {
  console.log('Hovering over object');
  // Could show tooltip, highlight differently, etc.
};

app.scene.add(mesh);
```

### IntersectionResult

Both `onClick` and `onHover` receive an `IntersectionResult` object:

```typescript
interface IntersectionResult {
  object: THREE.Object3D;  // The intersected object
  point: THREE.Vector3;    // World coordinates of intersection
  distance: number;        // Distance from camera
  face: THREE.Face | null; // Intersected face (if available)
  faceIndex: number | null;// Face index (if available)
}
```

## Global Event Callbacks

### onObjectClick

Register callback for all click events.

```typescript
app.selection.onObjectClick((result) => {
  if (result) {
    console.log('Clicked object:', result.object.name);
    console.log('At position:', result.point);
  } else {
    console.log('Clicked empty space');
  }
});
```

### onObjectHover

Register callback for hover events.

```typescript
app.selection.onObjectHover((result) => {
  if (result) {
    console.log('Hovering:', result.object.name);
  }
});
```

### onSelectionChange

Register callback for selection changes.

```typescript
app.selection.onSelectionChange((object) => {
  if (object) {
    console.log('Selected:', object.name);
    // Update UI, expose parameters, etc.
  } else {
    console.log('Deselected');
  }
});
```

## Selection Control

### Programmatic Selection

```typescript
// Select an object
app.selection.select(myObject);

// Deselect
app.selection.deselect();

// Get current selection
const selected = app.selection.getSelected();
if (selected) {
  console.log('Currently selected:', selected.name);
}
```

## Filtering

### Pickable Objects

By default, all scene objects are pickable. You can restrict to specific objects:

```typescript
// Add objects to pickable set
app.selection.addPickable(surface);
app.selection.addPickable(curve);

// Now only surface and curve can be selected
// (Remove to allow all objects again)
app.selection.removePickable(surface);
```

### Ignored Objects

Exclude specific objects from picking (e.g., ground plane, helpers):

```typescript
// Ignore ground plane
app.selection.addIgnored(ground);

// Also ignore helper objects
app.selection.addIgnored(axesHelper);

// Stop ignoring
app.selection.removeIgnored(ground);
```

## Visual Highlighting

### Default Highlighting

Selected objects automatically get a yellow wireframe overlay.

```typescript
// Object is selected - wireframe appears
app.selection.select(object);

// Deselect - wireframe removed
app.selection.deselect();
```

### Update Highlight

If selected object moves/rotates, update highlight to match:

```typescript
app.addAnimateCallback((time) => {
  // Rotate object
  myObject.rotation.y += 0.01;

  // Update highlight position
  app.selection.updateHighlight();
});
```

**Note**: The demo already calls `updateHighlight()` automatically.

## Performance

### How It Works

Uses Three.js `Raycaster` for picking:
- **Event-driven**: Only runs on mousemove/click
- **Optimized**: Bounding box acceleration (not testing every triangle)
- **Lightweight**: ~0.1-0.5ms for 100 objects
- **Overhead**: Minimal (~0.01ms wrapper cost)

### Best Practices

1. **Use filtering** - Ignore objects that don't need selection
2. **Limit pickable set** - For dense scenes, specify pickable objects
3. **Disable when not needed** - `app.selection.disable()` when in animation mode

## Common Patterns

### Pattern 1: Show Object Parameters on Click

```typescript
surface.onClick = (result) => {
  // Show UI panel with this object's parameters
  if (surface.params) {
    showParameterPanel(surface.params);
  }
};
```

### Pattern 2: Interactive Math Objects

```typescript
// Click surface to show curvature at point
surface.onClick = (result) => {
  const curvature = surface.getCurvatureAt(result.point);
  console.log('Gaussian curvature:', curvature.gaussian);
  console.log('Mean curvature:', curvature.mean);
};

// Click curve to show tangent
curve.onClick = (result) => {
  const tangent = curve.getTangentAt(result.point);
  addArrowHelper(result.point, tangent);
};
```

### Pattern 3: Toggle Animation

```typescript
let isAnimating = false;

object.onClick = () => {
  isAnimating = !isAnimating;
  console.log(isAnimating ? 'Animation started' : 'Animation stopped');
};

app.addAnimateCallback(() => {
  if (isAnimating) {
    object.rotation.y += 0.01;
  }
});
```

### Pattern 4: Multiple Selection Targets

```typescript
// Different behavior for different objects
const objects = [sphere, cube, torus];

objects.forEach(obj => {
  obj.onClick = (result) => {
    console.log(`You clicked a ${obj.geometry.type}`);

    // Object-specific behavior
    if (obj === sphere) {
      startSphereAnimation();
    } else if (obj === cube) {
      showCubeProperties();
    }
  };
});
```

## Examples

### Example 1: Basic Selection

```typescript
const app = new App();
app.selection.enable();

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
sphere.name = 'Red Sphere';

app.scene.add(sphere);

// Object gets yellow wireframe when clicked
```

### Example 2: Per-Object Interaction

```typescript
const surface = new ParametricSurface({...});

surface.mesh.onClick = (result) => {
  console.log('Surface clicked at', result.point);

  // Show curvature visualization
  const K = surface.gaussianCurvature(result.point);
  surface.params.set('showCurvature', true);
  surface.params.set('curvatureValue', K);
};

app.add(surface);
```

### Example 3: Hover Tooltips

```typescript
const objects = [surface1, surface2, surface3];

objects.forEach(obj => {
  obj.mesh.onHover = (result) => {
    showTooltip(obj.name, result.point);
  };
});

// Global hover handler to hide tooltip when not hovering
app.selection.onObjectHover((result) => {
  if (!result) {
    hideTooltip();
  }
});
```

## Future Features

See `TODO.md` for planned enhancements:
- Multi-selection (Ctrl+click)
- Dragging objects with constraints
- Keyboard shortcuts (Escape to deselect, Delete to remove)
- Better highlighting (outline shaders, glow effects)
- Transform gizmos

## Demo

See `demos/selection-demo.ts` for a complete example showing:
- Clicking to select objects
- Yellow wireframe highlighting
- Per-object onClick and onHover handlers
- Global event callbacks
- Filtered objects (ground plane ignored)
- Highlight tracking for rotating objects
