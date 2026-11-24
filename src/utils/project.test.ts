import { describe, it, expect } from 'vitest';
import { parseProject, serializeProject } from './project';
import { DEFAULT_LEGEND_ITEMS } from '../constants';
import { DEFAULT_PIN_COLOR } from './pinUtils';
import type { PinData } from '../types';

describe('parseProject', () => {
  it('fills defaults for a minimal file', () => {
    const p = parseProject(JSON.stringify({ pins: [], scale: 1, position: { x: 0, y: 0 } }));
    expect(p.images).toEqual([]);
    expect(p.lines).toEqual([]);
    expect(p.gapSize).toBe(12);
    expect(p.anchorSize).toBe(5);
    expect(p.isLegendVisible).toBe(true);
    expect(p.legendMode).toBe('all');
    expect(p.legendShowCounts).toBe(false);
    expect(p.legendItems).toEqual(DEFAULT_LEGEND_ITEMS);
  });

  it('migrates legacy x1/y1/x2/y2 lines to points[]', () => {
    const p = parseProject(JSON.stringify({
      pins: [], scale: 1, position: { x: 0, y: 0 },
      lines: [{ id: 'l', x1: 1, y1: 2, x2: 3, y2: 4, color: '#000', thickness: 2 }],
    }));
    expect(p.lines[0].points).toEqual([1, 2, 3, 4]);
  });

  it('converts the legacy single image into an images[] entry', () => {
    const p = parseProject(JSON.stringify({ image: 'data:image/png;base64,AAA', rotation: 90, pins: [], scale: 1, position: { x: 0, y: 0 } }));
    expect(p.images).toHaveLength(1);
    expect(p.images[0]).toMatchObject({ src: 'data:image/png;base64,AAA', rotation: 90, x: 0, y: 0 });
  });

  it('keeps gapSize 0 instead of replacing it with the default', () => {
    expect(parseProject(JSON.stringify({ pins: [], scale: 1, position: { x: 0, y: 0 }, gapSize: 0 })).gapSize).toBe(0);
  });

  it('freezes legacy zoom-dependent labels at the zoom the file was saved with', () => {
    const p = parseProject(JSON.stringify({
      scale: 0.42, position: { x: 0, y: 0 },
      pins: [{ id: 'a', x: 0, y: 0, targetX: 100, targetY: 100, labelDx: 42, labelDy: -21, text: 'PA0', color: '#000', isPwm: false }],
    }));
    expect(p.labelScale).toBeCloseTo(1 / 0.42);
    expect(p.pins[0].x).toBeCloseTo(200);
    expect(p.pins[0].y).toBeCloseTo(50);
    expect(p.pins[0].labelDx).toBeUndefined();
  });

  it('leaves labelScale unset for an empty legacy project', () => {
    expect(parseProject(JSON.stringify({ pins: [], scale: 0.5, position: { x: 0, y: 0 } })).labelScale).toBeNull();
  });

  it('does not touch pins of files that already have labelScale', () => {
    const pin = { id: 'a', x: 5, y: 6, targetX: 0, targetY: 0, text: 'X', color: '#000', isPwm: false };
    const p = parseProject(JSON.stringify({ scale: 0.3, position: { x: 0, y: 0 }, labelScale: 2, pins: [pin] }));
    expect(p.labelScale).toBe(2);
    expect(p.pins[0]).toEqual(pin);
  });

  it('loads pins of older files without functions unchanged', () => {
    const pin = { id: 'a', x: 5, y: 6, targetX: 0, targetY: 0, text: 'PA0', color: '#000', isPwm: false };
    const p = parseProject(JSON.stringify({ scale: 1, position: { x: 0, y: 0 }, labelScale: 1, pins: [pin] }));
    expect(p.pins[0]).toEqual(pin);
    expect('functions' in p.pins[0]).toBe(false);
  });

  it('fills missing function ids and colors and drops a malformed functions field', () => {
    const p = parseProject(JSON.stringify({
      scale: 1, position: { x: 0, y: 0 }, labelScale: 1,
      pins: [
        { id: 'a', x: 0, y: 0, targetX: 0, targetY: 0, text: 'PA0', color: '#000', isPwm: false, functions: [{ text: 'ADC0' }] },
        { id: 'b', x: 0, y: 0, targetX: 0, targetY: 0, text: 'PA1', color: '#000', isPwm: false, functions: 'oops' },
      ],
    }));
    expect(p.pins[0].functions).toEqual([{ id: expect.any(String), text: 'ADC0', color: DEFAULT_PIN_COLOR }]);
    expect(p.pins[0].functions![0].id).not.toBe('');
    expect(p.pins[1].functions).toBeUndefined();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseProject('not json')).toThrow();
  });
});

describe('serializeProject', () => {
  it('drops the runtime image element', () => {
    const element = {} as HTMLImageElement;
    const data = serializeProject({
      images: [{ id: 'i', src: 's', x: 1, y: 2, width: 3, height: 4, rotation: 0, element } as never],
      pins: [], lines: [], scale: 1, position: { x: 0, y: 0 }, gapSize: 12,
      legendItems: [], isLegendVisible: true, legendMode: 'all', legendShowCounts: false, anchorSize: 5, labelScale: null,
    });
    expect(data.images?.[0]).toEqual({ id: 'i', src: 's', x: 1, y: 2, width: 3, height: 4, rotation: 0 });
  });

  it('round-trips function labels through save and load', () => {
    const pins: PinData[] = [{
      id: 'a', x: 10, y: 20, targetX: 100, targetY: 30, text: 'PA0', color: '#0d9488', isPwm: true,
      functions: [
        { id: 'f1', text: 'ADC0', color: '#16a34a' },
        { id: 'f2', text: 'CTS2', color: '#1d4ed8', textColor: '#ffff00' },
      ],
    }];
    const json = JSON.stringify(serializeProject({
      images: [], pins, lines: [], scale: 1, position: { x: 0, y: 0 }, gapSize: 8,
      legendItems: [], isLegendVisible: true, anchorSize: 5, labelScale: 1.5, legendMode: 'all', legendShowCounts: false,
    }));
    const loaded = parseProject(json);
    expect(loaded.pins).toEqual(pins);
    expect(loaded.gapSize).toBe(8);
  });

  it('round-trips header membership through save and load', () => {
    const pins: PinData[] = [0, 1].map(i => ({
      id: `p${i}`, x: 50, y: i * 30, targetX: 0, targetY: i * 30, text: `P${i + 1}`, color: '#0d9488', isPwm: false,
      headerId: 'header-1', headerIndex: i,
    }));
    const json = JSON.stringify(serializeProject({
      images: [], pins, lines: [], scale: 1, position: { x: 0, y: 0 }, gapSize: 12,
      legendItems: [], isLegendVisible: true, anchorSize: 5, labelScale: 1, legendMode: 'all', legendShowCounts: false,
    }));
    expect(parseProject(json).pins).toEqual(pins);
  });
});

describe('parseProject header fields', () => {
  const load = (pin: Record<string, unknown>) =>
    parseProject(JSON.stringify({
      scale: 1, position: { x: 0, y: 0 }, labelScale: 1,
      pins: [{ id: 'a', x: 0, y: 0, targetX: 0, targetY: 0, text: 'A', color: '#000', isPwm: false, ...pin }],
    })).pins[0];

  it('leaves older pins without header fields untouched', () => {
    expect('headerId' in load({})).toBe(false);
  });

  it('drops incomplete or malformed header membership', () => {
    for (const bad of [{ headerId: 'h' }, { headerIndex: 1 }, { headerId: 'h', headerIndex: -1 }, { headerId: 3, headerIndex: 0 }, { headerId: 'h', headerIndex: 1.5 }]) {
      const pin = load(bad);
      expect(pin.headerId).toBeUndefined();
      expect(pin.headerIndex).toBeUndefined();
    }
  });
});
