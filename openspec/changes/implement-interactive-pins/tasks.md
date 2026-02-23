## 1. Core State & Types

- [x] 1.1 Verify/Update `PinData` interface in `src/types.ts` to include `id`, `x`, `y`, `targetX`, `targetY`, `text`, `color`, `isPwm`.
- [x] 1.2 Initialize `pins` (Array) and `selectedPinId` (string | null) state in `src/App.tsx`.
- [x] 1.3 Create handler functions in `App.tsx`: `addPin`, `updatePin`, `deletePin`, `selectPin`.

## 2. Pin Component Implementation

- [x] 2.1 Create `src/components/PinComponent.tsx` using `react-konva`.
- [x] 2.2 Implement the visual structure: `Group` (Label), `Rect` (Background), `Text` (Name), `Circle` (Anchor), `Line` (Connector).
- [x] 2.3 Implement PWM styling: If `isPwm` is true, set the connector line `dash` property to `[10, 5]`.
- [x] 2.4 Implement `useRef` hooks for Label, Anchor, and Line nodes to support direct manipulation.

## 3. Interactive Logic (Drag & Drop)

- [x] 3.1 Implement `onDragMove` for the Label Group: Update the connector line points via refs (without triggering React state updates).
- [x] 3.2 Implement `onDragMove` for the Anchor Circle: Update the connector line points via refs.
- [x] 3.3 Implement `onDragEnd` for both Label and Anchor: Calculate new positions and call `onUpdatePin` to sync with `App` state.

## 4. Selection & Canvas Integration

- [x] 4.1 Implement `onClick` / `onTap` on `PinComponent`: Call `onSelect` and set `cancelBubble = true` to stop propagation.
- [x] 4.2 Update `src/components/CanvasStage.tsx` to render the list of `PinComponent`s based on the `pins` prop.
- [x] 4.3 Implement background click handling in `CanvasStage`: Clicking the grid background should call `onSelect(null)` (deselect).

## 5. Sidebar & TopBar Integration

- [x] 5.1 Update `src/components/Sidebar.tsx` to accept the `selectedPin` object and an `onChange` handler.
- [x] 5.2 Bind "Pin Name", "Label Color", and "PWM Capable" inputs to the `selectedPin` data (Two-way data binding).
- [x] 5.3 Update `src/components/TopBar.tsx` to handle the "Delete Pin" button click.
- [x] 5.4 Wire up the "Delete Pin" button to the `deletePin` handler in `App.tsx`.
