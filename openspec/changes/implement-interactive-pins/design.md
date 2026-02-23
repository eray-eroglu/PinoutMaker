## Context

The project currently displays an infinite grid and allows image import, managed by Konva variables. We need to introduce the primary domain object: the "Pin". A Pin consists of a Label (text + box) and a Target (anchor point on the board), connected by a line. This interaction is the core feature of the application.

## Goals / Non-Goals

**Goals:**
- Implement the `PinLabel` component using `react-konva`.
- Enable independent dragging of the label vs. the anchor target.
- Implement efficient line rendering that updates during dragging without causing excessive React re-renders.
- Establish the data flow for pin selection and property editing (Two-way binding sidebar).
- Handle pin deletion.

**Non-Goals:**
- Complex routing algorithms for the connector line (straight line is sufficient).
- Multiple pin selection (single selection only).
- Undo/Redo history (postponed to a later change).

## Decisions

### 1. State Management
We will lift state up to `App.tsx`.
- **State**: `pins` (Array<PinData>) and `selectedPinId` (string | null).
- **Justification**: This state needs to be shared between the `CanvasStage` (rendering) and `Sidebar` (editing).

### 2. Component Structure
We will create a `PinComponent` that renders the three visual elements for a single pin.
- **Visuals**:
  1.  **Label Group**: A `Konva.Group` containing a `Rect` (background) and `Text`. This group will be `draggable`.
  2.  **Anchor**: A `Konva.Circle` representing the target point. This will be `draggable`.
  3.  **Connector**: A `Konva.Line` connecting the Label center and Anchor center.
- **Justification**: Encapsulating all parts of a pin in one component simplifies the rendering loop in `CanvasStage`.

### 3. Drag Performance Strategy (Ref-based updates)
Updating the global React state (array of pins) on every `dragmove` event can be performance-heavy and cause jitter.
- **Approach**:
  - We will let Konva handle the immediate dragging visualization natively.
  - We will use `useRef` to access the Label Group, Anchor, and Connector Line nodes.
  - On the `onDragMove` event of the Label or Anchor, we will manually update the points of the Connector Line using `lineRef.current.points([...])`. This avoids React re-renders during the drag.
  - On `onDragEnd`, we will dispatch the final coordinates up to `App.tsx` to update the persistent state.
- **Justification**: Ensures smooth 60fps animations while dragging.

### 4. Selection Logic
- Clicking a Pin's Label or Anchor calls `onSelect(pinId)`.
- We must call `e.cancelBubble = true` in the click handler to prevent the click from propagating to the Stage (which handles Deselect).
- Clicking the Stage (`onClick` on the background Rect) calls `onSelect(null)` to deselect.

## Risks / Trade-offs

- **Risk**: "Controlled" vs "Uncontrolled" drift. If we bypass React state during drag, we must ensure the React state is correctly updated at the end, or the UI will snap back.
  - **Mitigation**: The `onDragEnd` handler must accurately read `e.target.x()` and `e.target.y()` and sync to the store.
- **Risk**: PWM Wavy Line implementation complexity with standard Konva Line.
  - **Mitigation**: For now, we will use a dashed line property (`dash: [10, 5]`) to represent PWM, or a custom shape if strictly required. The Spec says "wavy or dashed", so dashed is acceptable for MVP.
