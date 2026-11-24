import { describe, it, expect } from 'vitest';
import type { PinData } from '../types';
import { DEFAULT_PIN_COLOR, getColorForRename, getLabelPosition, getSmartColor, nudgeLabel } from './pinUtils';

const basePin: PinData = {
  id: 'p', x: 0, y: 0, targetX: 100, targetY: 100, text: 'New Pin', color: DEFAULT_PIN_COLOR, isPwm: false,
};

describe('getLabelPosition', () => {
  it('uses the screen-pixel offset, so the world distance shrinks when zoomed in', () => {
    const pin = { ...basePin, labelDx: 50, labelDy: -10 };
    expect(getLabelPosition(pin, 1)).toEqual({ x: 150, y: 90 });
    expect(getLabelPosition(pin, 2)).toEqual({ x: 125, y: 95 });
  });

  it('falls back to legacy x/y when no offset is stored', () => {
    expect(getLabelPosition({ ...basePin, x: 7, y: 8 }, 3)).toEqual({ x: 7, y: 8 });
  });
});

describe('nudgeLabel', () => {
  it('moves from where the label is drawn, not from the stale legacy x', () => {
    // x is stale (saved at a different zoom); drawn position at scale 2 is 100 + 50/2 = 125
    const pin = { ...basePin, x: 999, labelDx: 50, labelDy: 0 };
    const moved = nudgeLabel(pin, 10, 0, 2);
    expect(moved.labelDx).toBe(60);
    expect(getLabelPosition(moved, 2).x).toBe(130);
    expect(moved.x).toBe(130); // legacy field kept in sync
  });
});

describe('getSmartColor', () => {
  it.each([
    ['GND', '#000000'],
    ['3v3', '#dc2626'],
    ['PA0', '#0d9488'],
    ['P12', '#0d9488'],
    ['SDA', '#0ea5e9'],
    ['CH1', '#e11d48'],
  ])('%s → %s', (text, color) => {
    expect(getSmartColor(text)).toBe(color);
  });

  it.each(['P', 'PWR', 'CHARGE', ''])('does not match %j', text => {
    expect(getSmartColor(text)).toBeNull();
  });
});

describe('getColorForRename', () => {
  it('applies the smart color while the pin has the default color', () => {
    expect(getColorForRename(basePin, 'GND')).toBe('#000000');
  });

  it('follows the name while the color is still the automatic one', () => {
    const gnd = { ...basePin, text: 'GND', color: '#000000' };
    expect(getColorForRename(gnd, 'SDA')).toBe('#0ea5e9');
    expect(getColorForRename(gnd, 'GNDX')).toBe(DEFAULT_PIN_COLOR);
  });

  it('never overrides a color picked by hand', () => {
    const custom = { ...basePin, text: 'foo', color: '#123456' };
    expect(getColorForRename(custom, 'GND')).toBe('#123456');
  });
});
