import type { LineData, PinData } from '../types';
import type { LoadedImage } from './project';

/** Pin label moves; the anchor only moves with `withAnchor` (whole pin). */
export const nudgePin = (pin: PinData, dx: number, dy: number, withAnchor = false): PinData => ({
  ...pin,
  x: pin.x + dx,
  y: pin.y + dy,
  ...(withAnchor ? { targetX: pin.targetX + dx, targetY: pin.targetY + dy } : {}),
});

export const nudgeLine = (line: LineData, dx: number, dy: number): LineData => ({
  ...line,
  points: line.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)),
});

export const nudgeImage = (img: LoadedImage, dx: number, dy: number): LoadedImage => ({
  ...img,
  x: img.x + dx,
  y: img.y + dy,
});

export const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
