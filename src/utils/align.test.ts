import { describe, it, expect } from 'vitest';
import type { PinData } from '../types';
import { layoutPinLabels } from './pinLayout';
import {
  alignLabelEdgesToAnchor, alignLabelTops, applyRowPitch, averageRowPitch, distributeVertically, updatePins,
} from './align';

// 10 label units per character (minimum 60), height 24, gap 10
const layoutOf = (pin: PinData) => layoutPinLabels(pin, 1, 10, text => text.length * 10);

const pin = (id: string, overrides: Partial<PinData> = {}): PinData => ({
  id, x: 0, y: 0, targetX: 0, targetY: 0, text: id, color: '#000', isPwm: false, ...overrides,
});

const byId = (pins: PinData[]) => Object.fromEntries(pins.map(p => [p.id, p]));

describe('alignLabelEdgesToAnchor', () => {
  it('aligns right edges of rows left of their anchor to the rightmost edge', () => {
    const pins = [
      pin('L1', { x: 100, y: 0, targetX: 500 }), // 100..160
      pin('LONGNAME', { x: 120, y: 30, targetX: 500 }), // 80 wide: 120..200
      pin('L3', { x: 90, y: 60, targetX: 500 }), // 90..150
    ];
    const r = byId(alignLabelEdgesToAnchor(pins, ['L1', 'LONGNAME', 'L3'], layoutOf));
    expect(r.L1.x + 60).toBe(200);
    expect(r.LONGNAME.x + 80).toBe(200);
    expect(r.L3.x + 60).toBe(200);
    // y and anchors untouched
    expect(r.L3).toMatchObject({ y: 60, targetX: 500 });
  });

  it('aligns left edges of rows right of their anchor to the leftmost edge', () => {
    const pins = [pin('R1', { x: 300, targetX: 100 }), pin('R2', { x: 280, y: 30, targetX: 100 })];
    const r = byId(alignLabelEdgesToAnchor(pins, ['R1', 'R2'], layoutOf));
    expect(r.R1.x).toBe(280);
    expect(r.R2.x).toBe(280);
  });

  it('aligns each side separately when the selection spans both sides', () => {
    const pins = [
      pin('L1', { x: 100, targetX: 500 }),
      pin('L2', { x: 110, y: 30, targetX: 500 }),
      pin('R1', { x: 900, targetX: 600 }),
      pin('R2', { x: 880, y: 30, targetX: 600 }),
      pin('other', { x: 5, y: 5, targetX: 600 }),
    ];
    const r = byId(alignLabelEdgesToAnchor(pins, ['L1', 'L2', 'R1', 'R2'], layoutOf));
    expect([r.L1.x, r.L2.x]).toEqual([110, 110]);
    expect([r.R1.x, r.R2.x]).toEqual([880, 880]);
    expect(r.other.x).toBe(5); // not selected
  });

  it('uses the primary label edge, ignoring function labels that extend the row outwards', () => {
    const pins = [
      pin('L1', { x: 100, targetX: 500, functions: [{ id: 'f', text: 'ADC0', color: '#0f0' }] }),
      pin('L2', { x: 140, y: 30, targetX: 500 }),
    ];
    const r = byId(alignLabelEdgesToAnchor(pins, ['L1', 'L2'], layoutOf));
    expect(r.L1.x).toBe(140);
  });
});

describe('alignLabelTops', () => {
  it('moves the selected rows to the topmost y', () => {
    const pins = [pin('a', { y: 50 }), pin('b', { y: 20, x: 300 }), pin('c', { y: 90 }), pin('d', { y: 0 })];
    const r = byId(alignLabelTops(pins, ['a', 'b', 'c']));
    expect([r.a.y, r.b.y, r.c.y, r.d.y]).toEqual([20, 20, 20, 0]);
    expect(r.b.x).toBe(300);
  });
});

describe('distributeVertically', () => {
  it('spaces rows evenly between the first and last, whatever the selection order', () => {
    const pins = [
      pin('a', { y: 0, targetX: 500 }),
      pin('b', { y: 10, targetX: 500 }),
      pin('c', { y: 95, targetX: 500 }),
      pin('d', { y: 120, targetX: 500 }),
    ];
    const r = byId(distributeVertically(pins, ['d', 'b', 'a', 'c'], layoutOf));
    expect([r.a.y, r.b.y, r.c.y, r.d.y]).toEqual([0, 40, 80, 120]);
  });

  it('distributes each side on its own and leaves sides with fewer than three rows alone', () => {
    const pins = [
      pin('L1', { y: 0, targetX: 500 }),
      pin('L2', { y: 5, targetX: 500 }),
      pin('L3', { y: 100, targetX: 500 }),
      pin('R1', { x: 900, y: 0, targetX: 600 }),
      pin('R2', { x: 900, y: 7, targetX: 600 }),
    ];
    const r = byId(distributeVertically(pins, pins.map(p => p.id), layoutOf));
    expect([r.L1.y, r.L2.y, r.L3.y]).toEqual([0, 50, 100]);
    expect([r.R1.y, r.R2.y]).toEqual([0, 7]);
  });
});

describe('row pitch', () => {
  const pins = [
    pin('a', { y: 100, targetX: 500 }),
    pin('b', { y: 120, targetX: 500 }),
    pin('c', { y: 170, targetX: 500 }),
  ];

  it('measures the current average pitch', () => {
    expect(averageRowPitch(pins, ['a', 'b', 'c'], layoutOf)).toBe(35);
    expect(averageRowPitch(pins, ['a'], layoutOf)).toBeNull();
  });

  it('applies a pitch top to bottom from the topmost row', () => {
    const r = byId(applyRowPitch(pins, ['c', 'a', 'b'], 30, layoutOf));
    expect([r.a.y, r.b.y, r.c.y]).toEqual([100, 130, 160]);
  });
});

describe('updatePins', () => {
  it('sets fields on the selected pins only', () => {
    const pins = [pin('a'), pin('b')];
    const r = byId(updatePins(pins, ['b'], { color: '#fff', isPwm: true }));
    expect(r.a).toMatchObject({ color: '#000', isPwm: false });
    expect(r.b).toMatchObject({ color: '#fff', isPwm: true });
  });
});
