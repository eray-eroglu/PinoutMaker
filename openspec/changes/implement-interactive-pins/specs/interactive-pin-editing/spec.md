## ADDED Requirements

### Requirement: Pin Visual Representation
The system SHALL render a visual representation of a pin consisting of a label box, a text label, an anchor point (target), and a connecting line between the label and the anchor.

#### Scenario: Render a pin
- **WHEN** a pin exists in the application state
- **THEN** a label box is rendered at the pin's (x, y) coordinates
- **AND** an anchor point is rendered at the pin's (targetX, targetY) coordinates
- **AND** a line connects the center of the label box to the valid edge of the anchor point (or center)

### Requirement: Pin Selection
The system SHALL allow users to select a specific pin to make it active for editing.

#### Scenario: Select a pin by clicking
- **WHEN** the user clicks on a pin's label or anchor
- **THEN** the pin is marked as "selected"
- **AND** the sidebar forms are populated with the pin's current data

#### Scenario: Deselect on canvas click
- **WHEN** the user clicks on the empty canvas background
- **THEN** the currently selected pin is deselected
- **AND** the sidebar forms are disabled or cleared

### Requirement: Pin Label Repositioning
The system SHALL allow users to move the pin label independently of its anchor point via drag-and-drop.

#### Scenario: Drag pin label
- **WHEN** the user drags a pin's label box
- **THEN** the label's (x, y) coordinates update in real-time
- **AND** the connecting line updates to follow the new label position
- **AND** the anchor point remains at its original position

### Requirement: Pin Anchor Repositioning
The system SHALL allow users to move the pin's target anchor point independently of its label via drag-and-drop.

#### Scenario: Drag pin anchor
- **WHEN** the user drags a pin's anchor point
- **THEN** the anchor's (targetX, targetY) coordinates update in real-time
- **AND** the connecting line updates to follow the new anchor position
- **AND** the label box remains at its original position

### Requirement: Real-time Property Updates
The system SHALL update the visual appearance of a pin immediately when its properties are modified in the sidebar.

#### Scenario: Update pin name
- **WHEN** the user types in the "Pin Name" field in the sidebar
- **THEN** the text inside the selected pin's label updates immediately

#### Scenario: Update pin color
- **WHEN** the user selects a new color in the sidebar
- **THEN** the background color of the selected pin's label updates immediately

#### Scenario: Toggle PWM status
- **WHEN** the user toggles the "PWM Capable" checkbox
- **THEN** the visual style of the connecting line changes (e.g., to a wavy or dashed line)

### Requirement: Pin Deletion
The system SHALL allow users to remove the currently selected pin.

#### Scenario: Delete selected pin
- **WHEN** a pin is selected
- **AND** the user clicks the "Delete Pin" button
- **THEN** the pin is removed from the canvas
- **AND** the selection state is cleared
