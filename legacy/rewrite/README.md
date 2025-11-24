# Math Library Structure

This is the core mathematical toolkit for Three.js visualizations.

## Structure

- **points/** - Point operations and transformations
- **curves/** - Curve classes (parametric, level curves, etc.)
- **surfaces/** - Surface classes (parametric, implicit, graphs, etc.)
- **diffgeo/** - Differential geometry (geodesics, metrics, curvature)
- **algorithms/** - General-purpose mathematical algorithms
- **viz/** - Visual helpers for debugging and presentation
- **orig/** - Original code being refactored (temporary holding area)

## Philosophy

Only **stable, reusable primitives** belong here. Code goes in `math/` if you would:
1. Use it across 10+ different demos
2. Hate to rewrite it
3. Consider it a fundamental building block

If code is specialized or demo-specific, it lives in the demo itself.

## Current Status

🚧 **Under construction** - The structure exists, but the implementations need to be thoughtfully selected and refactored from `orig/`.

Next steps:
1. Review what exists in `orig/`
2. Decide what deserves to be in the core
3. Refactor and implement clean versions in the appropriate subdirectories
4. Remove `orig/` when migration is complete
