## 1. Core Data Structures

- [x] 1.1 Define `PinData` interface in `src/types.ts` (id, x, y, targetX, targetY, text, color, isPwm).

## 2. Canvas Stage Implementation

- [x] 2.1 Update `CanvasStage` to handle `scale` and `position` state (zoom/pan logic).
- [x] 2.2 Implement infinite grid background rendering in `CanvasStage`.
- [x] 2.3 Add event listeners for wheel (zoom) and drag (pan) interactions on the Stage.

## 3. Image Import Logic

- [x] 3.1 Lift necessary state to `App.tsx` (or context) to allow `TopBar` to control image import.
- [x] 3.2 Implement file selection handler in `TopBar` ("Import" button).
- [x] 3.3 Pass imported image URL to `CanvasStage` and render it using `Konva.Image`.
- [x] 3.4 Ensure the imported image is centered on the canvas upon loading.
