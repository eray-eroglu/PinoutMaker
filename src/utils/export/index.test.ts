import { describe, expect, it } from 'vitest';
import { pngDownscaleNote } from '.';

describe('pngDownscaleNote', () => {
  it('is English by default', () => {
    expect(pngDownscaleNote(4, 2.456, 8000, 6000)).toBe(
      'The diagram is too large for ×4; it was exported at ×2.45 (8000×6000 px).',
    );
  });

  it('can be Turkish', () => {
    expect(pngDownscaleNote(4, 2.456, 8000, 6000, 'tr')).toBe(
      'Diyagram ×4 için çok büyük; ×2.45 ölçeğinde dışa aktarıldı (8000×6000 px).',
    );
  });
});
