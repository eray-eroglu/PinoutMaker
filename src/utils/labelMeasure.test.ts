import { describe, it, expect, vi } from 'vitest';

describe('measureLabelText', () => {
  it('measures each distinct text once', async () => {
    const measureText = vi.fn((text: string) => ({ width: text.length * 7 }) as TextMetrics);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ measureText, font: '' } as never);
    const { measureLabelText } = await import('./labelMeasure');

    const width = measureLabelText('PA0');
    for (let i = 0; i < 10; i++) measureLabelText('PA0');
    measureLabelText('ADC0');

    expect(measureText).toHaveBeenCalledTimes(2);
    expect(measureLabelText('PA0')).toBe(width);
    expect(width).toBeGreaterThan(21);
  });
});
