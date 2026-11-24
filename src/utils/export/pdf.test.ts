import { describe, it, expect } from 'vitest';
import { renderPdf } from './pdf';
import type { PdfDoc, PdfImage } from './pdf';
import { buildExportScene } from './scene';
import type { ExportSceneInput, Scene } from './scene';
import { parseColor } from './color';

type Call = [string, ...unknown[]];

/** Records every call; text width is 2 mm per character at 10 pt, scaled with the font size. */
const stubPdf = (pageWidth = 297, pageHeight = 210) => {
  const calls: Call[] = [];
  let fontSize = 10;
  const record = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args]);
  };
  const doc: PdfDoc = {
    internal: { pageSize: { getWidth: () => pageWidth, getHeight: () => pageHeight } },
    setFillColor: record('setFillColor'),
    setDrawColor: record('setDrawColor'),
    setTextColor: record('setTextColor'),
    setLineWidth: record('setLineWidth'),
    setLineCap: record('setLineCap'),
    setLineJoin: record('setLineJoin'),
    setFont: record('setFont'),
    setFontSize: (size: number) => {
      fontSize = size;
      calls.push(['setFontSize', size]);
    },
    getTextWidth: (text: string) => text.length * 2 * (fontSize / 10),
    text: record('text'),
    rect: record('rect'),
    roundedRect: record('roundedRect'),
    circle: record('circle'),
    lines: record('lines'),
    addImage: record('addImage'),
    saveGraphicsState: record('saveGraphicsState'),
    restoreGraphicsState: record('restoreGraphicsState'),
    setGState: record('setGState'),
  };
  return { doc, calls, named: (name: string) => calls.filter(c => c[0] === name) };
};

const input: ExportSceneInput = {
  images: [{ id: 'i', src: 'data:image/jpeg;base64,AAAA', x: 300, y: 200, width: 400, height: 300, rotation: 0 }],
  pins: [
    {
      id: 'p1', x: 100, y: 0, targetX: 260, targetY: 12, text: 'PA0', color: '#1d4ed8', isPwm: false,
      functions: [{ id: 'a', text: 'ADC0', color: '#16a34a' }],
    },
    { id: 'p2', x: 600, y: 300, targetX: 400, targetY: 200, text: 'PB1', color: '#e11d48', isPwm: true },
  ],
  lines: [{ id: 'l', points: [0, 400, 200, 450], color: '#ff0000', thickness: 2 }],
  labelScale: 1,
  gapSize: 10,
  anchorSize: 5,
  legendItems: [{ id: '1', text: 'USART', color: '#1d4ed8' }, { id: '2', text: 'SPI', color: '#9333ea' }],
  includeLegend: true,
  legendMode: 'dimUnused',
};

const image = (img: { cx: number; cy: number; width: number; height: number; src: string }): PdfImage => ({
  data: img.src, format: 'JPEG', x: img.cx - img.width / 2, y: img.cy - img.height / 2, width: img.width, height: img.height,
});

const render = (scene: Scene, stub = stubPdf()) => {
  const gStates: unknown[] = [];
  renderPdf(scene, stub.doc, {
    createGState: o => {
      gStates.push(o);
      return o;
    },
    imageFor: image,
  });
  return { ...stub, gStates };
};

describe('renderPdf', () => {
  const scene = buildExportScene(input, () => 60)!;

  it('writes every label and legend string as real text', () => {
    const { named } = render(scene);
    expect(named('text').map(c => c[1])).toEqual(['PA0', 'ADC0', 'PB1', 'TABLE', 'USART', 'SPI', 'Standard Pin', 'PWM Pin']);
    expect(named('text')[0][4]).toEqual({ align: 'center', baseline: 'alphabetic' });
    expect(named('setFont').map(c => c[2])).toContain('bold');
  });

  it('draws labels as rounded rects, lines as polylines and anchors as circles', () => {
    const { named } = render(scene);
    // 3 labels + legend box, each with a 3-layer shadow
    expect(named('roundedRect')).toHaveLength(4 * 4);
    // 2 legend rows (square corners)
    expect(named('rect')).toHaveLength(2);
    expect(named('circle')).toHaveLength(2);
    // 2 leaders + drawn line + 3 legend key lines
    expect(named('lines')).toHaveLength(6);
    expect(named('addImage')).toHaveLength(1);
  });

  it('fits the scene on the page and centres it', () => {
    const { named } = render(scene);
    const [, , , x, y, w, h] = named('addImage')[0] as [string, unknown, unknown, number, number, number, number];
    const k = Math.min(297 / scene.bounds.width, 210 / scene.bounds.height);
    expect(w).toBeCloseTo(400 * k);
    expect(h).toBeCloseTo(300 * k);
    // The scene's centre lands on the page centre
    const sceneCx = scene.bounds.x + scene.bounds.width / 2;
    const sceneCy = scene.bounds.y + scene.bounds.height / 2;
    expect(x + w / 2 + (sceneCx - 300) * k).toBeCloseTo(297 / 2);
    expect(y + h / 2 + (sceneCy - 200) * k).toBeCloseTo(210 / 2);
  });

  it('applies opacity (dimmed rows, translucent strokes, shadows) through graphics states', () => {
    const { gStates, named } = render(scene);
    // Dimmed SPI row: its fill, its rgba(0,0,0,0.5) border, then its text
    expect(gStates).toContainEqual({ opacity: 0.35, 'stroke-opacity': 0.175 });
    expect(gStates).toContainEqual({ opacity: 0.35, 'stroke-opacity': 1 });
    expect(named('saveGraphicsState')).toHaveLength(named('restoreGraphicsState').length);
    expect(named('saveGraphicsState').length).toBe(gStates.length);
  });

  it('shrinks text that would overflow its label in Helvetica', () => {
    const wide = buildExportScene({ ...input, pins: [{ ...input.pins[0], text: 'A_VERY_LONG_NAME', functions: [] }], includeLegend: false }, () => 60)!;
    const stub = render(wide, stubPdf(1000, 1000));
    const textIndex = stub.calls.findIndex(c => c[0] === 'text');
    const sizes = stub.calls.slice(0, textIndex).filter(c => c[0] === 'setFontSize').map(c => c[1] as number);
    expect(sizes).toHaveLength(2);
    expect(sizes[1]).toBeLessThan(sizes[0]);
  });
});

describe('parseColor', () => {
  it('reads hex, rgb() and named colours', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#1d4ed880')).toEqual({ r: 29, g: 78, b: 216, a: 128 / 255 });
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('nonsense')).toBeNull();
  });
});
