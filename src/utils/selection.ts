import type { PinData } from '../types';
import type { PinLabelLayout, Rect } from './pinLayout';

/**
 * Multi-selection of pins
 * -----------------------
 * The selection is an ordered list of pin ids. The last id is the "primary" pin: the one the
 * user clicked last, which the single-pin editor and the focused function label refer to.
 */

/** Lays out one pin's label row (layoutPinLabels with the project's settings bound). */
export type PinLayoutFn = (pin: PinData) => PinLabelLayout;

/** The primary (last clicked) pin of a selection, or null when nothing is selected. */
export const primaryOf = (ids: readonly string[]): string | null => ids[ids.length - 1] ?? null;

/** Shift/Ctrl+click: removes the pin when it is selected, otherwise adds it as the new primary. */
export const toggleInSelection = (ids: readonly string[], id: string): string[] =>
  ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id];

/** Adds ids to a selection, keeping the existing order and skipping duplicates. */
export const addToSelection = (ids: readonly string[], added: readonly string[]): string[] => {
  const seen = new Set(ids);
  const result = [...ids];
  for (const id of added) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
};

/** Selection ids that still exist (undo or delete can remove selected pins). */
export const existingIds = (ids: readonly string[], pins: readonly PinData[]): string[] => {
  const known = new Set(pins.map(p => p.id));
  return ids.filter(id => known.has(id));
};

/** Rectangle spanned by two corner points, whichever direction it was dragged in. */
export const rectFromPoints = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

/** Inclusive overlap test, so a marquee touching a label's edge still picks it. */
export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

export const rectContainsPoint = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** Ids of the pins whose anchor lies in the marquee or whose label row overlaps it (in pin order). */
export const pinsInMarquee = (pins: readonly PinData[], marquee: Rect, layoutOf: PinLayoutFn): string[] =>
  pins
    .filter(pin => rectContainsPoint(marquee, pin.targetX, pin.targetY) || rectsIntersect(marquee, layoutOf(pin).bounds))
    .map(pin => pin.id);

/**
 * Moves the label rows of the given pins by the same world offset, keeping their relative layout.
 * With `withAnchor` the anchors move too (whole pins).
 */
export const movePins = (
  pins: readonly PinData[],
  ids: readonly string[],
  dx: number,
  dy: number,
  withAnchor = false,
): PinData[] => {
  const moving = new Set(ids);
  return pins.map(pin =>
    moving.has(pin.id)
      ? {
          ...pin,
          x: pin.x + dx,
          y: pin.y + dy,
          ...(withAnchor ? { targetX: pin.targetX + dx, targetY: pin.targetY + dy } : {}),
        }
      : pin,
  );
};

/** Removes the given pins. */
export const removePins = (pins: readonly PinData[], ids: readonly string[]): PinData[] => {
  const removed = new Set(ids);
  return pins.filter(pin => !removed.has(pin.id));
};

/** The selected pins in selection order (missing ids are skipped). */
export const pickPins = (pins: readonly PinData[], ids: readonly string[]): PinData[] => {
  const byId = new Map(pins.map(p => [p.id, p]));
  return ids.flatMap(id => byId.get(id) ?? []);
};
