# Pinout Diagram Maker - Copilot Instructions

## 1. Project Overview
We are building a desktop application using **Electron + React + TypeScript**. The purpose of the app is to allow users to import an image of an electronics board (PCB) and interactively draw "Pinout Diagrams" by adding labeled, color-coded boxes connected to specific points on the board.

**Visual Reference (Based on latest Figma Design):**
- **Theme:** Light Mode (Clean, White Background).
- **Canvas:** Infinite white background with a light grid pattern.
- **Layout:**
  - **Top Bar:** Contains "Save", "Import", "Export PDF", "+ Add Pin", and a red "Delete Pin" button.
  - **Left/Center:** The main interactive canvas area.
  - **Right Sidebar:** "Pin Properties" panel (Pin Name, Color, PWM Checkbox).

## 2. Tech Stack
- **Core:** Electron, React, TypeScript, Vite.
- **UI Styling:** Tailwind CSS.
- **Canvas/Graphics:** `react-konva` & `konva`.
- **PDF Generation:** `jspdf`.
- **Icons:** `lucide-react`.
- **State:** React `useState`.

---

## 3. Implementation Phases (Task List)

### PHASE 1: Scaffolding & Configuration
- [x] **Task 1.1:** Initialize project with Vite (React + TS template).
- [x] **Task 1.2:** Configure Electron to wrap the React app securely.
- [x] **Task 1.3:** Install dependencies: `react-konva`, `konva`, `tailwindcss`, `postcss`, `autoprefixer`, `lucide-react`, `jspdf`.
- [x] **Task 1.4:** Initialize Tailwind CSS.

### PHASE 2: UI Shell & Layout
- [x] **Task 2.1:** Create the main layout: Flex container (Top Bar, Main Area, Right Sidebar).
- [x] **Task 2.2:** Build the **Top Bar** with the following buttons (Left aligned):
    - **Save:** (Icon: `Save`) - Saves the project state (JSON).
    - **Import:** (Icon: `Upload`) - Imports the board image.
    - **Export PDF:** (Icon: `FileDown`) - Generates the PDF.
    - **Separator** (Visual divider).
    - **+ Add Pin:** (Icon: `Plus`) - Adds a new pin.
    - **Delete Pin:** (Icon: `Trash2`, Color: Red text/icon) - Deletes selected pin.
- [x] **Task 2.3:** Build the **Right Sidebar**:
    - Title: "Pin Properties".
    - Fields:
      - "Pin Name" (Input field).
      - "Label Color" (Grid of rounded square swatches: Red, Blue, Green, Orange, Purple, Pink, Teal, Yellow).
      - "PWM Capable" (Checkbox).
    - *Note:* If no pin is selected, the form inputs should be disabled or hidden.

### PHASE 3: The Canvas (Konva.js Logic)
- [x] **Task 3.1:** Create a `CanvasStage` component with Infinite Grid Background (Zoom/Pan enabled).
- [x] **Task 3.2:** Implement **Image Import**: Load user image into Konva `Layer`, center it on the grid.
- [x] **Task 3.3:** Define `PinData` interface (id, x, y, targetX, targetY, text, color, isPwm).

### PHASE 4: Interactive Pin Logic
- [x] **Task 4.1:** Create `PinLabel` Component:
    - `Line`: Connects target to label.
    - `Rect`: Background box (rounded).
    - `Text`: Pin name.
- [x] **Task 4.2:** Implement **Drag & Drop**:
    - Move Label -> Updates `x, y`.
    - Move Anchor (Target) -> Updates `targetX, targetY`.
- [x] **Task 4.3:** Implement **Selection**: Clicking a pin sets it as "active" and populates the Sidebar.
- [x] **Task 4.4:** Two-way Binding: Sidebar edits update the Canvas instantly.
- [x] **Task 4.5:** Implement **Delete Logic**:
    - Clicking the "Delete Pin" button in the Top Bar removes the currently selected pin from the state.

### PHASE 5: Visual Polish
- [x] **Task 5.1:** Implement "PWM Wavy Line": If `isPwm` is true, change the connector line style to a custom wave pattern or dashed line to distinguish it.
- [x] **Task 5.2:** "Add Pin" Button Logic: Adds new pin at the center of the current view.

### PHASE 6: Persistence & Export
- [x] **Task 6.1:** **Save Project (JSON):**
    - The "Save" button should write the current state (pins + image path) to a `.json` file so the user can continue working later.
- [x] **Task 6.2:** **Load Project:**
    - Allow loading a previously saved `.json` file to restore the workspace.
- [x] **Task 6.3:** **Export as PDF (Strictly PDF):**
    - The "Export PDF" button must generate a high-quality PDF.
    - Logic: Convert the Konva Stage to an image, then use `jspdf` to place it into a PDF document (Landscape A4 or Auto-size) and trigger a download/save dialog.