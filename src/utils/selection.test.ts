import { describe, it, expect } from 'vitest';
import type { PinData } from '../types';
import { layoutPinLabels } from './pinLayout';
import {
  addToSelection, existingIds, movePins, pickPins, pinsInMarquee, primaryOf, rectFromPoints, rectsIntersect,
  removePins, toggleInSelection,
} from './selection';
import { duplicatePins } from './duplicate';

// Every label is 60 units wide (the minimum), 24 high; gap 10
const layoutOf = (pin: PinData) => layoutPinLabels(pin, 1, 10, () => 60);

const pin = (id: string, overrides: Partial<PinData> = {}): PinData => ({
  id, x: 0, y: 0, targetX: 0, targetY: 0, text: id, color: '#000', isPwm: false, ...overrides,
});

describe('selection list', () => {
  it('uses the last id as the primary pin', () => {
    expect(primaryOf([])).toBeNull();
    expect(primaryOf(['a', 'b'])).toBe('b');
  });

  it('toggles pins in and out; an added pin becomes the primary', () => {
    expect(toggleInSelection(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleInSelection(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
    expect(toggleInSelection(['a'], 'a')).toEqual([]);
  });

  it('adds marquee hits without duplicates, keeping the existing order', () => {
    expect(addToSelection(['b', 'a'], ['a', 'c', 'c'])).toEqual(['b', 'a', 'c']);
  });

  it('drops ids of pins that no longer exist', () => {
    expect(existingIds(['a', 'x', 'b'], [pin('a'), pin('b')])).toEqual(['a', 'b']);
  });

  it('picks pins in selection order', () => {
    const pins = [pin('a'), pin('b'), pin('c')];
    expect(pickPins(pins, ['c', 'a', 'zz']).map(p => p.id)).toEqual(['c', 'a']);
  });
});

describe('marquee hit-testing', () => {
  it('normalises a rectangle dragged in any direction', () => {
    expect(rectFromPoints({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, width: 40, height: 60 });
  });

  it('treats touching edges as intersecting', () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 10, width: 5, height: 5 })).toBe(true);
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 11, y: 0, width: 5, height: 5 })).toBe(false);
  });

  const pins = [
    // Label 100..160 x 100..124, anchor at (300, 112)
    pin('labelHit', { x: 100, y: 100, targetX: 300, targetY: 112 }),
    // Anchor inside the marquee, label far away
    pin('anchorHit', { x: 900, y: 900, targetX: 150, targetY: 150 }),
    // Row grows left: primary at 400, function at 330..390 — only the function label is hit
    pin('functionHit', {
      x: 400, y: 300, targetX: 600, targetY: 312, functions: [{ id: 'f', text: 'ADC0', color: '#0f0' }],
    }),
    pin('miss', { x: 1000, y: 1000, targetX: 1100, targetY: 1000 }),
  ];

  it('selects pins whose anchor or any label of the row is inside the marquee', () => {
    const hitLabel = pinsInMarquee(pins, { x: 140, y: 95, width: 5, height: 10 }, layoutOf);
    expect(hitLabel).toEqual(['labelHit']);
    const hitAnchor = pinsInMarquee(pins, { x: 140, y: 140, width: 20, height: 20 }, layoutOf);
    expect(hitAnchor).toEqual(['anchorHit']);
    const hitFunction = pinsInMarquee(pins, { x: 340, y: 290, width: 10, height: 10 }, layoutOf);
    expect(hitFunction).toEqual(['functionHit']);
  });

  it('returns hits in pin order and nothing for an empty area', () => {
    expect(pinsInMarquee(pins, { x: 0, y: 0, width: 700, height: 400 }, layoutOf)).toEqual([
      'labelHit', 'anchorHit', 'functionHit',
    ]);
    expect(pinsInMarquee(pins, { x: 2000, y: 2000, width: 10, height: 10 }, layoutOf)).toEqual([]);
  });
});

describe('group move', () => {
  const pins = [
    pin('a', { x: 10, y: 20, targetX: 100, targetY: 30 }),
    pin('b', { x: 10, y: 60, targetX: 100, targetY: 70 }),
    pin('c', { x: 10, y: 100, targetX: 100, targetY: 110 }),
  ];

  it('moves only the selected labels by the same delta; anchors stay', () => {
    const moved = movePins(pins, ['a', 'c'], 5, -3);
    expect(moved.map(p => [p.x, p.y, p.targetX, p.targetY])).toEqual([
      [15, 17, 100, 30],
      [10, 60, 100, 70],
      [15, 97, 100, 110],
    ]);
  });

  it('moves anchors too for whole-pin moves', () => {
    const [a] = movePins(pins, ['a'], 5, 5, true);
    expect(a).toMatchObject({ x: 15, y: 25, targetX: 105, targetY: 35 });
  });

  it('does not mutate the input and keeps unselected pins identical', () => {
    const moved = movePins(pins, ['a'], 1, 1);
    expect(pins[0].x).toBe(10);
    expect(moved[1]).toBe(pins[1]);
  });

  it('removes several pins at once', () => {
    expect(removePins(pins, ['a', 'c']).map(p => p.id)).toEqual(['b']);
  });

  it('duplicates several pins with one offset, keeping their relative layout and giving fresh ids', () => {
    const withFn = [{ ...pins[0], functions: [{ id: 'f1', text: 'ADC0', color: '#0f0' }] }, pins[1]];
    const copies = duplicatePins(withFn, 20);
    expect(copies.map(p => [p.x, p.y, p.targetX, p.targetY])).toEqual([
      [30, 40, 120, 50],
      [30, 80, 120, 90],
    ]);
    expect(copies[1].y - copies[0].y).toBe(withFn[1].y - withFn[0].y);
    expect(copies.map(p => p.id)).not.toContain('a');
    expect(copies[0].functions![0].id).not.toBe('f1');
    expect(copies[0].functions![0].text).toBe('ADC0');
  });
});
