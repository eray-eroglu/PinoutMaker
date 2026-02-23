## ADDED Requirements

### Requirement: Electron-React Application Shell
The system SHALL run as a desktop application using Electron to host a React + TypeScript frontend built with Vite.

#### Scenario: Application Launch
- **WHEN** the user launches the application
- **THEN** the main Electron window appears displaying the React interface
- **AND** the window title is "Pinout Diagram Maker"

### Requirement: Core Dependencies
The system SHALL include the necessary libraries for graphics, styling, and PDF generation.

#### Scenario: Dependency Availability
- **WHEN** the application is built
- **THEN** `react-konva`, `konva`, `tailwindcss`, `lucide-react`, and `jspdf` are available for import

### Requirement: Application Layout
The user interface SHALL be organized into three distinct areas: a top toolbar, a main canvas area, and a properties sidebar.

#### Scenario: Layout rendering
- **WHEN** the application loads
- **THEN** the Top Bar is displayed at the top of the window
- **AND** the Sidebar is displayed on the right side
- **AND** the Canvas area occupies the remaining space in the center/left

### Requirement: UI Styling
The application SHALL use Tailwind CSS for component styling and layout.

#### Scenario: Tailwind configuration
- **WHEN** the application is built
- **THEN** Tailwind utility classes are compiled and applied to the UI elements
