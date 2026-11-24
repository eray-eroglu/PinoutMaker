import type { PinData } from '../types';
import type { PinLayoutFn } from './selection';
import { pickPins } from './selection';

/**
 * Alignment of selected pins' label rows. Only label positions (pin.x/pin.y) change; anchors stay
 * on their pads. All functions return the full pin list with the selected pins updated.
 *
 * Pins are handled per side of the anchor: a board usually has a column of labels left of one
 * header and another right of the other, and those columns must not be mixed.
 */

type Side = 'left' | 'right';

/** Selected pins grouped by the side of the anchor their label row is on (selection order kept). */
const groupBySide = (pins: readonly PinData[], ids: readonly string[], layoutOf: PinLayoutFn) => {
  const groups: Record<Side, PinData[]> = { left: [], right: [] };
  for (const pin of pickPins(pins, ids)) groups[layoutOf(pin).side].push(pin);
  return [groups.left, groups.right].filter(g => g.length > 0);
};

/** Top-to-bottom; equal y keeps the given order (Array.prototype.sort is stable). */
const byY = (group: readonly PinData[]) => [...group].sort((a, b) => a.y - b.y);

const applyPositions = (pins: readonly PinData[], positions: Map<string, Partial<Pick<PinData, 'x' | 'y'>>>): PinData[] =>
  pins.map(pin => {
    const pos = positions.get(pin.id);
    return pos ? { ...pin, ...pos } : pin;
  });

/**
 * Aligns the label edge that faces the anchor: right edges for rows left of their anchor, left
 * edges for rows right of it. Each side lines up with its label closest to the anchors (the
 * rightmost right edge / leftmost left edge), like "align right/left" in drawing tools.
 */
export const alignLabelEdgesToAnchor = (pins: readonly PinData[], ids: readonly string[], layoutOf: PinLayoutFn): PinData[] => {
  const positions = new Map<string, { x: number }>();
  for (const group of groupBySide(pins, ids, layoutOf)) {
    const primaries = group.map(pin => ({ pin, rect: layoutOf(pin).labels[0] }));
    if (layoutOf(group[0]).side === 'left') {
      const edge = Math.max(...primaries.map(({ rect }) => rect.x + rect.width));
      for (const { pin, rect } of primaries) positions.set(pin.id, { x: edge - rect.width });
    } else {
      const edge = Math.min(...primaries.map(({ rect }) => rect.x));
      for (const { pin } of primaries) positions.set(pin.id, { x: edge });
    }
  }
  return applyPositions(pins, positions);
};

/** Puts all selected label rows at the y of the topmost one. */
export const alignLabelTops = (pins: readonly PinData[], ids: readonly string[]): PinData[] => {
  const selected = pickPins(pins, ids);
  if (selected.length === 0) return [...pins];
  const top = Math.min(...selected.map(p => p.y));
  return applyPositions(pins, new Map(selected.map(p => [p.id, { y: top }])));
};

/**
 * Spaces the label rows evenly between the topmost and bottommost one (by label y), per side.
 * A side needs at least three rows for anything to move.
 */
export const distributeVertically = (pins: readonly PinData[], ids: readonly string[], layoutOf: PinLayoutFn): PinData[] => {
  const positions = new Map<string, { y: number }>();
  for (const group of groupBySide(pins, ids, layoutOf)) {
    if (group.length < 3) continue;
    const sorted = byY(group);
    const first = sorted[0].y;
    const step = (sorted[sorted.length - 1].y - first) / (sorted.length - 1);
    sorted.forEach((pin, i) => positions.set(pin.id, { y: first + i * step }));
  }
  return applyPositions(pins, positions);
};

/**
 * Sets the distance between consecutive label rows (top to top, world units), per side: the
 * topmost row stays and the others follow it downwards in their current order.
 */
export const applyRowPitch = (pins: readonly PinData[], ids: readonly string[], pitch: number, layoutOf: PinLayoutFn): PinData[] => {
  const positions = new Map<string, { y: number }>();
  for (const group of groupBySide(pins, ids, layoutOf)) {
    const sorted = byY(group);
    const first = sorted[0].y;
    sorted.forEach((pin, i) => positions.set(pin.id, { y: first + i * pitch }));
  }
  return applyPositions(pins, positions);
};

/** Current average top-to-top distance between consecutive rows (per side), or null with < 2 rows. */
export const averageRowPitch = (pins: readonly PinData[], ids: readonly string[], layoutOf: PinLayoutFn): number | null => {
  let span = 0;
  let gaps = 0;
  for (const group of groupBySide(pins, ids, layoutOf)) {
    if (group.length < 2) continue;
    const sorted = byY(group);
    span += sorted[sorted.length - 1].y - sorted[0].y;
    gaps += sorted.length - 1;
  }
  return gaps > 0 ? span / gaps : null;
};

/** Sets fields on every selected pin (bulk colour, PWM). */
export const updatePins = (
  pins: readonly PinData[],
  ids: readonly string[],
  changes: Partial<Omit<PinData, 'id'>>,
): PinData[] => {
  const selected = new Set(ids);
  return pins.map(pin => (selected.has(pin.id) ? { ...pin, ...changes } : pin));
};
