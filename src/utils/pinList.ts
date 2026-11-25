import type { PinData } from '../types';
import type { Language } from '../i18n';
import { describeHeader, getHeaders } from './header';

/**
 * Pin list export
 * ---------------
 * The project's pins as a CSV that opens cleanly in Excel / Google Sheets: the reverse of a pasted
 * pin table (pinTable.ts). Header pins come first, header after header in pad order, then the
 * stand-alone pins in project order.
 *
 * Columns: Header, Pad, Pin, PWM, Function 1..N (N = the most functions any pin has).
 *
 * Unlike the diagram exports, the title row and the PWM yes/no follow the interface language, and
 * so does the delimiter: Turkish Excel splits CSV on ';' (',' is its decimal separator), English
 * Excel on ','.
 */

export const PIN_LIST_FILE_NAME = 'pinout-pins.csv';
export const PIN_LIST_MIME_TYPE = 'text/csv;charset=utf-8';

/** Byte order mark: without it Excel reads the file as ANSI and garbles ç, ğ, ş, ı… */
const BOM = '﻿';
const LINE_END = '\r\n';

const TEXTS: Record<Language, { header: string; pad: string; pin: string; pwm: string; fn: (n: number) => string; yes: string; no: string }> = {
  en: { header: 'Header', pad: 'Pad', pin: 'Pin', pwm: 'PWM', fn: n => `Function ${n}`, yes: 'yes', no: 'no' },
  tr: { header: 'Header', pad: 'Pad', pin: 'Pin', pwm: 'PWM', fn: n => `Fonksiyon ${n}`, yes: 'evet', no: 'hayır' },
};

export const pinListDelimiter = (language: Language): ';' | ',' => (language === 'tr' ? ';' : ',');

/** File name for the downloaded pin list. */
export const pinListFileName = (): string => PIN_LIST_FILE_NAME;

/**
 * Guards against CSV formula injection: a cell Excel / Sheets would run as a formula gets a
 * leading apostrophe so it stays text. Cells starting with = or @ are always guarded; + and - only
 * when followed by something other than a digit, so ordinary pin names such as "+5V", "-12V" or
 * "+3.3V" are written unchanged. A lone "+" or "-" is not a formula and is left alone too.
 */
export const guardFormula = (cell: string): string => {
  const first = cell[0];
  if (first === '=' || first === '@') return `'${cell}`;
  if ((first === '+' || first === '-') && cell.length > 1 && !/[0-9]/.test(cell[1])) return `'${cell}`;
  return cell;
};

/** RFC 4180: cells holding the delimiter, a quote or a line break are quoted, quotes doubled. */
export const escapeCsvCell = (cell: string, delimiter: string): string =>
  cell.includes(delimiter) || /["\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;

/** The pin list CSV text (with BOM and CRLF line ends), ready to put in a Blob. */
export const buildPinListCsv = (pins: PinData[], language: Language = 'en'): string => {
  const t = TEXTS[language];
  const delimiter = pinListDelimiter(language);

  const rows: { header: string; pad: string; pin: PinData }[] = [];
  for (const header of getHeaders(pins)) {
    const name = describeHeader(header, language);
    header.pins.forEach((pin, i) => rows.push({ header: name, pad: String((pin.headerIndex ?? i) + 1), pin }));
  }
  for (const pin of pins) {
    if (!pin.headerId) rows.push({ header: '', pad: '', pin });
  }

  const functionCount = Math.max(0, ...pins.map(p => p.functions?.length ?? 0));
  const title = [t.header, t.pad, t.pin, t.pwm, ...Array.from({ length: functionCount }, (_, i) => t.fn(i + 1))];

  const lines = [title, ...rows.map(({ header, pad, pin }) => {
    const functions = Array.from({ length: functionCount }, (_, i) => pin.functions?.[i]?.text ?? '');
    return [header, pad, pin.text, pin.isPwm ? t.yes : t.no, ...functions];
  })].map(cells => cells.map(cell => escapeCsvCell(guardFormula(cell), delimiter)).join(delimiter));

  return BOM + lines.join(LINE_END) + LINE_END;
};
