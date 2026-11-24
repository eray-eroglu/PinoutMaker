import { describe, it, expect } from 'vitest';
import { getContentBounds } from './exportPdf';
import { LABEL_HEIGHT } from './pinLayout';

describe('getContentBounds', () => {
  it('includes the whole label row, including function labels', () => {
    const bounds = getContentBounds({
      images: [],
      lines: [],
      labelScale: 1,
      gapSize: 10,
      pins: [{
        id: 'p', x: 100, y: 0, targetX: 200, targetY: 12, text: 'PA0', color: '#000', isPwm: false,
        // The anchor is on the right, so the row grows left: 100 → 30 → -40
        functions: [{ id: 'a', text: 'ADC0', color: '#000' }, { id: 'b', text: 'CTS2', color: '#000' }],
      }],
    }, () => 60);
    expect(bounds).toEqual({ minX: -40, minY: 0, maxX: 200, maxY: LABEL_HEIGHT });
  });
});
