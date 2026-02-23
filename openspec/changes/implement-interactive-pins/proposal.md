## Why

Users currently can view the grid and import images, but they cannot yet create the actual pinout diagram. This change enables the core value proposition of the app by allowing users to interactively add, move, edit, and delete pins on the canvas.

## What Changes

- Create a visual `PinLabel` component (box, text, connecting line).
- Implement drag-and-drop logic for both the pin label and its anchor point.
- Enable pin selection to display properties in the Sidebar.
- Implement two-way binding: modifying the Sidebar updates the canvas immediately.
- Add functionality to delete the selected pin.

## Capabilities

### New Capabilities
- `interactive-pin-editing`: Covers the rendering of pin components, user interactions (selection, dragging labels and anchors), and synchronization of pin properties with the application state.

### Modified Capabilities
<!-- No existing capabilities are being modified at the spec requirement level. -->

## Impact

- **UI Components**:
    - `CanvasStage.tsx`: Will handle rendering the list of pins and bridging Konva events to React state.
    - `Sidebar.tsx`: Will need to bind its inputs to the `selectedPin` state.
    - `TopBar.tsx`: Will activate the "Delete" button when a pin is selected.
- **State Management**:
    - `App.tsx`: Will hold the master list of `PinData` and the `selectedPinId`.
