import { describe, it, expect } from 'vitest';
import { buildExportScene, EXPORT_PADDING, LEGEND_DIM_OPACITY, rotatedSize } from './scene';
import type { ExportSceneInput, SceneCircle, ScenePolyline, SceneRect, SceneText } from './scene';
import type { PinData } from '../../types';
import { calculateWavePoints } from '../lineUtils';
import { LABEL_FONT_SIZE, LABEL_HEIGHT } from '../pinLayout';

const measure = () => 60;

const pin = (over: Partial<PinData> = {}): PinData => ({
  id: 'p1', x: 100, y: 0, targetX: 200, targetY: 12, text: 'PA0', color: '#1d4ed8', isPwm: false, ...over,
});

const input = (over: Partial<ExportSceneInput> = {}): ExportSceneInput => ({
  images: [],
  pins: [],
  lines: [],
  labelScale: 1,
  gapSize: 10,
  anchorSize: 5,
  legendItems: [],
  includeLegend: false,
  legendMode: 'all',
  ...over,
});

const build = (over: Partial<ExportSceneInput> = {}) => {
  const scene = buildExportScene(input(over), measure);
  if (!scene) throw new Error('expected a scene');
  return scene;
};

const ofKind = <K extends string>(scene: { primitives: { kind: string }[] }, kind: K) =>
  scene.primitives.filter(p => p.kind === kind);

describe('buildExportScene', () => {
  it('returns null for an empty board', () => {
    expect(buildExportScene(input(), measure)).toBeNull();
  });

  it('draws a pin as leader line, anchor, then label rect and centred text', () => {
    const scene = build({ pins: [pin()], labelScale: 2 });
    expect(scene.primitives.map(p => p.kind)).toEqual(['polyline', 'circle', 'rect', 'text']);

    const [leader, anchor, rect, text] = scene.primitives as [ScenePolyline, SceneCircle, SceneRect, SceneText];
    // From the primary label centre (100 + 120 / 2, 48 / 2) to the anchor, horizontal first
    expect(leader.points).toEqual([160, 24, 200, 24, 200, 12]);
    expect(leader.strokeWidth).toBe(4);
    expect(anchor).toMatchObject({ cx: 200, cy: 12, r: 10, fill: '#1d4ed8' });
    expect(rect).toMatchObject({ x: 100, y: 0, width: 120, height: LABEL_HEIGHT * 2, radius: 8, fill: '#1d4ed8' });
    expect(text).toMatchObject({ text: 'PA0', x: 160, align: 'center', fontSize: LABEL_FONT_SIZE * 2, fontWeight: 600, fill: 'white' });
    // Baseline a little below the label's vertical centre
    expect(text.y).toBeGreaterThan(LABEL_HEIGHT);
    expect(text.y).toBeLessThan(LABEL_HEIGHT * 2);
  });

  it('includes function rows with their own colours and smart text colour', () => {
    const scene = build({
      pins: [pin({
        functions: [
          { id: 'a', text: 'ADC0', color: '#ffff00' },
          { id: 'b', text: 'CTS2', color: '#000000', textColor: '#ff0000' },
        ],
      })],
    });
    const rects = ofKind(scene, 'rect') as SceneRect[];
    const texts = ofKind(scene, 'text') as SceneText[];
    // Anchor is right of the label, so the row grows left: 100 → 30 → -40
    expect(rects.map(r => r.x)).toEqual([100, 30, -40]);
    expect(texts.map(t => t.text)).toEqual(['PA0', 'ADC0', 'CTS2']);
    expect(texts.map(t => t.fill)).toEqual(['white', 'black', '#ff0000']);
  });

  it('uses the labelScale-sized wave for PWM pins, like PinComponent', () => {
    const scene = build({ pins: [pin({ isPwm: true, targetX: 400 })], labelScale: 2 });
    const leader = scene.primitives[0] as ScenePolyline;
    expect(leader.points).toEqual(calculateWavePoints([160, 24, 400, 24, 400, 12], 1 / 2));
    expect(leader.points.length).toBeGreaterThan(6);
  });

  it('hides anchors when anchorSize is 0', () => {
    const scene = build({ pins: [pin()], anchorSize: 0 });
    expect(ofKind(scene, 'circle')).toHaveLength(0);
  });

  it('builds drawn lines as orthogonal paths with thickness × labelScale', () => {
    const scene = build({ lines: [{ id: 'l', points: [0, 0, 100, 20, 120, 200], color: '#f00', thickness: 3 }], labelScale: 2 });
    const [line] = scene.primitives as ScenePolyline[];
    expect(line.points).toEqual([0, 0, 100, 0, 100, 20, 100, 200, 120, 200]);
    expect(line).toMatchObject({ strokeWidth: 6, cap: 'round', join: 'round' });
  });

  it('pads the content bounds by EXPORT_PADDING label units', () => {
    const scene = build({ lines: [{ id: 'l', points: [0, 0, 100, 0], color: '#000', thickness: 2 }], labelScale: 0.5 });
    const pad = EXPORT_PADDING * 0.5;
    // Half the stroke (2 × 0.5 / 2 = 0.5) sticks out on every side
    expect(scene.bounds).toEqual({ x: -0.5 - pad, y: -0.5 - pad, width: 101 + 2 * pad, height: 1 + 2 * pad });
  });

  it('uses the exact rotated box of images for the bounds', () => {
    const scene = build({
      images: [{ id: 'i', src: 'data:x', x: 500, y: 300, width: 400, height: 200, rotation: 90 }],
      labelScale: 1,
    });
    expect(scene.primitives[0]).toMatchObject({ kind: 'image', cx: 500, cy: 300, width: 400, height: 200, rotation: 90 });
    const pad = EXPORT_PADDING;
    expect(scene.bounds).toEqual({ x: 400 - pad, y: 100 - pad, width: 200 + 2 * pad, height: 400 + 2 * pad });
    expect(rotatedSize(100, 0, 45).width).toBeCloseTo(70.711, 3);
  });

  it('draws images first and lines after pins', () => {
    const scene = build({
      images: [{ id: 'i', src: 'data:x', x: 0, y: 0, width: 10, height: 10, rotation: 0 }],
      pins: [pin()],
      lines: [{ id: 'l', points: [0, 0, 10, 0], color: '#000', thickness: 1 }],
    });
    const kinds = scene.primitives.map(p => p.kind);
    expect(kinds[0]).toBe('image');
    expect(kinds[kinds.length - 1]).toBe('polyline');
  });

  describe('legend', () => {
    const legendItems = [
      { id: '1', text: 'POWER', color: '#dc2626' },
      { id: '2', text: 'GROUND', color: '#000000' },
      { id: '3', text: 'USART', color: '#1d4ed8' },
    ];
    const legendTexts = (scene: ReturnType<typeof build>) =>
      (ofKind(scene, 'text') as SceneText[]).filter(t => t.fontWeight === 400).map(t => t.text);

    it('is left out unless requested', () => {
      const scene = build({ pins: [pin()], legendItems });
      expect(legendTexts(scene)).toEqual([]);
    });

    it('shows all rows in "all" mode, placed left of the content', () => {
      const scene = build({ pins: [pin()], legendItems, includeLegend: true });
      expect(legendTexts(scene)).toEqual(['TABLE', 'POWER', 'GROUND', 'USART', 'Standard Pin', 'PWM Pin']);
      const box = (ofKind(scene, 'rect') as SceneRect[]).find(r => r.fill === '#e6e6e6')!;
      expect(box.x + box.width).toBeLessThan(100 - EXPORT_PADDING);
      expect(scene.bounds.x).toBeLessThan(box.x);
      expect(scene.bounds.y + scene.bounds.height).toBeGreaterThanOrEqual(box.y + box.height);
    });

    it('shows only used colours in "used" mode', () => {
      const scene = build({ pins: [pin()], legendItems, includeLegend: true, legendMode: 'used' });
      expect(legendTexts(scene)).toEqual(['TABLE', 'USART', 'Standard Pin', 'PWM Pin']);
    });

    it('dims unused rows in "dimUnused" mode', () => {
      const scene = build({ pins: [pin()], legendItems, includeLegend: true, legendMode: 'dimUnused' });
      const rows = (ofKind(scene, 'rect') as SceneRect[]).filter(r => legendItems.some(i => i.color === r.fill) && r.radius === 0);
      expect(rows.map(r => r.opacity)).toEqual([LEGEND_DIM_OPACITY, LEGEND_DIM_OPACITY, undefined]);
      const texts = (ofKind(scene, 'text') as SceneText[]).filter(t => ['POWER', 'USART'].includes(t.text));
      expect(texts.map(t => t.opacity)).toEqual([LEGEND_DIM_OPACITY, undefined]);
    });
  });
});
