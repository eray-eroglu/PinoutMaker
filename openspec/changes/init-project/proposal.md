## Why

To initialize the `PinoutMaker` project with the necessary technology stack (Electron, React, TypeScript) and UI shell, enabling the development of the pinout diagram creation features.

## What Changes

- Initialize a new Vite project with React and TypeScript templates.
- Configure Electron to wrap the React application.
- Install core dependencies: `react-konva`, `konva`, `tailwindcss`, `lucide-react`, `jspdf`.
- Configure Tailwind CSS for styling.
- Create the initial UI layout (Top Bar, Sidebar, Canvas area) as per the design requirements.

## Capabilities

### New Capabilities
- `project-scaffolding`: Sets up the base Electron+React app, build configuration, and the main UI shell (layout, top bar, sidebar).

### Modified Capabilities
<!-- No existing capabilities to modify -->

## Impact

- Establishes the root project structure.
- Creates `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`.
- Creates initial source files in `src/` and `electron/`.
