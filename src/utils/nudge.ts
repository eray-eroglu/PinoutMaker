import type { LineData } from '../types';
import type { LoadedImage } from './project';

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
