import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HEADER_SETTINGS,
  FAN_FIRST_OFFSET,
  FAN_ROW_STEP,
  HEADER_LABEL_OFFSET,
  MAX_HEADER_PINS,
  buildHeaderPins,
  clampHeaderCount,
  constrainToAxis,
  describeHeader,
  getHeaders,
  headerLabelPositions,
  headerPinName,
  headerPinPositions,
  imageCentreAt,
  resolveHeaderSide,
  withFreshHeaderIds,
  withoutHeader,
} from './header';
import { LABEL_HEIGHT, layoutPinLabels } from './pinLayout';
import { calculateManhattanPath } from './lineUtils';
import type { BoardImage, PinData } from '../types';

// Every label is the minimum width (60 label units)
const measure = () => 0;

describe('headerPinPositions', () => {
  it('spaces pins evenly with both ends included', () => {
    expect(headerPinPositions({ x: 0, y: 0 }, { x: 0, y: 90 }, 4)).toEqual([
      { x: 0, y: 0 }, { x: 0, y: 30 }, { x: 0, y: 60 }, { x: 0, y: 90 },
    ]);
  });

  it('puts a single pin on the first pad', () => {
    expect(headerPinPositions({ x: 5, y: 6 }, { x: 100, y: 6 }, 1)).toEqual([{ x: 5, y: 6 }]);
  });

  it('puts two pins on the two clicked pads', () => {
    expect(headerPinPositions({ x: 5, y: 6 }, { x: 100, y: 60 }, 2)).toEqual([{ x: 5, y: 6 }, { x: 100, y: 60 }]);
  });

  it('follows a diagonal and the click order', () => {
    expect(headerPinPositions({ x: 20, y: 20 }, { x: 0, y: 0 }, 3)).toEqual([
      { x: 20, y: 20 }, { x: 10, y: 10 }, { x: 0, y: 0 },
    ]);
  });

  it('clamps the count', () => {
    expect(clampHeaderCount(0)).toBe(1);
    expect(clampHeaderCount(NaN)).toBe(1);
    expect(clampHeaderCount(3.6)).toBe(4);
    expect(clampHeaderCount(10_000)).toBe(MAX_HEADER_PINS);
  });
});

describe('constrainToAxis', () => {
  it('snaps to the closer axis', () => {
    expect(constrainToAxis({ x: 0, y: 0 }, { x: 100, y: 7 })).toEqual({ x: 100, y: 0 });
    expect(constrainToAxis({ x: 0, y: 0 }, { x: -7, y: 100 })).toEqual({ x: 0, y: 100 });
  });
});

describe('resolveHeaderSide', () => {
  const vertical = [{ x: 10, y: 0 }, { x: 10, y: 100 }] as const;
  const horizontal = [{ x: 0, y: 10 }, { x: 100, y: 10 }] as const;

  it('keeps an explicit side', () => {
    expect(resolveHeaderSide('above', ...vertical, { x: 0, y: 0 })).toBe('above');
  });

  it('faces a vertical header away from the board centre', () => {
    expect(resolveHeaderSide('auto', ...vertical, { x: 50, y: 50 })).toBe('left');
    expect(resolveHeaderSide('auto', ...vertical, { x: -50, y: 50 })).toBe('right');
  });

  it('faces a horizontal header away from the board centre', () => {
    expect(resolveHeaderSide('auto', ...horizontal, { x: 50, y: 50 })).toBe('above');
    expect(resolveHeaderSide('auto', ...horizontal, { x: 50, y: -50 })).toBe('below');
  });

  it('falls back to right / below without a centre', () => {
    expect(resolveHeaderSide('auto', ...vertical, null)).toBe('right');
    expect(resolveHeaderSide('auto', ...horizontal, null)).toBe('below');
  });
});

describe('imageCentreAt', () => {
  const img: BoardImage = { id: 'i', src: '', x: 100, y: 100, width: 200, height: 40, rotation: 0 };

  it('finds the image under a point', () => {
    expect(imageCentreAt([img], { x: 190, y: 110 })).toEqual({ x: 100, y: 100 });
    expect(imageCentreAt([img], { x: 100, y: 150 })).toBeNull();
  });

  it('honours rotation', () => {
    const rotated = { ...img, rotation: 90 }; // now 40 wide, 200 tall
    expect(imageCentreAt([rotated], { x: 100, y: 190 })).toEqual({ x: 100, y: 100 });
    expect(imageCentreAt([rotated], { x: 190, y: 100 })).toBeNull();
  });
});

describe('headerPinName', () => {
  it('numbers with prefix, start and step', () => {
    const s = { naming: 'numbered' as const, prefix: 'D', startNumber: 2, step: 2 };
    expect([0, 1, 2].map(i => headerPinName(s, i))).toEqual(['D2', 'D4', 'D6']);
  });

  it('leaves names blank', () => {
    expect(headerPinName({ ...DEFAULT_HEADER_SETTINGS, naming: 'blank' }, 3)).toBe('');
  });
});

describe('headerLabelPositions', () => {
  const ls = 2;
  const half = (LABEL_HEIGHT / 2) * ls;
  const column = [{ x: 100, y: 0 }, { x: 102, y: 50 }, { x: 101, y: 100 }];
  const names = ['A', 'B', 'C'];

  it('right: one column at the usual offset, centred on each anchor', () => {
    const pos = headerLabelPositions(column, names, 'right', ls, measure);
    expect(pos).toEqual(column.map(a => ({ x: 102 + HEADER_LABEL_OFFSET * ls, y: a.y - half })));
  });

  it('left: anchor-side edges aligned, even for wider labels', () => {
    const wide = (t: string) => (t === 'B' ? 100 : 0);
    const pos = headerLabelPositions(column, names, 'left', ls, wide);
    const edge = 100 - HEADER_LABEL_OFFSET * ls;
    expect(pos.map(p => p.y)).toEqual(column.map(a => a.y - half));
    expect(pos[0].x).toBe(edge - 60 * ls);
    expect(pos[1].x).toBe(edge - 100 * ls);
  });

  const row = Array.from({ length: 6 }, (_, i) => ({ x: i * 10, y: 200 }));

  it('above: fans out in rows, outer pins nearest the header', () => {
    const pos = headerLabelPositions(row, [], 'above', ls, measure);
    const centreY = (i: number) => pos[i].y + half;
    // Tiers 0,1,2 for the left half and 2,1,0 for the right half
    const tiers = [0, 1, 2, 2, 1, 0];
    tiers.forEach((t, i) => expect(centreY(i)).toBe(200 - (FAN_FIRST_OFFSET + t * FAN_ROW_STEP) * ls));
    // Left half points left (right edge before the anchor), right half points right
    expect(pos[0].x + 60 * ls).toBeLessThan(row[0].x);
    expect(pos[5].x).toBeGreaterThan(row[5].x);
  });

  it('below mirrors above', () => {
    const above = headerLabelPositions(row, [], 'above', ls, measure);
    const below = headerLabelPositions(row, [], 'below', ls, measure);
    below.forEach((p, i) => {
      expect(p.x).toBe(above[i].x);
      expect(p.y + half - 200).toBeCloseTo(200 - (above[i].y + half));
    });
  });

  it('above/below: every leader goes sideways first, so none crosses another row', () => {
    const pos = headerLabelPositions(row, [], 'above', ls, measure);
    row.forEach((a, i) => {
      const cx = pos[i].x + 30 * ls;
      const cy = pos[i].y + half;
      const path = calculateManhattanPath(cx, cy, a.x, a.y);
      expect(path[3]).toBe(cy); // second point keeps the label's y: horizontal segment first
    });
  });

  it('handles a single pin above', () => {
    const [p] = headerLabelPositions([{ x: 0, y: 0 }], ['X'], 'above', 1, measure);
    expect(p.x).toBe(FAN_FIRST_OFFSET);
  });
});

describe('buildHeaderPins', () => {
  const pins = buildHeaderPins({
    start: { x: 0, y: 0 },
    end: { x: 0, y: 70 },
    settings: { ...DEFAULT_HEADER_SETTINGS, count: 8, prefix: 'P', startNumber: 1, step: 1 },
    side: 'right',
    labelScale: 1,
    headerId: 'h1',
    measure,
  });

  it('creates numbered pins sharing the header id, in order', () => {
    expect(pins).toHaveLength(8);
    expect(pins.map(p => p.text)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
    expect(pins.every(p => p.headerId === 'h1')).toBe(true);
    expect(pins.map(p => p.headerIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(pins.map(p => p.id)).size).toBe(8);
  });

  it('gives names their smart colour', () => {
    expect(pins[0].color).toBe('#0d9488'); // P1 → physical pin
  });

  it('lays the labels out on the requested side', () => {
    pins.forEach(p => expect(layoutPinLabels(p, 1, 12, measure).side).toBe('right'));
    expect(pins[3]).toMatchObject({ x: HEADER_LABEL_OFFSET, y: 30 - LABEL_HEIGHT / 2, targetX: 0, targetY: 30 });
  });

  it('uses the default colour for blank names', () => {
    const blank = buildHeaderPins({
      start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, settings: { ...DEFAULT_HEADER_SETTINGS, count: 2, naming: 'blank' },
      side: 'below', labelScale: 1, measure,
    });
    expect(blank.map(p => p.text)).toEqual(['', '']);
    expect(blank[0].color).toBe('#ef4444');
  });
});

describe('getHeaders', () => {
  const pin = (id: string, headerId?: string, headerIndex?: number): PinData => ({
    id, x: 0, y: 0, targetX: 0, targetY: 0, text: id, color: '#000', isPwm: false, headerId, headerIndex,
  });

  it('groups pins by header and sorts them by index', () => {
    const headers = getHeaders([pin('b', 'h', 1), pin('x'), pin('a', 'h', 0), pin('c', 'k', 0)]);
    expect(headers.map(h => h.id)).toEqual(['h', 'k']);
    expect(headers[0].pins.map(p => p.id)).toEqual(['a', 'b']);
    expect(describeHeader(headers[0])).toBe('a – b (2 pins)');
    expect(describeHeader(headers[1])).toBe('c (1 pin)');
    expect(describeHeader(headers[0], 'tr')).toBe('a – b (2 pin)');
    expect(describeHeader(headers[1], 'tr')).toBe('c (1 pin)');
  });

  it('re-ids headers consistently and strips membership', () => {
    let n = 0;
    const fresh = withFreshHeaderIds([pin('a', 'h', 0), pin('b', 'h', 1), pin('c')], () => `new${n++}`);
    expect(fresh.map(p => p.headerId)).toEqual(['new0', 'new0', undefined]);
    const solo = withoutHeader(pin('a', 'h', 0));
    expect('headerId' in solo || 'headerIndex' in solo).toBe(false);
  });
});
