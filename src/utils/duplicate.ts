import type { LineData, PinData } from '../types';

/** World offset applied by paste and duplicate so the copy is visible next to the original. */
export const COPY_OFFSET = 20;

export const duplicatePin = (pin: PinData, offset = COPY_OFFSET): PinData => ({
  ...pin,
  id: crypto.randomUUID(),
  x: pin.x + offset,
  y: pin.y + offset,
  targetX: pin.targetX + offset,
  targetY: pin.targetY + offset,
});

export const duplicateLine = (line: LineData, offset = COPY_OFFSET): LineData => ({
  ...line,
  id: crypto.randomUUID(),
  points: line.points.map(v => v + offset),
});
