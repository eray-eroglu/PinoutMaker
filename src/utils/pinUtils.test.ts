import { describe, it, expect } from 'vitest';
import type { PinData } from '../types';
import {
  DEFAULT_PIN_COLOR, addPinFunction, clonePin, getColorForRename, getSmartColor, migrateLegacyPin, movePinFunction,
  nudgeLabel, removePinFunction, renamePinFunction, scaleLabelsAroundAnchors, updatePinFunction,
} from './pinUtils';

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

describe('function labels', () => {
  const withFns: PinData = {
    ...basePin,
    functions: [
      { id: 'a', text: 'ADC0', color: '#16a34a' },
      { id: 'b', text: 'CTS2', color: '#1d4ed8' },
      { id: 'c', text: 'T2C1E', color: '#e11d48' },
    ],
  };
  const texts = (p: PinData) => p.functions?.map(f => f.text);

  it('adds a function with the default color, or the smart color of its text', () => {
    expect(addPinFunction(basePin).functions).toEqual([{ id: expect.any(String), text: '', color: DEFAULT_PIN_COLOR }]);
    expect(addPinFunction(basePin, 'SDA').functions?.[0].color).toBe('#0ea5e9');
  });

  it('removes and reorders without mutating the original pin', () => {
    expect(texts(removePinFunction(withFns, 1))).toEqual(['ADC0', 'T2C1E']);
    expect(texts(movePinFunction(withFns, 0, 1))).toEqual(['CTS2', 'ADC0', 'T2C1E']);
    expect(texts(movePinFunction(withFns, 2, -1))).toEqual(['ADC0', 'T2C1E', 'CTS2']);
    expect(movePinFunction(withFns, 0, -1)).toBe(withFns); // already first
    expect(texts(withFns)).toEqual(['ADC0', 'CTS2', 'T2C1E']);
  });

  it('applies the smart color on rename only while the function color is automatic', () => {
    const fresh = addPinFunction(basePin);
    expect(renamePinFunction(fresh, 0, 'GND').functions?.[0]).toMatchObject({ text: 'GND', color: '#000000' });
    // ADC0 is green automatically; renaming to SDA follows the name
    expect(renamePinFunction(withFns, 0, 'SDA').functions?.[0].color).toBe('#0ea5e9');
    const custom = updatePinFunction(withFns, 0, { color: '#123456' });
    expect(renamePinFunction(custom, 0, 'SDA').functions?.[0].color).toBe('#123456');
  });
});

describe('clonePin', () => {
  it('offsets the copy and gives it and its functions new ids', () => {
    const original: PinData = {
      ...basePin, x: 10, y: 20,
      functions: [{ id: 'f1', text: 'ADC0', color: '#16a34a' }, { id: 'f2', text: 'TX', color: '#1d4ed8' }],
    };
    const copy = clonePin(original, 20, 20);
    expect(copy).toMatchObject({ x: 30, y: 40, targetX: 120, targetY: 120, text: original.text });
    expect(copy.id).not.toBe(original.id);
    expect(copy.functions?.map(f => f.text)).toEqual(['ADC0', 'TX']);
    copy.functions?.forEach((fn, i) => expect(fn.id).not.toBe(original.functions![i].id));
    expect(new Set(copy.functions?.map(f => f.id)).size).toBe(2);
  });

  it('does not add a functions field to pins without one', () => {
    expect('functions' in clonePin(basePin, 0, 0)).toBe(false);
  });
});
