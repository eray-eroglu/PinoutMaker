import type { BoardImage, LegendItem, LegendMode, LineData, PinData } from '../../types';
import { getLegendRows } from '../legend';
import { buildOrthogonalPoints, calculateManhattanPath, calculateWavePoints } from '../lineUtils';
import { isLightColor } from '../colorUtils';
import { measureLabelText } from '../labelMeasure';
import {
  LABEL_FONT_FAMILY,
  LABEL_FONT_SIZE,
  LABEL_PADDING,
  layoutPinLabels,
} from '../pinLayout';
import type { MeasureLabel, Rect } from '../pinLayout';

/**
 * Export scene
 * ------------
 * A renderer-agnostic description of the diagram in world coordinates (board-image pixels),
 * built from project state only. The PDF, SVG and PNG renderers all draw this same list, in
 * order (later primitives paint over earlier ones), so the three formats cannot drift apart.
 * Editor-only UI (selection outlines, handles, snapping guides, grid) is never part of it.
 */

export interface SceneImage {
  kind: 'image';
  src: string;
  /** The already loaded (and CORS-enabled) element from App state, when available. */
  element?: HTMLImageElement;
  /** Centre of the image; rotation (degrees, clockwise) is around it, like the Konva image. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ScenePolyline {
  kind: 'polyline';
  /** Flat [x0, y0, x1, y1, ...]. */
  points: number[];
  stroke: string;
  strokeWidth: number;
  cap: 'butt' | 'round';
  join: 'miter' | 'round';
  opacity?: number;
}

export interface SceneCircle {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
  fill: string;
}

/** Drop shadow in world units; `blur` has the canvas shadowBlur meaning (≈ 2 × Gaussian σ). */
export interface SceneShadow {
  dx: number;
  dy: number;
  blur: number;
  opacity: number;
}

export interface SceneRect {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  shadow?: SceneShadow;
}

export interface SceneText {
  kind: 'text';
  text: string;
  /** Anchor x: the centre for align 'center', the left edge for 'left'. */
  x: number;
  /** Alphabetic baseline. */
  y: number;
  align: 'left' | 'center';
  fontSize: number;
  fontWeight: 400 | 600;
  /** Font the editor draws this text with; renderers with their own font choice may ignore it. */
  fontFamily: string;
  fill: string;
  /** Renderers shrink the text when their font would make it wider than this. */
  maxWidth?: number;
  opacity?: number;
}

export type ScenePrimitive = SceneImage | ScenePolyline | SceneCircle | SceneRect | SceneText;

export interface Scene {
  /** Area to export (content plus padding), world units. */
  bounds: Rect;
  primitives: ScenePrimitive[];
}

export interface ExportSceneInput {
  /** element null: the image could not be loaded (a placeholder in the editor) and is left out. */
  images: (BoardImage & { element?: HTMLImageElement | null })[];
  pins: PinData[];
  lines: LineData[];
  /** World size of one label unit. */
  labelScale: number;
  /** World gap between the labels of a pin's row. */
  gapSize: number;
  /** Anchor radius in label units; 0 hides anchors. */
  anchorSize: number;
  legendItems: LegendItem[];
  includeLegend: boolean;
  legendMode: LegendMode;
}

/** Blank margin around the exported content, in label units. */
export const EXPORT_PADDING = 24;
/** Dimmed (unused) legend rows are drawn at this opacity, matching the canvas legend. */
export const LEGEND_DIM_OPACITY = 0.35;
export const LEGEND_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const LEGEND_WIDTH = 192;
/** Legend box height for a number of rows (title + rows + pin-type key), legend units. */
const legendHeight = (rowCount: number) => 40 + rowCount * 20 + 40;

/**
 * Baseline for text whose em box is vertically centred on `centreY`. Konva places text the same
 * way ((ascent − descent) / 2 below the middle); 0.35 em is that offset for Arial/Helvetica/Inter.
 */
export const baselineFor = (centreY: number, fontSize: number) => centreY + 0.35 * fontSize;

/** Axis-aligned box of a w×h rectangle rotated by `rotation` degrees around its centre. */
export const rotatedSize = (width: number, height: number, rotation: number) => {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  // Round away float noise so 90° rotations give exact swaps
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { width: round(width * cos + height * sin), height: round(width * sin + height * cos) };
};

const extentOf = (p: ScenePrimitive): Rect | null => {
  switch (p.kind) {
    case 'image': {
      const { width, height } = rotatedSize(p.width, p.height, p.rotation);
      return { x: p.cx - width / 2, y: p.cy - height / 2, width, height };
    }
    case 'polyline': {
      if (p.points.length < 2) return null;
      const xs = p.points.filter((_, i) => i % 2 === 0);
      const ys = p.points.filter((_, i) => i % 2 === 1);
      const h = p.strokeWidth / 2;
      const minX = Math.min(...xs) - h;
      const minY = Math.min(...ys) - h;
      return { x: minX, y: minY, width: Math.max(...xs) + h - minX, height: Math.max(...ys) + h - minY };
    }
    case 'circle':
      return { x: p.cx - p.r, y: p.cy - p.r, width: 2 * p.r, height: 2 * p.r };
    case 'rect': {
      const h = (p.strokeWidth ?? 0) / 2;
      return { x: p.x - h, y: p.y - h, width: p.width + 2 * h, height: p.height + 2 * h };
    }
    case 'text':
      // Text always sits inside a rect, which already covers it
      return null;
  }
};

const unionRects = (rects: Rect[]): Rect | null => {
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map(r => r.x));
  const minY = Math.min(...rects.map(r => r.y));
  const maxX = Math.max(...rects.map(r => r.x + r.width));
  const maxY = Math.max(...rects.map(r => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const pinPrimitives = (pin: PinData, input: ExportSceneInput, measure: MeasureLabel): ScenePrimitive[] => {
  const { labelScale, gapSize, anchorSize } = input;
  const layout = layoutPinLabels(pin, labelScale, gapSize, measure);
  const primary = layout.labels[0];
  const out: ScenePrimitive[] = [];

  // Same leader as PinComponent: from the primary label's centre (hidden under it) to the anchor
  let leader = calculateManhattanPath(
    primary.x + primary.width / 2,
    primary.y + primary.height / 2,
    pin.targetX,
    pin.targetY,
  );
  if (pin.isPwm) leader = calculateWavePoints(leader, 1 / labelScale);
  out.push({ kind: 'polyline', points: leader, stroke: pin.color, strokeWidth: 2 * labelScale, cap: 'butt', join: 'miter' });

  if (anchorSize > 0) {
    out.push({ kind: 'circle', cx: pin.targetX, cy: pin.targetY, r: anchorSize * labelScale, fill: pin.color });
  }

  const entries = [
    { text: pin.text, color: pin.color, textColor: pin.textColor },
    ...(pin.functions ?? []).map(fn => ({ text: fn.text, color: fn.color, textColor: fn.textColor })),
  ];
  layout.labels.forEach((rect, i) => {
    const entry = entries[i];
    out.push({
      kind: 'rect',
      ...rect,
      radius: 4 * labelScale,
      fill: entry.color,
      // The unselected canvas label shadow (Konva scales shadows with the node)
      shadow: { dx: 2 * labelScale, dy: 2 * labelScale, blur: 2 * labelScale, opacity: 0.2 },
    });
    if (entry.text) {
      const fontSize = LABEL_FONT_SIZE * labelScale;
      out.push({
        kind: 'text',
        text: entry.text,
        x: rect.x + rect.width / 2,
        y: baselineFor(rect.y + rect.height / 2, fontSize),
        align: 'center',
        fontSize,
        fontWeight: 600,
        fontFamily: LABEL_FONT_FAMILY,
        fill: entry.textColor || (isLightColor(entry.color) ? 'black' : 'white'),
        maxWidth: rect.width - 2 * LABEL_PADDING * labelScale,
      });
    }
  });
  return out;
};

const linePrimitive = (line: LineData, labelScale: number): ScenePolyline | null => {
  const points = buildOrthogonalPoints(line.points);
  if (points.length < 4) return null;
  return { kind: 'polyline', points, stroke: line.color, strokeWidth: line.thickness * labelScale, cap: 'round', join: 'round' };
};

/** The legend box (same layout as the previous PDF legend), drawn at `scale` with top-left x/y. */
const legendPrimitives = (input: ExportSceneInput, pins: PinData[], x: number, y: number, scale: number) => {
  const rows = getLegendRows(input.legendItems, pins, input.legendMode);
  const dimUnused = input.legendMode === 'dimUnused';
  const X = (lx: number) => x + lx * scale;
  const Y = (ly: number) => y + ly * scale;
  const text = (t: string, lx: number, centreY: number, fontSize: number, fill: string, align: SceneText['align'], opacity?: number): SceneText => ({
    kind: 'text', text: t, x: X(lx), y: baselineFor(Y(centreY), fontSize * scale), align,
    fontSize: fontSize * scale, fontWeight: 400, fontFamily: LEGEND_FONT_FAMILY, fill, opacity,
  });
  const out: ScenePrimitive[] = [];

  out.push({
    kind: 'rect', x, y, width: LEGEND_WIDTH * scale, height: legendHeight(rows.length) * scale, radius: 4 * scale,
    fill: '#e6e6e6', stroke: '#d1d5db', strokeWidth: scale,
    shadow: { dx: 0, dy: 0, blur: 4 * scale, opacity: 0.1 },
  });
  out.push(text('TABLE', 8, 8 + 6, 12, '#4b5563', 'left'));

  let cy = 24;
  for (const { item, used } of rows) {
    const opacity = dimUnused && !used ? LEGEND_DIM_OPACITY : undefined;
    out.push({
      kind: 'rect', x: X(8), y: Y(cy), width: 176 * scale, height: 18 * scale, radius: 0,
      fill: item.color, stroke: 'rgba(0,0,0,0.5)', strokeWidth: scale, opacity,
    });
    if (item.text) out.push({ ...text(item.text, 96, cy + 9, 10, 'white', 'center', opacity), maxWidth: 172 * scale });
    cy += 20;
  }

  cy += 8;
  out.push({ kind: 'polyline', points: [X(8), Y(cy), X(184), Y(cy)], stroke: '#d1d5db', strokeWidth: scale, cap: 'butt', join: 'miter' });
  cy += 8;
  out.push({ kind: 'polyline', points: [X(8), Y(cy + 5), X(28), Y(cy + 5)], stroke: 'black', strokeWidth: scale, cap: 'butt', join: 'miter' });
  out.push(text('Standard Pin', 36, cy + 5, 10, '#4b5563', 'left'));
  cy += 16;
  // One full sine period over 20 units, like the canvas legend's "M 0 5 Q 5 0, 10 5 T 20 5"
  const wave: number[] = [];
  for (let i = 0; i <= 20; i++) wave.push(X(8 + i), Y(cy + 5 - 2.5 * Math.sin((i / 20) * Math.PI * 2)));
  out.push({ kind: 'polyline', points: wave, stroke: 'black', strokeWidth: scale, cap: 'round', join: 'round' });
  out.push(text('PWM Pin', 36, cy + 5, 10, '#4b5563', 'left'));

  return { primitives: out, width: LEGEND_WIDTH * scale, height: legendHeight(rows.length) * scale };
};

/**
 * Builds the export scene. Draw order matches the canvas: images, then each pin (leader line,
 * anchor, labels), then drawn lines, with the legend on top. Returns null when there is nothing
 * to export.
 */
export const buildExportScene = (input: ExportSceneInput, measure: MeasureLabel = measureLabelText): Scene | null => {
  const primitives: ScenePrimitive[] = [];

  for (const img of input.images) {
    if (img.element === null) continue;
    primitives.push({
      kind: 'image', src: img.src, element: img.element,
      cx: img.x, cy: img.y, width: img.width, height: img.height, rotation: img.rotation ?? 0,
    });
  }
  for (const pin of input.pins) primitives.push(...pinPrimitives(pin, input, measure));
  for (const line of input.lines) {
    const p = linePrimitive(line, input.labelScale);
    if (p) primitives.push(p);
  }

  const content = unionRects(primitives.map(extentOf).filter((r): r is Rect => r !== null));
  if (!content) return null;

  const padding = EXPORT_PADDING * input.labelScale;
  let bounds: Rect = {
    x: content.x - padding,
    y: content.y - padding,
    width: content.width + 2 * padding,
    height: content.height + 2 * padding,
  };

  if (input.includeLegend) {
    // Left of the content, top-aligned with it, scaled with the board so it stays readable
    // (the same rule the raster PDF export used).
    const legendScale = Math.max(1, bounds.width / 1000);
    const legendX = bounds.x - (LEGEND_WIDTH + 8) * legendScale;
    const legend = legendPrimitives(input, input.pins, legendX, content.y, legendScale);
    primitives.push(...legend.primitives);
    bounds = unionRects([bounds, {
      x: legendX - padding,
      y: content.y - padding,
      width: legend.width + 2 * padding,
      height: legend.height + 2 * padding,
    }])!;
  }

  return { bounds, primitives };
};
