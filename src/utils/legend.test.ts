import { describe, it, expect } from 'vitest';
import { getLegendRows, normalizeColor } from './legend';
import type { LegendItem, PinData } from '../types';

const pin = (color: string, functions?: { color: string }[]): PinData =>
  ({ id: color, x: 0, y: 0, targetX: 0, targetY: 0, text: 'A', color, isPwm: false, ...(functions ? { functions } : {}) }) as PinData;

const items: LegendItem[] = [
  { id: '1', text: 'GND', color: '#000000' },
  { id: '2', text: 'PWR', color: '#ff0000' },
  { id: '3', text: 'I2C', color: '#00ff00' },
];

describe('normalizeColor', () => {
  it('lower-cases and expands short hex', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc');
    expect(normalizeColor(' #FF0000 ')).toBe('#ff0000');
  });
});

describe('getLegendRows', () => {
  const pins = [pin('#F00'), pin('#FF0000'), pin('#111111', [{ color: '#00FF00' }])];

  it('all keeps every row in order with used flags and counts', () => {
    const rows = getLegendRows(items, pins, 'all');
    expect(rows.map((r) => r.item.id)).toEqual(['1', '2', '3']);
    expect(rows.map((r) => r.used)).toEqual([false, true, true]);
    expect(rows.map((r) => r.count)).toEqual([0, 2, 1]);
  });

  it('used drops unused rows', () => {
    expect(getLegendRows(items, pins, 'used').map((r) => r.item.id)).toEqual(['2', '3']);
  });

  it('dimUnused keeps unused rows flagged', () => {
    const rows = getLegendRows(items, pins, 'dimUnused');
    expect(rows).toHaveLength(3);
    expect(rows[0].used).toBe(false);
  });

  it('handles no pins and pins without functions', () => {
    expect(getLegendRows(items, [], 'used')).toEqual([]);
    expect(getLegendRows(items, [pin('#000')], 'used')[0].count).toBe(1);
  });
});
