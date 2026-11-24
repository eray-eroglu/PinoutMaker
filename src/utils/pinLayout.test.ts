import { describe, it, expect } from 'vitest';
import type { PinData } from '../types';
import { LABEL_HEIGHT, MIN_LABEL_WIDTH, layoutPinLabels } from './pinLayout';

// 10 label units per character, so short names fall under the minimum width
const measure = (text: string) => text.length * 10;

const pin = (overrides: Partial<PinData>): PinData => ({
  id: 'p', x: 0, y: 0, targetX: 0, targetY: 0, text: 'PA0', color: '#000', isPwm: false, ...overrides,
});

const fns = (...texts: string[]) => texts.map((text, i) => ({ id: `f${i}`, text, color: '#111' }));

describe('layoutPinLabels', () => {
  it('lays out only the primary label for pins without functions (older files)', () => {
    const layout = layoutPinLabels(pin({ x: 200, y: 50, targetX: 100 }), 1, 12, measure);
    expect(layout.labels).toEqual([{ x: 200, y: 50, width: MIN_LABEL_WIDTH, height: LABEL_HEIGHT }]);
    expect(layout.bounds).toEqual(layout.labels[0]);
    expect(layout.side).toBe('right');
  });

  it('grows the row to the right, away from an anchor on the left', () => {
    const layout = layoutPinLabels(
      pin({ x: 200, y: 50, targetX: 100, functions: fns('SDA1', 'RXD1', 'T4C2') }), 1, 12, measure,
    );
    expect(layout.side).toBe('right');
    expect(layout.labels.map(r => r.x)).toEqual([200, 272, 344, 416]);
    expect(layout.labels.every(r => r.y === 50)).toBe(true);
    expect(layout.bounds).toEqual({ x: 200, y: 50, width: 276, height: LABEL_HEIGHT });
  });

  it('grows the row to the left, away from an anchor on the right', () => {
    const layout = layoutPinLabels(
      pin({ x: 200, y: 50, targetX: 400, functions: fns('ADC0', 'CTS2', 'T2C1E') }), 1, 12, measure,
    );
    expect(layout.side).toBe('left');
    // The primary label stays put; the others continue to its left
    expect(layout.labels.map(r => r.x)).toEqual([200, 128, 56, -16]);
    expect(layout.bounds).toEqual({ x: -16, y: 50, width: 276, height: LABEL_HEIGHT });
  });

  it('decides the side from the primary label centre, not its left edge', () => {
    // Left edge is left of the anchor but the centre (x + 30) is right of it
    expect(layoutPinLabels(pin({ x: 90, targetX: 110 }), 1, 12, measure).side).toBe('right');
    expect(layoutPinLabels(pin({ x: 70, targetX: 110 }), 1, 12, measure).side).toBe('left');
  });

  it('separates labels by gapSize in world units, independent of labelScale', () => {
    const layout = layoutPinLabels(pin({ x: 0, targetX: -100, functions: fns('A', 'B') }), 2, 5, measure);
    const [a, b, c] = layout.labels;
    expect(a.width).toBe(MIN_LABEL_WIDTH * 2);
    expect(b.x - (a.x + a.width)).toBe(5);
    expect(c.x - (b.x + b.width)).toBe(5);
    expect(a.height).toBe(LABEL_HEIGHT * 2);
  });

  it('gives every short label the same width so rows line up as columns', () => {
    const a = layoutPinLabels(pin({ text: 'PA0', targetX: -100, functions: fns('ADC0', 'TX') }), 1, 12, measure);
    const b = layoutPinLabels(pin({ text: 'PA10', y: 30, targetX: -100, functions: fns('A', 'CTS1') }), 1, 12, measure);
    expect(a.labels.map(r => r.x)).toEqual(b.labels.map(r => r.x));
  });

  it('widens labels with long text and pushes the rest of the row out', () => {
    const layout = layoutPinLabels(
      pin({ x: 0, targetX: -100, text: 'PA0', functions: fns('USART1_RX', 'B') }), 1, 10, measure,
    );
    const [primary, long, last] = layout.labels;
    expect(primary.width).toBe(MIN_LABEL_WIDTH);
    expect(long.width).toBe(90);
    expect(last.x).toBe(60 + 10 + 90 + 10);
  });
});
