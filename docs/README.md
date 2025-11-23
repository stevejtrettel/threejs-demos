# Documentation

## Structure

### `/guides` - User-Facing Guides
How-to guides for using the framework.

- **getting-started.md** - Quick start guide for the App class and built-in managers

### `/reference` - API Reference
Detailed API documentation (to be added as features are built).

### `/architecture` - Architecture & Design
Design decisions, patterns, and technical specifications.

- **architecture.md** - Overall framework architecture
- **type-contracts.md** - TypeScript type contracts and interfaces
- **renderer-configuration.md** - WebGL renderer setup
- **patterns/** - Design patterns used in the framework
  - **component-lifecycle.md** - rebuild/update pattern
  - **safe-rebuild.md** - Safe geometry/material swapping

### `/planning` - Project Planning
Project plans, roadmaps, and status tracking (mostly historical).

- **infrastructure-dependency-map.md** - Feature dependencies and build order
- **infrastructure-priorities.md** - Infrastructure needs organized by tier
- **infrastructure-roadmap.md** - Original infrastructure roadmap
- **infrastructure-plan.md** - Detailed infrastructure plan
- **complete-implementation-timeline.md** - Week-by-week implementation plan
- **build-plan.md** - Original build plan
- **geodesic-implementation-status.md** - Geodesic computation status
- **math-needs.md** - Mathematical infrastructure requirements
- **update-strategies.md** - Parameter update strategies
- **helpers-and-materials.md** - Helper and material patterns

## Quick Links

**Getting Started**: [`guides/getting-started.md`](guides/getting-started.md)

**Current Infrastructure Status**: Layer 1 Complete (AssetManager, DebugManager)

**Next Steps**: See [`planning/infrastructure-dependency-map.md`](planning/infrastructure-dependency-map.md) for Layer 2
