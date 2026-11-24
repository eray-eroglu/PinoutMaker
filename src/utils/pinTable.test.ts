import { describe, it, expect } from 'vitest';
import { applyEntryToPin, applyPinTable, assignRowsToHeader, detectDelimiter, parsePinTable, rowToEntry } from './pinTable';
import { DEFAULT_PIN_COLOR } from './pinUtils';
import type { PinData } from '../types';

describe('parsePinTable', () => {
  it('parses a tab-separated spreadsheet paste', () => {
    expect(parsePinTable('PA0\tADC0\tCTS2\nPA1\tADC1\n')).toEqual([['PA0', 'ADC0', 'CTS2'], ['PA1', 'ADC1']]);
  });

  it('handles CRLF, trims cells and skips empty lines', () => {
    expect(parsePinTable('\r\n  GND ; \r\n\r\n VCC;3V3 \r\n   \r\n')).toEqual([['GND', ''], ['VCC', '3V3']]);
  });

  it('parses quoted CSV with commas, quotes and newlines inside cells', () => {
    const csv = 'PB6,"SCL1, TX1","say ""hi"""\r\n"PB7","multi\nline"';
    expect(parsePinTable(csv)).toEqual([['PB6', 'SCL1, TX1', 'say "hi"'], ['PB7', 'multi\nline']]);
  });

  it('splits on whitespace when there is no delimiter (PDF copy)', () => {
    expect(parsePinTable('PA9  TX1 T1C2\nGND')).toEqual([['PA9', 'TX1', 'T1C2'], ['GND']]);
  });

  it('keeps a stray quote inside a cell as text', () => {
    expect(parsePinTable('LCD\t5" panel\nX\tY')).toEqual([['LCD', '5" panel'], ['X', 'Y']]);
  });

  it('strips a byte order mark', () => {
    expect(parsePinTable(String.fromCharCode(0xfeff) + 'A,B')).toEqual([['A', 'B']]);
  });
});

describe('detectDelimiter', () => {
  it('prefers tabs, then the more frequent of ; and ,', () => {
    expect(detectDelimiter('a,b\tc')).toBe('\t');
    expect(detectDelimiter('a;b;c\nd,e')).toBe(';');
    expect(detectDelimiter('a,b,c\nd;e')).toBe(',');
    expect(detectDelimiter('a b c')).toBeNull();
  });

  it('ignores delimiters inside quoted cells', () => {
    expect(detectDelimiter('"a,b,c,d";x;y')).toBe(';');
    expect(detectDelimiter('"a ""q"", b, c";x;y')).toBe(';');
  });
});

describe('rowToEntry', () => {
  it('takes the first cell as name and the non-empty rest as functions', () => {
    expect(rowToEntry(['PA0', '', 'ADC0', 'CTS2'])).toEqual({ name: 'PA0', functions: ['ADC0', 'CTS2'] });
  });
});

const headerPin = (i: number, over: Partial<PinData> = {}): PinData => ({
  id: `p${i}`, x: 50, y: i * 30 - 12, targetX: 0, targetY: i * 30, text: `P${i + 1}`, color: '#0d9488', isPwm: false,
  headerId: 'h', headerIndex: i, ...over,
});

describe('assignRowsToHeader', () => {
  const pins = [0, 1, 2].map(i => headerPin(i));

  it('fills in header order and leaves missing rows empty', () => {
    const a = assignRowsToHeader(pins, [['A'], ['B']], false);
    expect(a.map(x => x.entry?.name ?? null)).toEqual(['A', 'B', null]);
  });

  it('reverse fills from the last pin and ignores extra rows', () => {
    const a = assignRowsToHeader(pins, [['A'], ['B'], ['C'], ['D']], true);
    expect(a.map(x => x.entry?.name)).toEqual(['C', 'B', 'A']);
  });
});

describe('applyEntryToPin', () => {
  let n = 0;
  const opts = { labelScale: 1, measure: () => 0, newId: () => `id${n++}` };

  it('sets name, smart colours and fresh functions; keeps anchor and label', () => {
    const pin = headerPin(0, { functions: [{ id: 'old', text: 'X', color: '#123456' }] });
    const out = applyEntryToPin(pin, { name: 'PB7', functions: ['SDA1', 'TX1', 'FOO'] }, opts);
    expect(out).toMatchObject({ text: 'PB7', color: '#0d9488', x: 50, y: -12, targetX: 0, targetY: 0, headerId: 'h', headerIndex: 0 });
    expect(out.functions!.map(f => [f.text, f.color])).toEqual([
      ['SDA1', '#0ea5e9'], ['TX1', '#1d4ed8'], ['FOO', DEFAULT_PIN_COLOR],
    ]);
    expect(out.functions!.some(f => f.id === 'old')).toBe(false);
  });

  it('keeps a hand-picked colour when no rule matches', () => {
    const out = applyEntryToPin(headerPin(0, { color: '#ea580c' }), { name: 'NC', functions: [] }, opts);
    expect(out.color).toBe('#ea580c');
  });

  it('drops a colour that only came from the old name', () => {
    const out = applyEntryToPin(headerPin(0), { name: 'NC', functions: [] }, opts); // P1 teal is automatic
    expect(out.color).toBe(DEFAULT_PIN_COLOR);
  });

  it('smart colour wins over a hand-picked one', () => {
    expect(applyEntryToPin(headerPin(0, { color: '#ea580c' }), { name: 'GND', functions: [] }, opts).color).toBe('#000000');
  });

  it('keeps the anchor-side edge of a label left of its anchor', () => {
    const width = (t: string) => (t === 'LONGNAME' ? 100 : 0);
    const pin = headerPin(0, { x: -110, targetX: 0 }); // 60 wide, right edge at -50
    const out = applyEntryToPin(pin, { name: 'LONGNAME', functions: [] }, { ...opts, labelScale: 2, measure: width });
    expect(out.x + 100 * 2).toBe(pin.x + 60 * 2);
  });
});

describe('applyPinTable', () => {
  it('changes only the header pins that got a row', () => {
    const other: PinData = { ...headerPin(9), id: 'other', headerId: undefined, headerIndex: undefined };
    const pins = [headerPin(0), other, headerPin(1), headerPin(2)];
    const header = [pins[0], pins[2], pins[3]];
    const out = applyPinTable(pins, header, [['GND'], ['VCC', 'VDD']], false, { labelScale: 1, measure: () => 0 });
    expect(out.map(p => p.text)).toEqual(['GND', 'P10', 'VCC', 'P3']);
    expect(out[1]).toBe(other);
    expect(out[3]).toBe(pins[3]);
  });
});
