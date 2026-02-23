## ADDED Requirements

### Requirement: Infinite Grid Background
The canvas SHALL display an infinite grid pattern that serves as the background for the pinout diagram.

#### Scenario: Grid Rendering
- **WHEN** the canvas loads
- **THEN** a grid pattern is visible covering the entire viewable area

### Requirement: Zoom and Pan Interactions
The user SHALL be able to zoom in/out and pan across the canvas to inspect different parts of the board.

#### Scenario: Zooming
- **WHEN** the user uses the mouse wheel over the canvas
- **THEN** the view scale increases (zoom in) or decreases (zoom out) focused on the pointer position

#### Scenario: Panning
- **WHEN** the user clicks and drags on the background
- **THEN** the view position moves with the cursor

### Requirement: Board Image Import
The system SHALL allow users to import an image file to serve as the reference board for the diagram.

#### Scenario: Image Loading
- **WHEN** the user selects an image file via the Import button
- **THEN** the image is rendered on the canvas
- **AND** the image is centered in the initial view

### Requirement: Pin Data Structure
The system SHALL define a `PinData` structure to effectively manage pin information.

#### Scenario: Data Definition
- **WHEN** the application starts
- **THEN** a TypeScript interface `PinData` is available with fields: `id`, `x`, `y`, `targetX`, `targetY`, `text`, `color`, `isPwm`
