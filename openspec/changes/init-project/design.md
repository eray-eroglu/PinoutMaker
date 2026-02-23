## Context
We are starting a new greenfield desktop application called "Pinout Diagram Maker". The goal is to build an interactive tool for creating pinout diagrams for electronics boards. This initial phase focuses purely on setting up the project infrastructure and the basic visual shell.

## Goals / Non-Goals

**Goals:**
- Initialize a modern, type-safe development environment using Electron, React, and TypeScript.
- Establish a fast development workflow with HMR (Hot Module Replacement) via Vite.
- Implement the comprehensive UI layout defined in the specs (Top Bar, Sidebar, Canvas).
- Configure all necessary core dependencies (`react-konva`, `tailwindcss`, `jspdf`, `lucide-react`).

**Non-Goals:**
- Implementing the actual canvas drawing logic (this comes in later phases).
- Implementing data persistence (save/load).
- Implementing PDF export logic (just installing the library for now).

## Decisions

### 1. Project Structure & Build Tooling
We will use **Vite** with the **React + TypeScript** template as the foundation.
- **Rationale**: Vite provides extremely fast build times and a superior dev experience compared to CRA or Webpack.
- **Integration**: We will use a "two-package" approach or a single-package concurrent setup. We'll opt for a single `package.json` structure where:
  - `src/` contains the React frontend.
  - `electron/` contains the Main and Preload scripts.
  - `dist-electron/` and `dist/` will be the build outputs.
- **Dev Workflow**: We will use `concurrently` to run the Vite dev server and the Electron process simultaneously, with `wait-on` ensuring Electron waits for the server to be ready.

### 2. Styling Strategy
We will use **Tailwind CSS**.
- **Rationale**: Speed of development and consistency. It avoids the need for complex CSS files or styled-components boilerplate for the UI shell.
- **Configuration**: Standard `postcss` and `autoprefixer` setup.

### 3. Component Architecture
The UI will be divided into three high-level layout components:
- `TopBar`: Fixed height, flex container.
- `Sidebar`: Fixed width, right-aligned.
- `CanvasStage`: Flex-grow, fills remaining space.
- **State**: For this phase, the layout is static, so no complex global state management (Redux/Zustand) is needed yet.

## Risks / Trade-offs

- **Risk**: **Security (CSP)** - Electron apps require strict Content Security Policies.
  - *Mitigation*: We will configure a safe CSP in the `index.html` and ensure `nodeIntegration` is disabled in the `BrowserWindow` preferences.
- **Risk**: **Native Module Compatibility** - Some packages might need native builds.
  - *Mitigation*: Our current dependencies (`jspdf`, `konva`) are pure JS/Canvas, so no native compilation issues are expected.

## Migration Plan
N/A - This is a new project.
