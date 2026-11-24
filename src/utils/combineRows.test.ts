import { describe, it, expect } from 'vitest';
import type { PinData } from '../types';
import { LABEL_HEIGHT, layoutPinLabels } from './pinLayout';
import { combineIntoRows, planCombineRows } from './combineRows';

// Labels are 60 wide (minimum), 24 high; gap 10
const layoutOf = (pin: PinData) => layoutPinLabels(pin, 1, 10, () => 60);
const TOLERANCE = LABEL_HEIGHT / 2;

const pin = (id: string, overrides: Partial<PinData> = {}): PinData => ({
  id, x: 0, y: 0, targetX: 0, targetY: 0, text: id, color: '#000', isPwm: false, ...overrides,
});

const counter = () => {
  let n = 0;
  return () => `new-${++n}`;
};

/**
 * A legacy row left of a header pad at (500, 112): every function is its own pin with its own
 * anchor on the pad. Label x positions step outwards by 70 (60 + gap 10).
 */
const legacyLeftRow = (y: number, prefix: string, anchorY = y + 12): PinData[] => [
  pin(`${prefix}-cts`, { text: 'CTS2', color: '#1d4ed8', x: 280, y, targetX: 500, targetY: anchorY }),
  pin(`${prefix}-pa0`, { text: 'PA0', color: '#0d9488', x: 420, y: y + 2, targetX: 500, targetY: anchorY, isPwm: true }),
  pin(`${prefix}-adc`, { text: 'ADC0', color: '#16a34a', textColor: '#ffff00', x: 350, y: y - 3, targetX: 500, targetY: anchorY }),
];

describe('planCombineRows', () => {
  it('groups by side and y, primary first then outwards from its anchor', () => {
    const pins = [...legacyLeftRow(100, 'r1'), ...legacyLeftRow(160, 'r2')];
    const rows = planCombineRows(pins, pins.map(p => p.id), layoutOf, TOLERANCE);
    expect(rows.map(r => r.map(p => p.id))).toEqual([
      ['r1-pa0', 'r1-adc', 'r1-cts'],
      ['r2-pa0', 'r2-adc', 'r2-cts'],
    ]);
  });

  it('does not join labels more than half a label height apart', () => {
    const pins = [pin('a', { x: 0, y: 0, targetX: 500 }), pin('b', { x: 100, y: TOLERANCE + 1, targetX: 500 })];
    expect(planCombineRows(pins, ['a', 'b'], layoutOf, TOLERANCE)).toHaveLength(2);
  });
});

describe('combineIntoRows', () => {
  it('turns one row of separate pins into one pin with functions ordered away from the anchor', () => {
    const pins = legacyLeftRow(100, 'r1');
    const result = combineIntoRows(pins, pins.map(p => p.id), layoutOf, TOLERANCE, counter());

    expect(result.pins).toHaveLength(1);
    const [combined] = result.pins;
    // The label closest to the anchor keeps its pin: id, position, anchor, colour, PWM
    expect(combined).toMatchObject({ id: 'r1-pa0', text: 'PA0', color: '#0d9488', x: 420, y: 102, targetX: 500, isPwm: true });
    expect(combined.functions).toEqual([
      { id: 'new-1', text: 'ADC0', color: '#16a34a', textColor: '#ffff00' },
      { id: 'new-2', text: 'CTS2', color: '#1d4ed8' },
    ]);
    expect(result.selectedIds).toEqual(['r1-pa0']);
    expect(result.combinedRows).toBe(1);
  });

  it('lays the combined functions out where the separate labels were (same side, outwards)', () => {
    const pins = legacyLeftRow(100, 'r1');
    const [combined] = combineIntoRows(pins, pins.map(p => p.id), layoutOf, TOLERANCE, counter()).pins;
    expect(layoutOf(combined).labels.map(r => r.x)).toEqual([420, 350, 280]);
  });

  it('combines several rows separately in one go', () => {
    const pins = [...legacyLeftRow(100, 'r1'), ...legacyLeftRow(160, 'r2'), ...legacyLeftRow(220, 'r3')];
    const result = combineIntoRows(pins, pins.map(p => p.id), layoutOf, TOLERANCE, counter());
    expect(result.pins.map(p => p.id)).toEqual(['r1-pa0', 'r2-pa0', 'r3-pa0']);
    expect(result.pins.map(p => p.functions!.map(f => f.text))).toEqual([
      ['ADC0', 'CTS2'], ['ADC0', 'CTS2'], ['ADC0', 'CTS2'],
    ]);
    expect(result.combinedRows).toBe(3);
    // Function ids are unique across the project
    const ids = result.pins.flatMap(p => p.functions!.map(f => f.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('handles rows right of the anchor, and both sides of the same y separately', () => {
    const pins = [
      ...legacyLeftRow(100, 'L'),
      // Right header: pad at x=600, labels at 680, 750, 820 (given out of order)
      pin('R-t3', { text: 'T3C1', color: '#e11d48', x: 820, y: 101, targetX: 600, targetY: 112 }),
      pin('R-pb0', { text: 'PB0', color: '#0d9488', x: 680, y: 100, targetX: 600, targetY: 112 }),
      pin('R-adc', { text: 'ADC8', color: '#16a34a', x: 750, y: 99, targetX: 600, targetY: 112 }),
    ];
    const result = combineIntoRows(pins, pins.map(p => p.id), layoutOf, TOLERANCE, counter());
    const r = Object.fromEntries(result.pins.map(p => [p.id, p]));
    expect(Object.keys(r).sort()).toEqual(['L-pa0', 'R-pb0']);
    expect(r['R-pb0'].functions!.map(f => [f.text, f.color])).toEqual([['ADC8', '#16a34a'], ['T3C1', '#e11d48']]);
    expect(r['L-pa0'].functions!.map(f => f.text)).toEqual(['ADC0', 'CTS2']);
    expect(layoutOf(r['R-pb0']).labels.map(l => l.x)).toEqual([680, 750, 820]);
  });

  it('keeps the primary\'s own functions first and carries over functions of merged pins', () => {
    const pins = [
      pin('pa0', { text: 'PA0', x: 420, y: 100, targetX: 500, functions: [{ id: 'f-wk', text: 'WKUP', color: '#ca8a04' }] }),
      pin('cts', {
        text: 'CTS2', x: 210, y: 100, targetX: 500,
        functions: [{ id: 'f-t2', text: 'T2C1E', color: '#e11d48' }],
      }),
    ];
    const [combined] = combineIntoRows(pins, ['pa0', 'cts'], layoutOf, TOLERANCE, counter()).pins;
    expect(combined.functions!.map(f => [f.id, f.text])).toEqual([
      ['f-wk', 'WKUP'], ['new-1', 'CTS2'], ['f-t2', 'T2C1E'],
    ]);
  });

  it('leaves unselected pins, single-pin rows and pin order alone', () => {
    const row = legacyLeftRow(100, 'r1');
    const lonely = pin('lonely', { x: 420, y: 300, targetX: 500, targetY: 312 });
    const unselected = pin('unselected', { x: 350, y: 100, targetX: 500, targetY: 112 });
    const pins = [unselected, ...row, lonely];
    const result = combineIntoRows(pins, [...row.map(p => p.id), 'lonely'], layoutOf, TOLERANCE, counter());
    expect(result.pins.map(p => p.id)).toEqual(['unselected', 'r1-pa0', 'lonely']);
    expect(result.pins[0]).toBe(unselected);
    expect(result.pins[2]).toBe(lonely);
    expect(result.selectedIds.sort()).toEqual(['lonely', 'r1-pa0']);
    expect(result.combinedRows).toBe(1);
  });

  it('does not mutate the input pins', () => {
    const pins = legacyLeftRow(100, 'r1');
    const before = JSON.stringify(pins);
    combineIntoRows(pins, pins.map(p => p.id), layoutOf, TOLERANCE, counter());
    expect(JSON.stringify(pins)).toBe(before);
  });
});
