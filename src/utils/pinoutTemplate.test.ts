import { describe, it, expect } from 'vitest';
import type { LineData, PinData } from '../types';
import {
  exportPinoutTemplate, importPinoutTemplate, parsePinoutTemplate, pinoutFileName,
} from './pinoutTemplate';
import type { PinoutTemplate, PlacedImage } from './pinoutTemplate';

const pin = (over: Partial<PinData> = {}): PinData => ({
  id: 'p1', x: 120, y: -40, targetX: 100, targetY: -50, text: 'PA0', color: '#1d4ed8', isPwm: false, ...over,
});
const line: LineData = { id: 'l1', points: [10, 20, 10, 80, 60, 80], color: '#000000', thickness: 2 };

const template = (over: Partial<PinoutTemplate> = {}): PinoutTemplate => ({
  version: 1, imageWidth: 200, imageHeight: 100, labelScale: 0.5, pins: [pin()], lines: [line], ...over,
});

const placed = (over: Partial<PlacedImage> = {}): PlacedImage => ({ x: 0, y: 0, width: 200, height: 100, rotation: 0, ...over });

const seqIds = () => {
  let n = 0;
  return () => `new-${++n}`;
};

describe('importPinoutTemplate', () => {
  it('gives each imported header a fresh id shared by its pins', () => {
    const headerPins = [pin({ id: 'a', headerId: 'h', headerIndex: 0 }), pin({ id: 'b', headerId: 'h', headerIndex: 1 })];
    const r = importPinoutTemplate(template({ pins: headerPins }), placed(), null, seqIds());
    expect(r.pins[0].headerId).not.toBe('h');
    expect(r.pins[1].headerId).toBe(r.pins[0].headerId);
    expect(r.pins.map(p => p.headerIndex)).toEqual([0, 1]);
  });

  it('translates an unrotated, unscaled image to its centre', () => {
    const r = importPinoutTemplate(template(), placed({ x: 1000, y: 500 }), null);
    expect(r.pins[0]).toMatchObject({ x: 1120, y: 460, targetX: 1100, targetY: 450 });
    expect(r.lines[0].points).toEqual([1010, 520, 1010, 580, 1060, 580]);
  });

  it('scales with the placed size (including a non-uniform resize)', () => {
    const r = importPinoutTemplate(template(), placed({ width: 400, height: 100 }), null);
    expect(r.pins[0]).toMatchObject({ x: 240, y: -40, targetX: 200, targetY: -50 });
  });

  it('rotates clockwise by the image rotation (90 degrees)', () => {
    const r = importPinoutTemplate(
      template({ pins: [pin({ x: 30, y: 0, targetX: 10, targetY: 0 })] }),
      placed({ x: 5, y: 5, rotation: 90 }),
      null,
    );
    // (10, 0) turned clockwise on a y-down canvas points straight down
    expect(r.pins[0].targetX).toBeCloseTo(5);
    expect(r.pins[0].targetY).toBeCloseTo(15);
    expect(r.pins[0].x).toBeCloseTo(5);
    expect(r.pins[0].y).toBeCloseTo(35);
  });

  it('adopts the template label scale (times the size factor) when the project has none', () => {
    const r = importPinoutTemplate(template(), placed({ width: 400, height: 200 }), null);
    expect(r.labelScale).toBeCloseTo(1);
    // label offset (20,10) scales with the image
    expect(r.pins[0].x - r.pins[0].targetX).toBeCloseTo(40);
  });

  it('keeps the project label scale and rescales label offsets around the anchors', () => {
    const r = importPinoutTemplate(template(), placed({ width: 400, height: 200 }), 2);
    expect(r.labelScale).toBe(2);
    // template world scale is 1, project is 2 -> offsets double (40 -> 80); anchors stay put
    expect(r.pins[0].targetX).toBeCloseTo(200);
    expect(r.pins[0].x - r.pins[0].targetX).toBeCloseTo(80);
    expect(r.pins[0].y - r.pins[0].targetY).toBeCloseTo(20 * 2);
  });

  it('regenerates ids, including nested items, and passes unknown fields through', () => {
    const withFns = {
      ...pin(),
      functions: [{ id: 'f1', text: 'ADC0', color: '#16a34a' }, { id: 'f2', text: 'CTS2', color: '#1d4ed8' }],
      note: 'keep',
    };
    const r = importPinoutTemplate(
      template({ pins: [withFns as PinData], legendItems: [{ id: 'g1', text: 'ADC', color: '#16a34a' }] }),
      placed(),
      null,
      seqIds(),
    );
    const out = r.pins[0] as unknown as typeof withFns;
    expect(out.id).toBe('new-1');
    expect(out.functions.map(f => f.id)).toEqual(['new-2', 'new-3']);
    expect(out.functions.map(f => f.text)).toEqual(['ADC0', 'CTS2']);
    expect(out.note).toBe('keep');
    expect(r.lines[0].id).toBe('new-4');
    expect(r.legendItems[0]).toMatchObject({ id: 'new-5', text: 'ADC' });
  });

  it('gives different ids on every import of the same template', () => {
    const t = template();
    const a = importPinoutTemplate(t, placed(), null);
    const b = importPinoutTemplate(t, placed(), null);
    expect(a.pins[0].id).not.toBe(b.pins[0].id);
    expect(a.pins[0].id).not.toBe('p1');
  });
});

describe('exportPinoutTemplate', () => {
  it('round-trips import -> export for a rotated, resized image', () => {
    const image = placed({ x: 300, y: -200, width: 500, height: 250, rotation: 90 });
    const original = template({ pins: [pin(), pin({ id: 'p2', x: -80, y: 33, targetX: -60, targetY: 40 })] });
    const imported = importPinoutTemplate(original, image, null);
    const back = exportPinoutTemplate(image, imported.pins, imported.lines, imported.labelScale);

    // The export uses the image's current size as reference, so compare in that space
    const k = image.width / original.imageWidth;
    expect(back.imageWidth).toBe(500);
    expect(back.labelScale).toBeCloseTo(original.labelScale * k, 4);
    back.pins.forEach((p, i) => {
      const o = original.pins[i];
      expect(p.x).toBeCloseTo(o.x * k, 1);
      expect(p.y).toBeCloseTo(o.y * k, 1);
      expect(p.targetX).toBeCloseTo(o.targetX * k, 1);
      expect(p.targetY).toBeCloseTo(o.targetY * k, 1);
    });
    back.lines?.[0].points.forEach((v, i) => expect(v).toBeCloseTo(line.points[i] * k, 1));
  });

  it('exports and re-imports onto the same image to the same world positions', () => {
    const image = placed({ x: 40, y: 60, width: 320, height: 160, rotation: 270 });
    const worldPins = [pin({ x: 10, y: 20, targetX: -15, targetY: 90 })];
    const tpl = exportPinoutTemplate(image, worldPins, [], 0.7);
    const r = importPinoutTemplate(tpl, image, 0.7);
    expect(r.pins[0].x).toBeCloseTo(10, 1);
    expect(r.pins[0].y).toBeCloseTo(20, 1);
    expect(r.pins[0].targetX).toBeCloseTo(-15, 1);
    expect(r.pins[0].targetY).toBeCloseTo(90, 1);
  });

  it('produces a template that survives JSON and validation', () => {
    const tpl = exportPinoutTemplate(placed({ rotation: 90 }), [pin()], [line], 0.5, [{ id: 'g', text: 'GND', color: '#000' }]);
    expect(parsePinoutTemplate(JSON.parse(JSON.stringify(tpl)))).toMatchObject({ version: 1, imageWidth: 200 });
  });
});

describe('parsePinoutTemplate', () => {
  it('accepts a valid template, also as a JSON string', () => {
    expect(parsePinoutTemplate(template())).not.toBeNull();
    expect(parsePinoutTemplate(JSON.stringify(template()))).not.toBeNull();
  });

  it('fills defaults for optional pin fields', () => {
    const t = parsePinoutTemplate({ ...template(), pins: [{ x: 1, y: 2, targetX: 3, targetY: 4 }] });
    expect(t?.pins[0]).toMatchObject({ text: '', isPwm: false });
    expect(typeof t?.pins[0].color).toBe('string');
  });

  it.each([
    ['null', null],
    ['a number', 5],
    ['an array', []],
    ['bad JSON', '{nope'],
    ['unknown version', { ...template(), version: 2 }],
    ['zero image width', { ...template(), imageWidth: 0 }],
    ['NaN image height', { ...template(), imageHeight: NaN }],
    ['negative label scale', { ...template(), labelScale: -1 }],
    ['missing pins', { ...template(), pins: undefined }],
    ['pin without coordinates', { ...template(), pins: [{ id: 'x', x: 1 }] }],
    ['pin that is not an object', { ...template(), pins: [7] }],
    ['line with odd points', { ...template(), lines: [{ id: 'l', points: [1, 2, 3, 4, 5] }] }],
    ['line with non-numeric points', { ...template(), lines: [{ id: 'l', points: [1, 2, 'a', 4] }] }],
    ['legend that is not an array', { ...template(), legendItems: 'x' }],
  ])('rejects %s', (_label, raw) => {
    expect(parsePinoutTemplate(raw)).toBeNull();
  });
});

describe('pinoutFileName', () => {
  it('uses the image file name from a URL', () => {
    expect(pinoutFileName('https://x.supabase.co/storage/v1/object/public/p/Blue%20Pill.png?v=2')).toBe('Blue-Pill-pinout.json');
  });
  it('falls back to "board" for uploads', () => {
    expect(pinoutFileName('data:image/png;base64,AAAA')).toBe('board-pinout.json');
  });
});
