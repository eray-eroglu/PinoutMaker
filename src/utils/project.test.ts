import { describe, it, expect } from 'vitest';
import { parseProject, serializeProject } from './project';
import { DEFAULT_LEGEND_ITEMS } from '../constants';

describe('parseProject', () => {
  it('fills defaults for a minimal file', () => {
    const p = parseProject(JSON.stringify({ pins: [], scale: 1, position: { x: 0, y: 0 } }));
    expect(p.images).toEqual([]);
    expect(p.lines).toEqual([]);
    expect(p.gapSize).toBe(12);
    expect(p.anchorSize).toBe(5);
    expect(p.isLegendVisible).toBe(true);
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
      legendItems: [], isLegendVisible: true, anchorSize: 5,
    });
    expect(data.images?.[0]).toEqual({ id: 'i', src: 's', x: 1, y: 2, width: 3, height: 4, rotation: 0 });
  });
});
