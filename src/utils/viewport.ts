import type { LineData, PinData } from '../types';
import type { LoadedImage } from './project';

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export interface Viewport { scale: number; position: { x: number; y: number } }
interface Size { width: number; height: number }

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 10;
/** Same zoom step as the mouse wheel. */
export const ZOOM_FACTOR = 1.1;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** World-space bounding box of everything on the board, or null when the board is empty. */
export const getContentBounds = ({ images, pins, lines, labelScale }: {
  images: LoadedImage[];
  pins: PinData[];
  lines: LineData[];
  /** World size of one label unit. */
  labelScale: number;
}): Bounds | null => {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (x: number, y: number) => {
    b.minX = Math.min(b.minX, x);
    b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y);
    b.maxY = Math.max(b.maxY, y);
  };

  // Images are centered on x/y; the half-diagonal is a safe bound for any rotation.
  images.forEach(img => {
    const r = Math.sqrt(img.width * img.width + img.height * img.height) / 2;
    include(img.x - r, img.y - r);
    include(img.x + r, img.y + r);
  });

  pins.forEach(p => {
    include(p.targetX, p.targetY);
    // labelWidth/Height are label units
    const w = (p.labelWidth || Math.max(60, p.text.length * 8) + 20) * labelScale;
    const h = (p.labelHeight || 40) * labelScale;
    include(p.x, p.y);
    include(p.x + w, p.y + h);
  });

  lines.forEach(l => {
    for (let i = 0; i + 1 < l.points.length; i += 2) include(l.points[i], l.points[i + 1]);
  });

  return Number.isFinite(b.minX) ? b : null;
};

/** Position that puts the centre of `bounds` in the middle of the viewport at the given scale. */
export const centreOn = (bounds: Bounds | null, viewportSize: Size, scale: number) => {
  const cx = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
  const cy = bounds ? (bounds.minY + bounds.maxY) / 2 : 0;
  return { x: viewportSize.width / 2 - cx * scale, y: viewportSize.height / 2 - cy * scale };
};

/**
 * Zoom and pan so `bounds` is centred in the viewport with `margin` screen px around it.
 * The scale is clamped to the zoom limits; empty content resets to scale 1 at the origin.
 */
export const fitToContent = (bounds: Bounds | null, viewportSize: Size, margin = 40): Viewport => {
  if (!bounds) return { scale: 1, position: { x: 0, y: 0 } };
  const w = Math.max(bounds.maxX - bounds.minX, 1);
  const h = Math.max(bounds.maxY - bounds.minY, 1);
  const availW = Math.max(viewportSize.width - 2 * margin, 1);
  const availH = Math.max(viewportSize.height - 2 * margin, 1);
  const scale = clampScale(Math.min(availW / w, availH / h));
  return { scale, position: centreOn(bounds, viewportSize, scale) };
};

/** Multiplies the zoom by `factor` keeping the world point under the viewport centre fixed. */
export const zoomAroundCentre = (view: Viewport, viewportSize: Size, factor: number): Viewport => {
  const scale = clampScale(view.scale * factor);
  const cx = viewportSize.width / 2;
  const cy = viewportSize.height / 2;
  const wx = (cx - view.position.x) / view.scale;
  const wy = (cy - view.position.y) / view.scale;
  return { scale, position: { x: cx - wx * scale, y: cy - wy * scale } };
};
