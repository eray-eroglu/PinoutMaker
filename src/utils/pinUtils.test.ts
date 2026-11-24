import { describe, it, expect } from 'vitest';
import type { PinData } from '../types';
import { DEFAULT_PIN_COLOR, getColorForRename, getSmartColor, migrateLegacyPin, nudgeLabel, scaleLabelsAroundAnchors } from './pinUtils';

const basePin: PinData = {
  id: 'p', x: 0, y: 0, targetX: 100, targetY: 100, text: 'New Pin', color: DEFAULT_PIN_COLOR, isPwm: false,
};

describe('nudgeLabel', () => {
  it('moves the label in world units and leaves the anchor', () => {
    const moved = nudgeLabel({ ...basePin, x: 150, y: 90 }, 10, -5);
    expect(moved).toMatchObject({ x: 160, y: 85, targetX: 100, targetY: 100 });
  });
});

describe('scaleLabelsAroundAnchors', () => {
  it('scales each label offset from its own anchor', () => {
    const [p] = scaleLabelsAroundAnchors([{ ...basePin, x: 150, y: 90 }], 2);
    expect(p).toMatchObject({ x: 200, y: 80, targetX: 100, targetY: 100 });
  });
});

describe('migrateLegacyPin', () => {
  it('freezes a screen-pixel offset at the zoom the file was saved with', () => {
    // At zoom 0.5 an offset of 50 screen px was 100 world px
    const pin = migrateLegacyPin({ ...basePin, x: 999, y: 999, labelDx: 50, labelDy: -10 }, 0.5);
    expect(pin).toMatchObject({ x: 200, y: 80 });
    expect(pin.labelDx).toBeUndefined();
    expect(pin.labelDy).toBeUndefined();
  });

  it('keeps x/y of very old pins that never had an offset', () => {
    expect(migrateLegacyPin({ ...basePin, x: 7, y: 8 }, 0.5)).toMatchObject({ x: 7, y: 8 });
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
