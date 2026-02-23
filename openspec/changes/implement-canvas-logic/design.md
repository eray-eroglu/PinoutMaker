## Context
The current application setup includes a placeholder `CanvasStage` component. We need to upgrade this component to support the core visualization capabilities: displaying an infinite grid, handling zoom/pan interactions, and rendering an imported image of a PCB. This is critical for Phase 3 of functionality.

## Goals / Non-Goals
**Goals:**
- Implement the infinite grid using `react-konva`.
- Implement smooth zoom and pan interactions.
- Enable users to import an image and display it on the canvas.
- Define the `PinData` TypeScript interface for future use.

**Non-Goals:**
- Interactive pin placement (Phase 4).
- Pin selection or property editing (Phase 4).
- Saving/Loading projects (Phase 6).

## Decisions

### 1. Canvas Library
We will continue using **Konva.js / react-konva**.
- **Rationale**: It provides a robust scene graph for canvas manipulation, which significantly simplifies handling layers, groups, and event listeners compared to raw HTML5 Canvas API.

### 2. State Management
We will use React `useState` for managing stage scale, position, and the imported image.
- **Rationale**: The state is local to the canvas/app view and doesn't yet require a global store like Redux. Lifting state up to `App.tsx` (or a context) will allow the TopBar to trigger image imports that affect the CanvasStage.

### 3. Grid Implementation
The grid will be drawn as a static background shape (using `Konva.Shape` or a pattern) that updates its offset based on the stage position.
- **Rationale**: This creates the illusion of an infinite grid without rendering millions of individual line objects.

### 4. Image Import
We will specificially use the `URL.createObjectURL` API to load local images selected via a file input.
- **Rationale**: This avoids uploading files to a server and keeps everything local and fast for a desktop app context.

## Risks / Trade-offs
- **Risk**: Large images might cause performance issues.
  - **Mitigation**: Konva handles large images reasonably well, but we should eventually consider downscaling very large inputs. For now, we'll assume valid input sizes.

## Open Questions
- None. The requirements for this phase are strictly defined in `copilot-instructions.md`.
