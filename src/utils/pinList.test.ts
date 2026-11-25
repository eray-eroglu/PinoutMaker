import { describe, it, expect } from 'vitest';
import type { PinData } from '../types';
import { buildPinListCsv, escapeCsvCell, guardFormula, pinListFileName } from './pinList';

const pin = (id: string, text: string, extra: Partial<PinData> = {}): PinData => ({
  id, x: 0, y: 0, targetX: 0, targetY: 0, text, color: '#000', isPwm: false, ...extra,
});
const fn = (text: string) => ({ id: text, text, color: '#fff' });

/** Rows of the CSV without the BOM, split on CRLF (the final empty line dropped). */
const rowsOf = (csv: string) => csv.slice(1).split('\r\n').slice(0, -1);

describe('buildPinListCsv', () => {
  it('starts with a UTF-8 BOM and ends every line with CRLF', () => {
    const csv = buildPinListCsv([pin('a', 'GND')], 'en');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.slice(1).split('\n').every(line => line === '' || line.endsWith('\r'))).toBe(true);
  });

  it('lists header pins in pad order, header after header, then stand-alone pins in project order', () => {
    const pins = [
      pin('s1', 'LED'),
      pin('b1', 'B2', { headerId: 'hB', headerIndex: 1 }),
      pin('a2', 'A2', { headerId: 'hA', headerIndex: 1 }),
      pin('a1', 'A1', { headerId: 'hA', headerIndex: 0, isPwm: true, functions: [fn('ADC0'), fn('SDA')] }),
      pin('s2', 'BTN'),
      pin('b0', 'B1', { headerId: 'hB', headerIndex: 0 }),
    ];
    // Headers come in the order their first pin appears in the project: hB (b1) before hA (a2)
    expect(rowsOf(buildPinListCsv(pins, 'en'))).toEqual([
      'Header,Pad,Pin,PWM,Function 1,Function 2',
      'B1 – B2 (2 pins),1,B1,no,,',
      'B1 – B2 (2 pins),2,B2,no,,',
      'A1 – A2 (2 pins),1,A1,yes,ADC0,SDA',
      'A1 – A2 (2 pins),2,A2,no,,',
      ',,LED,no,,',
      ',,BTN,no,,',
    ]);
  });

  it('has only the fixed columns when no pin has functions', () => {
    expect(rowsOf(buildPinListCsv([pin('a', 'VCC')], 'en'))).toEqual(['Header,Pad,Pin,PWM', ',,VCC,no']);
  });

  it('uses Turkish titles, yes/no and ; as delimiter in Turkish', () => {
    const pins = [
      pin('a', 'D1', { headerId: 'h', headerIndex: 0, isPwm: true, functions: [fn('TX')] }),
      pin('b', 'Işık, ön'),
    ];
    expect(rowsOf(buildPinListCsv(pins, 'tr'))).toEqual([
      'Header;Pad;Pin;PWM;Fonksiyon 1',
      'D1 (1 pin);1;D1;evet;TX',
      ';;Işık, ön;hayır;',
    ]);
  });

  it('quotes cells with the delimiter, quotes or line breaks', () => {
    const pins = [pin('a', 'A,B', { functions: [fn('5" LCD'), fn('two\nlines')] })];
    expect(buildPinListCsv(pins, 'en')).toContain(',,"A,B",no,"5"" LCD","two\nlines"\r\n');
    // The comma is not special with ; as delimiter
    expect(buildPinListCsv(pins, 'tr')).toContain(';;A,B;hayır;"5"" LCD";"two\nlines"\r\n');
  });

  it('guards cells that would run as formulas', () => {
    const pins = [pin('a', '=1+1', { functions: [fn('@SUM'), fn('-RESET'), fn('+5V'), fn('-12V'), fn('-')] })];
    expect(rowsOf(buildPinListCsv(pins, 'en'))[1]).toBe(",,'=1+1,no,'@SUM,'-RESET,+5V,-12V,-");
  });
});

describe('guardFormula', () => {
  it('prefixes = and @ always, + and - only before a non-digit', () => {
    expect(guardFormula('=A1')).toBe("'=A1");
    expect(guardFormula('@x')).toBe("'@x");
    expect(guardFormula('+cmd')).toBe("'+cmd");
    expect(guardFormula('-cmd')).toBe("'-cmd");
    expect(guardFormula('+3.3V')).toBe('+3.3V');
    expect(guardFormula('-5V')).toBe('-5V');
    expect(guardFormula('+')).toBe('+');
    expect(guardFormula('GND')).toBe('GND');
    expect(guardFormula('')).toBe('');
  });
});

describe('escapeCsvCell', () => {
  it('follows RFC 4180', () => {
    expect(escapeCsvCell('plain', ',')).toBe('plain');
    expect(escapeCsvCell('a;b', ';')).toBe('"a;b"');
    expect(escapeCsvCell('a;b', ',')).toBe('a;b');
    expect(escapeCsvCell('say "hi"', ',')).toBe('"say ""hi"""');
    expect(escapeCsvCell('a\r\nb', ',')).toBe('"a\r\nb"');
  });
});

describe('pinListFileName', () => {
  it('is a .csv file', () => {
    expect(pinListFileName()).toBe('pinout-pins.csv');
  });
});
