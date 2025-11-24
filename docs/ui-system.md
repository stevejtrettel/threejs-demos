# UI System

The custom UI system provides a lightweight, adaptable interface for controlling 3D applications without external dependencies.

## Architecture

The UI is organized into two semantic categories:

```
src/ui/
├── containers/    # Hold other components
│   ├── Container.ts (base)
│   ├── Panel.ts
│   ├── Window.ts
│   ├── Modal.ts
│   └── Folder.ts
├── inputs/        # Capture user values
│   ├── Input.ts (base)
│   ├── Button.ts
│   ├── Slider.ts
│   ├── TextInput.ts
│   ├── ColorInput.ts
│   └── Toggle.ts
└── styles/        # CSS for all components
```

## Container Types

### Panel (Sidebar)
Fixed sidebar for persistent controls.

```typescript
import { Panel } from './ui/containers/Panel';

const panel = new Panel('Controls');
panel.add(someInput);
panel.mount(document.body);
```

### Window (Floating)
Draggable, closeable popup for temporary tools.

```typescript
import { Window } from './ui/containers/Window';

const window = new Window('Screenshot Settings', {
  width: 320,
  height: 220,
  x: 100,
  y: 100,
  draggable: true
});

window.add(someInput);
window.open();  // Show window
window.close(); // Hide window
```

### Modal (Overlay)
Centered dialog that blocks interaction with the scene.

```typescript
import { Modal } from './ui/containers/Modal';

const modal = new Modal('Export Dashboard', {
  width: 600,
  height: 450,
  closeOnBackdrop: true
});

modal.add(someInput);
modal.open();  // Show with backdrop
modal.close(); // Hide modal
```

### Folder (Grouping)
Collapsible section for organizing controls.

```typescript
import { Folder } from './ui/containers/Folder';

const folder = new Folder('Advanced Settings');
folder.add(someInput);
folder.open();  // Expand
folder.close(); // Collapse
```

## Input Types

All inputs follow a consistent pattern with `setValue()` and `getValue()`.

### Button
```typescript
import { Button } from './ui/inputs/Button';

const btn = new Button('Click Me', () => {
  console.log('Clicked!');
});
```

### Slider
```typescript
import { Slider } from './ui/inputs/Slider';

const slider = new Slider(50, {
  min: 0,
  max: 100,
  step: 1,
  label: 'Speed',
  onChange: (value) => {
    object.speed = value;
  }
});

slider.setValue(75);  // Update programmatically
const val = slider.getValue(); // Read current value
```

### TextInput
```typescript
import { TextInput } from './ui/inputs/TextInput';

const input = new TextInput('default', {
  label: 'Name',
  onChange: (value) => {
    object.name = value;
  }
});
```

### ColorInput
```typescript
import { ColorInput } from './ui/inputs/ColorInput';

const color = new ColorInput('#ff0000', {
  label: 'Color',
  onChange: (hex) => {
    material.color.set(hex);
  }
});
```

### Toggle
```typescript
import { Toggle } from './ui/inputs/Toggle';

const toggle = new Toggle(false, {
  label: 'Wireframe',
  onChange: (checked) => {
    material.wireframe = checked;
  }
});
```

## ControlRoom (Orchestrator)

The `ControlRoom` integrates with app managers to provide a complete UI automatically.

```typescript
import { ControlRoom } from './ui/ControlRoom';

const controlRoom = new ControlRoom(
  app.timeline,
  app.cameraManager,
  app.params,
  app.export,
  app.screenshots,
  app.video
);

// Add to animation loop for two-way binding
app.addAnimateCallback(() => {
  controlRoom.update();
});
```

Features:
- **Main folder**: Timeline controls (play/pause, speed)
- **Scene folder**: Dynamic parameters from `ParameterManager`
- **Studio folder**: Screenshot and video export tools
- **System folder**: Debug and camera controls

## Styling

The UI uses CSS custom properties for theming:

```css
/* Import all styles */
import './ui/styles/index.css';
```

Override theme variables:
```css
:root {
  --cr-bg-primary: #1a1a1a;
  --cr-text-accent: #4da6ff;
  --cr-sidebar-width: 300px;
}
```

## Examples

See complete working examples in:
- `demos/test/ui-demo.ts` - Panel with live parameters
- `demos/test/popup-demo.ts` - Draggable Window
- `demos/test/overlay-demo.ts` - Modal with export dashboard
