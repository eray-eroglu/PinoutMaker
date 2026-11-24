import { describe, it, expect } from 'vitest';
import { fitToContent, getContentBounds, zoomAroundCentre, centreOn } from './viewport';
import { nudgeImage, nudgeLine, nudgePin } from './nudge';
import { duplicateLine, duplicatePin } from './duplicate';
import type { LineData, PinData } from '../types';
import type { LoadedImage } from './project';

const vp = { width: 1000, height: 600 };

describe('fitToContent', () => {
  it('fits wide content by width', () => {
    const r = fitToContent({ minX: 0, minY: 0, maxX: 2000, maxY: 100 }, vp, 40);
    expect(r.scale).toBeCloseTo(920 / 2000);
    expect(r.position.x).toBeCloseTo(40);
    expect(r.position.y).toBeCloseTo(300 - 50 * r.scale);
  });
  it('fits tall content by height', () => {
    const r = fitToContent({ minX: 0, minY: 0, maxX: 100, maxY: 2000 }, vp, 40);
    expect(r.scale).toBeCloseTo(520 / 2000);
    expect(r.position.y).toBeCloseTo(40);
  });
  it('clamps to the zoom limits', () => {
    expect(fitToContent({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, vp).scale).toBe(10);
    expect(fitToContent({ minX: 0, minY: 0, maxX: 1e6, maxY: 1e6 }, vp).scale).toBe(0.1);
  });
  it('resets for empty content', () => {
    expect(fitToContent(null, vp)).toEqual({ scale: 1, position: { x: 0, y: 0 } });
  });
  it('keeps content inside the margin', () => {
    const b = { minX: -500, minY: 200, maxX: 700, maxY: 500 };
    const r = fitToContent(b, vp, 40);
    expect(b.minX * r.scale + r.position.x).toBeGreaterThanOrEqual(40 - 1e-6);
    expect(b.maxX * r.scale + r.position.x).toBeLessThanOrEqual(960 + 1e-6);
  });
});

describe('zoom helpers', () => {
  it('keeps the centre point fixed', () => {
    const r = zoomAroundCentre({ scale: 2, position: { x: 100, y: 50 } }, vp, 1.1);
    expect((500 - r.position.x) / r.scale).toBeCloseTo((500 - 100) / 2);
    expect(r.scale).toBeCloseTo(2.2);
  });
  it('clamps zoom', () => {
    expect(zoomAroundCentre({ scale: 10, position: { x: 0, y: 0 } }, vp, 1.1).scale).toBe(10);
  });
  it('centreOn puts content centre mid-viewport', () => {
    expect(centreOn({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, vp, 1)).toEqual({ x: 450, y: 250 });
  });
});

describe('getContentBounds', () => {
  it('is null when empty', () => {
    expect(getContentBounds({ images: [], pins: [], lines: [], labelScale: 1, gapSize: 12 })).toBeNull();
  });
});

const pin: PinData = { id: 'a', x: 10, y: 20, targetX: 5, targetY: 6, text: 'P', color: '#000', isPwm: false };
const line: LineData = { id: 'l', points: [0, 0, 10, 0, 10, 10], color: '#000', thickness: 2 };

describe('nudge', () => {
  it('moves only the label by default', () => {
    expect(nudgePin(pin, 1, -1)).toMatchObject({ x: 11, y: 19, targetX: 5, targetY: 6 });
  });
  it('moves the whole pin with the anchor', () => {
    expect(nudgePin(pin, 10, 0, true)).toMatchObject({ x: 20, targetX: 15, targetY: 6 });
  });
  it('moves all line points', () => {
    expect(nudgeLine(line, 2, 3).points).toEqual([2, 3, 12, 3, 12, 13]);
  });
  it('moves an image', () => {
    expect(nudgeImage({ id: 'i', x: 1, y: 2 } as LoadedImage, 1, 1)).toMatchObject({ x: 2, y: 3 });
  });
});

describe('duplicate', () => {
  it('gives a pin a new id and +20 offset', () => {
    const d = duplicatePin(pin);
    expect(d.id).not.toBe(pin.id);
    expect(d).toMatchObject({ x: 30, y: 40, targetX: 25, targetY: 26 });
  });
  it('takes a duplicated pin out of its header', () => {
    const d = duplicatePin({ ...pin, headerId: 'h', headerIndex: 2 });
    expect(d.headerId).toBeUndefined();
    expect(d.headerIndex).toBeUndefined();
  });
  it('gives a line a new id and offset points', () => {
    const d = duplicateLine(line);
    expect(d.id).not.toBe(line.id);
    expect(d.points).toEqual([20, 20, 30, 20, 30, 30]);
  });
});
