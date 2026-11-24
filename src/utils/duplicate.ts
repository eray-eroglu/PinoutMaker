import type { LineData, PinData } from '../types';
import { clonePin } from './pinUtils';

/** World offset applied by paste and duplicate so the copy is visible next to the original. */
export const COPY_OFFSET = 20;

/** Copy of a pin moved by `offset`, with fresh ids for the pin and its function labels. */
export const duplicatePin = (pin: PinData, offset = COPY_OFFSET): PinData => clonePin(pin, offset, offset);

export const duplicateLine = (line: LineData, offset = COPY_OFFSET): LineData => ({
  ...line,
  id: crypto.randomUUID(),
  points: line.points.map(v => v + offset),
});

/** Copies of several pins, all moved by the same offset so their relative layout is kept. */
export const duplicatePins = (pins: readonly PinData[], offset = COPY_OFFSET): PinData[] =>
  pins.map(pin => duplicatePin(pin, offset));
