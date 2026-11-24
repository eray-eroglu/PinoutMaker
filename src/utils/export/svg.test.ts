import { describe, it, expect } from 'vitest';
import { renderSvg, SVG_FONT_FAMILY } from './svg';
import { buildExportScene } from './scene';
import type { ExportSceneInput } from './scene';

const input: ExportSceneInput = {
  images: [{ id: 'i', src: 'data:image/png;base64,AAAA', x: 300, y: 200, width: 400, height: 300, rotation: 90 }],
  pins: [
    {
      id: 'p1', x: 100, y: 0, targetX: 260, targetY: 12, text: 'PA0 & <x>', color: '#1d4ed8', isPwm: false,
      functions: [{ id: 'a', text: 'ADC0', color: '#16a34a' }],
    },
    { id: 'p2', x: 600, y: 300, targetX: 400, targetY: 200, text: 'PB1', color: '#e11d48', isPwm: true },
  ],
  lines: [{ id: 'l', points: [0, 400, 200, 450], color: 'rgba(255,0,0,0.5)', thickness: 2 }],
  labelScale: 1,
  gapSize: 10,
  anchorSize: 5,
  legendItems: [
    { id: '1', text: 'USART', color: '#1d4ed8' },
    { id: '2', text: 'SPI', color: '#9333ea' },
  ],
  includeLegend: true,
  legendMode: 'dimUnused',
};

const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');

describe('renderSvg', () => {
  const scene = buildExportScene(input, () => 60)!;
  const svg = renderSvg(scene, { background: '#ffffff', imageHref: img => img.src });
  const doc = parse(svg);
  const root = doc.documentElement;

  it('produces a well-formed standalone SVG document', () => {
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(root.tagName).toBe('svg');
    expect(root.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    expect(root.querySelector('title')?.textContent).toBe('Pinout');
    const { x, y, width, height } = scene.bounds;
    expect(root.getAttribute('viewBox')).toBe(`${x} ${y} ${width} ${height}`);
  });

  it('contains the expected elements', () => {
    // Background + 3 labels + legend box + 2 legend rows
    expect(root.querySelectorAll('rect')).toHaveLength(1 + 3 + 1 + 2);
    // 2 leader lines + 1 drawn line + legend separator, standard and PWM key
    expect(root.querySelectorAll('path')).toHaveLength(2 + 1 + 3);
    expect(root.querySelectorAll('circle')).toHaveLength(2);
    expect(root.querySelectorAll('image')).toHaveLength(1);
    expect(root.querySelector('image')?.getAttribute('transform')).toBe('rotate(90 300 200)');
    expect(root.querySelector('image')?.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('data:image/png;base64,AAAA');
  });

  it('writes escaped, centred label text in the export font', () => {
    const texts = [...root.querySelectorAll('text')];
    expect(texts.map(t => t.textContent)).toEqual([
      'PA0 & <x>', 'ADC0', 'PB1', 'TABLE', 'USART', 'SPI', 'Standard Pin', 'PWM Pin',
    ]);
    const label = texts[0];
    expect(label.getAttribute('text-anchor')).toBe('middle');
    expect(label.getAttribute('font-family')).toBe(SVG_FONT_FAMILY);
    expect(label.getAttribute('font-weight')).toBe('600');
    expect(label.getAttribute('fill')).toBe('#ffffff');
  });

  it('turns alpha colours and dimmed rows into opacity attributes', () => {
    const drawn = [...root.querySelectorAll('path')].find(p => p.getAttribute('stroke') === '#ff0000')!;
    expect(drawn.getAttribute('stroke-opacity')).toBe('0.5');
    const spiRow = [...root.querySelectorAll('rect')].find(r => r.getAttribute('fill') === '#9333ea')!;
    expect(spiRow.getAttribute('opacity')).toBe('0.35');
  });

  it('shares one shadow filter between labels of the same size', () => {
    const filters = root.querySelectorAll('filter');
    // Label shadow + legend shadow
    expect(filters).toHaveLength(2);
    const labelRects = [...root.querySelectorAll('rect')].filter(r => r.getAttribute('filter') && r.getAttribute('fill') !== '#e6e6e6');
    expect(new Set(labelRects.map(r => r.getAttribute('filter')))).toEqual(new Set(['url(#shadow0)']));
  });

  it('can leave the background transparent and skip images without a source', () => {
    const bare = parse(renderSvg(scene, { background: null, imageHref: () => null })).documentElement;
    expect(bare.querySelectorAll('rect')).toHaveLength(3 + 1 + 2);
    expect(bare.querySelectorAll('image')).toHaveLength(0);
  });
});
