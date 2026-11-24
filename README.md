# PinoutMaker

A browser-based editor for creating pinout diagrams of electronics boards.

Import a board photo (or pick one from the Boardoza product library), drop pins on it,
label and color them, draw connection lines, and export the result as a PDF, SVG or PNG.

## Features

- **Board images** – import from disk or the Supabase-backed product library; move, resize
  (aspect-locked) and rotate; multiple images per project.
- **Pins** – click to place an anchor, the label is connected with an L-shaped leader line.
  PWM pins get a wavy line. Colors are suggested from the pin name (GND, SDA, MOSI, …) until
  you pick one by hand.
- **Alignment** – labels snap to each other's edges and to a configurable gap while dragging
  (hold <kbd>Ctrl</kbd> to disable).
- **Headers** – *Add Header*: click the first and the last pad of a pin row, then choose the pin
  count, naming (prefix + start + step, or blank) and label side (Auto faces away from the board).
  The pins are spaced evenly with their labels in a clean column (left/right) or fanned out in
  stacked rows (above/below), all in one undo step.
- **Pin tables** – *Pin table…* (or *Fill header from table…* on a header pin) pastes a table from
  a datasheet, Excel/Sheets (tab-separated) or CSV (`,`/`;`, quoted cells): one line per pin, name
  first, then its functions. Names and functions get smart colours; *Reverse order* fills the
  header from its last pin.
- **Lines** – orthogonal polylines: click to add corners, double-click to finish, <kbd>Esc</kbd> to cancel.
- **Legend table** – editable color legend, shown on the canvas and in exports.
- **Projects** – save/load as JSON (uses the File System Access API where available, so
  <kbd>Ctrl</kbd>+<kbd>S</kbd> overwrites the open file). Older project formats are migrated on load.
- **Export** – vector PDF (A4, selectable text), standalone SVG for web pages, or high-resolution
  PNG (×1/×2/×4, optional transparent background); the legend can be included or left out.

### Shortcuts

| Keys | Action |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> (or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>) | Undo / redo |
| <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>V</kbd> | Copy / paste pin or line (repeated pastes are offset) |
| <kbd>Del</kbd> / <kbd>Backspace</kbd> | Delete selection |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Save |
| <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> | Nudge selected pin label, line or image by 1 px (<kbd>Shift</kbd>: 10 px); one undo step per key hold |
| <kbd>Alt</kbd>+arrows | Move the whole pin (label and anchor) |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> | Duplicate selected pin or line (does not touch the clipboard) |
| <kbd>Shift</kbd>+<kbd>1</kbd> | Fit all content to the screen (also the button next to the scale indicator) |
| <kbd>Ctrl</kbd>+<kbd>0</kbd> | Reset zoom to 100%, centred on the content |
| <kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> | Zoom in / out around the canvas centre |
| <kbd>Shift</kbd> (Add Header) | Keep the header exactly horizontal / vertical while picking the last pad |
| <kbd>Ctrl</kbd>+<kbd>Enter</kbd> | Apply the pin table (in the pin table dialog) |
| <kbd>Esc</kbd> | Clear selection, cancel line drawing / add-pin / add-header mode |
| <kbd>?</kbd> | Show / hide the shortcuts overlay |
| Mouse wheel | Zoom |

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the tests (Vitest)
npm run lint
npm run build    # type-check and build to dist/
```

### Environment variables

The product library needs a Supabase project with a readable `products` table
(`id`, `name`, `category`, `image_url`). Create `.env.local`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Set the same variables in the Netlify environment settings for production. Without them the
app still works; only the library panel is disabled.

The anon key is public by design, so make sure Row Level Security on `products` only allows
`select`. Library images must be served with CORS headers (Supabase Storage does this), otherwise
exports cannot read their pixels.

## Project structure

```
src/
  App.tsx                 state, undo/redo, shortcuts, save/load
  components/
    CanvasStage.tsx       Konva stage: images, pins, lines, snapping guides
    PinComponent.tsx      a pin: anchor, label and leader line
    LineComponent.tsx     an editable orthogonal polyline
    Sidebar.tsx           properties of the selection, project and legend settings
    TopBar.tsx            toolbar
    ProductLibrary.tsx    Supabase product library panel
  utils/
    pinUtils.ts           label position, nudging, smart colors
    imageResize.ts        rotation-aware resize math
    project.ts            project (de)serialization, migration, image loading
    export/               scene model (scene.ts) + PDF, SVG and PNG renderers
    lineUtils.ts          Manhattan paths and PWM waves
```

All positions are stored in **world coordinates** (board-image pixels): `pin.x/pin.y` is the
label's top-left corner, `targetX/targetY` its anchor. Labels, anchors, leader lines and drawn lines
are sized by the project-wide `labelScale`, so zooming scales the board and its labels together and
the layout never shifts. `labelScale` is fixed from the current zoom when the first pin or line is
created, and can be changed with *Label Size* in the sidebar. Older project files (which stored
zoom-dependent screen-pixel offsets) are converted on load, frozen at the zoom they were saved with.
