## Why

To enable the core functionality of the "Pinout Diagram Maker" by implementing the interactive canvas area where users can view diagrams, zoom/pan, and import board images, as defined in Phase 3 of the project plan.

## What Changes

- Implement a zoomable and pannable infinite grid background using `react-konva`.
- Implement image import functionality allowing users to load a board image onto the canvas.
- Define the core `PinData` data structure.

## Capabilities

### New Capabilities
- `canvas-stage`: Handles the main visualization area, including the infinite grid, zoom/pan interactions, and image layer management.

### Modified Capabilities
<!-- No existing capabilities to modify -->

## Impact

- Adds `CanvasStage` logic (currently just a placeholder).
- Adds state management for the stage (scale, position) and the imported image.
- Updates `App.tsx` and `CanvasStage.tsx`.
