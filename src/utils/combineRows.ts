import type { PinData, PinFunction } from '../types';
import type { PinLayoutFn } from './selection';
import { pickPins } from './selection';

/**
 * "Combine into one row"
 * ----------------------
 * Projects made before function labels existed drew every function of a pad as a separate pin
 * (PA0, ADC0, CTS2 … side by side). This turns each such row back into a single pin: the label
 * closest to its own anchor stays as the primary label, the others become its function labels,
 * ordered outwards from the anchor, and their pins are deleted.
 */

const labelCentre = (pin: PinData, layoutOf: PinLayoutFn) => {
  const rect = layoutOf(pin).labels[0];
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Groups the selected pins into rows: same side of the anchor, and label tops within `tolerance`
 * (world units, half a label height in the app) of the row's topmost label. Each row is returned
 * primary first, then the others by distance from the primary's anchor.
 */
export const planCombineRows = (
  pins: readonly PinData[],
  ids: readonly string[],
  layoutOf: PinLayoutFn,
  tolerance: number,
): PinData[][] => {
  const rows: PinData[][] = [];
  for (const side of ['left', 'right'] as const) {
    const sorted = pickPins(pins, ids)
      .filter(pin => layoutOf(pin).side === side)
      .sort((a, b) => a.y - b.y);
    let current: PinData[] = [];
    for (const pin of sorted) {
      if (current.length > 0 && pin.y - current[0].y > tolerance) {
        rows.push(current);
        current = [];
      }
      current.push(pin);
    }
    if (current.length > 0) rows.push(current);
  }

  return rows.map(row => {
    // Earlier pins win ties, so the result does not depend on floating-point noise between equals
    const primary = row.reduce((best, pin) =>
      distance(labelCentre(pin, layoutOf), { x: pin.targetX, y: pin.targetY }) <
      distance(labelCentre(best, layoutOf), { x: best.targetX, y: best.targetY })
        ? pin
        : best,
    );
    const anchor = { x: primary.targetX, y: primary.targetY };
    const others = row
      .filter(pin => pin !== primary)
      .map(pin => ({ pin, d: distance(labelCentre(pin, layoutOf), anchor) }))
      .sort((a, b) => a.d - b.d)
      .map(({ pin }) => pin);
    return [primary, ...others];
  });
};

export interface CombineResult {
  pins: PinData[];
  /** The resulting pins (combined primaries and untouched single pins), for the new selection. */
  selectedIds: string[];
  /** How many rows of two or more pins were merged. */
  combinedRows: number;
}

/**
 * Merges each row found by planCombineRows into its primary pin. Rows of a single pin are left
 * alone. The primary keeps its id, position, anchor, colour and PWM flag; its existing functions
 * come first, then each other pin's label (text and colours) followed by that pin's own functions.
 */
export const combineIntoRows = (
  pins: readonly PinData[],
  ids: readonly string[],
  layoutOf: PinLayoutFn,
  tolerance: number,
  newId: () => string = () => crypto.randomUUID(),
): CombineResult => {
  const rows = planCombineRows(pins, ids, layoutOf, tolerance);
  const merged = new Map<string, PinData>();
  const removed = new Set<string>();

  for (const [primary, ...others] of rows) {
    if (others.length === 0) continue;
    const functions: PinFunction[] = [...(primary.functions ?? [])];
    for (const other of others) {
      functions.push({
        id: newId(),
        text: other.text,
        color: other.color,
        ...(other.textColor ? { textColor: other.textColor } : {}),
      });
      functions.push(...(other.functions ?? []));
      removed.add(other.id);
    }
    merged.set(primary.id, { ...primary, functions });
  }

  return {
    pins: pins.filter(pin => !removed.has(pin.id)).map(pin => merged.get(pin.id) ?? pin),
    selectedIds: rows.map(row => row[0].id),
    combinedRows: merged.size,
  };
};
