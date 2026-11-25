import type { PinData } from '../types';
import { DEFAULT_PIN_COLOR, getSmartColor } from './pinUtils';
import { labelUnitWidth } from './pinLayout';
import type { MeasureLabel } from './pinLayout';
import { measureLabelText } from './labelMeasure';
import type { Language } from '../i18n';

/**
 * Pin tables
 * ----------
 * Text pasted from a datasheet, Excel / Google Sheets (tab-separated) or a CSV file. Each line is
 * one pin: the first cell is the pin name, the remaining non-empty cells are its function labels,
 * nearest the pin first.
 */

export type PinTableDelimiter = '\t' | ';' | ',';

/** Counts each candidate delimiter outside quoted cells. */
const countDelimiters = (text: string): Record<PinTableDelimiter, number> => {
  const counts: Record<PinTableDelimiter, number> = { '\t': 0, ';': 0, ',': 0 };
  let inQuotes = false;
  let atCellStart = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') i++; // escaped quote
      else if (ch === '"') inQuotes = false;
      continue;
    }
    // Only a quote that opens a cell starts a quoted cell; a stray one (5" display) is plain text
    if (ch === '"' && atCellStart) {
      inQuotes = true;
      atCellStart = false;
      continue;
    }
    if (ch === '\t' || ch === ';' || ch === ',') {
      counts[ch]++;
      atCellStart = true;
    } else if (ch === '\n') {
      atCellStart = true;
    } else if (ch !== ' ') {
      atCellStart = false;
    }
  }
  return counts;
};

/**
 * Picks the delimiter of a pasted table, or null when the text has none (one cell per line, or
 * cells separated by spaces only). Tabs win because spreadsheet pastes always use them and cell
 * text may contain commas; otherwise the more frequent of ';' and ','.
 */
export const detectDelimiter = (text: string): PinTableDelimiter | null => {
  const counts = countDelimiters(normalizeNewlines(text));
  if (counts['\t'] > 0) return '\t';
  if (counts[';'] === 0 && counts[','] === 0) return null;
  return counts[';'] >= counts[','] ? ';' : ',';
};

const BYTE_ORDER_MARK = 0xfeff;

/** Drops a byte order mark (CSV files saved by Excel) and turns CRLF / CR into LF. */
const normalizeNewlines = (text: string) =>
  (text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text).replace(/\r\n?/g, '\n');

/**
 * Splits delimited text into rows of cells. A cell that starts with a quote may contain the
 * delimiter, newlines and doubled quotes ("" → "), as Excel and RFC 4180 CSV write them.
 */
const splitDelimited = (text: string, delimiter: PinTableDelimiter): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let atCellStart = true;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else inQuotes = false;
    } else if (ch === '"' && atCellStart && cell.trim() === '') {
      inQuotes = true;
      cell = '';
      atCellStart = false;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
      atCellStart = true;
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      atCellStart = true;
    } else {
      cell += ch;
      if (ch !== ' ') atCellStart = false;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
};

/**
 * Parses a pasted pin table into rows of trimmed cells. Tab-, semicolon- and comma-separated text
 * is detected automatically (with quoted CSV cells); text without any of them is split on
 * whitespace, which handles tables copied out of a PDF. Empty lines are skipped.
 */
export const parsePinTable = (text: string): string[][] => {
  const normalized = normalizeNewlines(text);
  const delimiter = detectDelimiter(normalized);
  const rows = delimiter ? splitDelimited(normalized, delimiter) : normalized.split('\n').map(line => line.split(/\s+/));
  return rows
    .map(row => row.map(cell => cell.trim()))
    .filter(row => row.some(cell => cell !== ''));
};

export interface PinTableEntry {
  name: string;
  functions: string[];
}

/** First cell = pin name, the other non-empty cells = function labels in order. */
export const rowToEntry = (row: string[]): PinTableEntry => ({
  name: row[0] ?? '',
  functions: row.slice(1).filter(cell => cell !== ''),
});

export interface PinTableAssignment {
  pin: PinData;
  /** Null when the table has fewer rows than the header has pins; the pin stays unchanged. */
  entry: PinTableEntry | null;
}

/** Pad position of a header pin (0-based). A pin's place in the header comes from headerIndex. */
const padIndex = (pin: PinData, fallback: number) => pin.headerIndex ?? fallback;

/** Number of pads of the header: one past its highest headerIndex (removed pins leave gaps). */
const padCount = (headerPins: PinData[]) =>
  headerPins.reduce((max, pin, i) => Math.max(max, padIndex(pin, i) + 1), 0);

/** Which table row (0-based) belongs to pad `index`; `reverse` fills from the last pad. */
const rowForPad = (index: number, pads: number, reverse: boolean) => (reverse ? pads - 1 - index : index);

/**
 * Pairs table rows with a header's pins by pad position (headerIndex), so row i always lands on
 * pad i even when pins were removed from the header. `reverse` fills the header from its last
 * pad, for datasheets that list a connector bottom-to-top. Rows of removed pads and rows beyond
 * the pad count are ignored.
 */
export const assignRowsToHeader = (headerPins: PinData[], rows: string[][], reverse: boolean): PinTableAssignment[] => {
  const pads = padCount(headerPins);
  return headerPins.map((pin, i) => {
    const row = rows[rowForPad(padIndex(pin, i), pads, reverse)];
    return { pin, entry: row ? rowToEntry(row) : null };
  });
};

/** Whole numbers from..to, inclusive. */
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** 1, 2, 3, 5 -> "1–3, 5" */
const formatRanges = (numbers: number[]) => {
  const parts: string[] = [];
  for (let i = 0; i < numbers.length; i++) {
    let j = i;
    while (j + 1 < numbers.length && numbers[j + 1] === numbers[j] + 1) j++;
    parts.push(j > i ? `${numbers[i]}–${numbers[j]}` : String(numbers[i]));
    i = j;
  }
  return parts.join(', ');
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The sentences of pinTableWarnings, per language. Numbers are 1-based and already formatted. */
interface WarningTexts {
  /** pads: "3" or "2–3, 6"; rows: the ignored rows in the same form, or null when none are. */
  missingPads: (padCount: number, pads: string, rowCount: number, rows: string | null) => string;
  extraRows: (rowCount: number, pads: number, ignored: number, ignoredRows: string) => string;
  unchanged: (rowCount: number, pinCount: number, unchanged: number) => string;
}

/** 1-based row numbers -> "row 3 is ignored" / "rows 3–4 are ignored" */
const rowsIgnored = (count: number, rows: string) =>
  `${count === 1 ? 'row' : 'rows'} ${rows} ${count === 1 ? 'is' : 'are'} ignored`;

const WARNING_TEXTS: Record<Language, WarningTexts> = {
  en: {
    missingPads: (padCount, pads, rowCount, rows) =>
      `${padCount === 1 ? `Pad ${pads} has` : `Pads ${pads} have`} no pin (removed from the header)${rows ? `; ${rowsIgnored(rowCount, rows)}` : ''}.`,
    extraRows: (rowCount, pads, ignored, ignoredRows) =>
      `The table has ${plural(rowCount, 'row')} but the header has ${plural(pads, 'pad')}; ${rowsIgnored(ignored, ignoredRows)}.`,
    unchanged: (rowCount, pinCount, unchanged) =>
      `The table has ${plural(rowCount, 'row')} for ${plural(pinCount, 'pin')}; ${plural(unchanged, 'pin')} ${unchanged === 1 ? 'stays' : 'stay'} unchanged.`,
  },
  // Turkish has no plural after a number ("3 satır") and the number comes after the noun
  // ("satır 3") to avoid case suffixes that depend on how the number is pronounced.
  tr: {
    missingPads: (_padCount, pads, _rowCount, rows) =>
      `Pad ${pads}: pin yok (header'dan kaldırılmış)${rows ? `; satır ${rows} yok sayılıyor` : ''}.`,
    extraRows: (rowCount, pads, _ignored, ignoredRows) =>
      `Tabloda ${rowCount} satır var ama header'da ${pads} pad var; satır ${ignoredRows} yok sayılıyor.`,
    unchanged: (rowCount, pinCount, unchanged) =>
      `Tabloda ${pinCount} pin için ${rowCount} satır var; ${unchanged} pin değişmeden kalıyor.`,
  },
};

/**
 * Explains, for the dialog, where the table and the header don't line up: pads without a pin
 * (and the rows that are ignored because of them), extra rows, and pins left unchanged.
 * Numbers shown to the user are 1-based.
 */
export const pinTableWarnings = (
  headerPins: PinData[],
  rowCount: number,
  reverse: boolean,
  language: Language = 'en',
): string[] => {
  if (rowCount === 0 || headerPins.length === 0) return [];
  const texts = WARNING_TEXTS[language];
  const pads = padCount(headerPins);
  const present = new Set(headerPins.map(padIndex));
  const warnings: string[] = [];

  const missingPads: number[] = [];
  for (let pad = 0; pad < pads; pad++) if (!present.has(pad)) missingPads.push(pad);
  if (missingPads.length > 0) {
    const skippedRows = missingPads
      .map(pad => rowForPad(pad, pads, reverse))
      .filter(row => row < rowCount)
      .sort((a, b) => a - b);
    warnings.push(texts.missingPads(
      missingPads.length,
      formatRanges(missingPads.map(p => p + 1)),
      skippedRows.length,
      skippedRows.length > 0 ? formatRanges(skippedRows.map(r => r + 1)) : null,
    ));
  }
  if (rowCount > pads) {
    warnings.push(texts.extraRows(rowCount, pads, rowCount - pads, formatRanges(range(pads + 1, rowCount))));
  }
  const unchanged = headerPins.filter((pin, i) => rowForPad(padIndex(pin, i), pads, reverse) >= rowCount).length;
  if (unchanged > 0) {
    warnings.push(texts.unchanged(rowCount, headerPins.length, unchanged));
  }
  return warnings;
};

export interface ApplyPinTableOptions {
  /** World size of one label unit, to keep left-side labels attached to their anchor edge. */
  labelScale: number;
  measure?: MeasureLabel;
  newId?: () => string;
}

/**
 * Applies one table row to a pin: name, colour and a fresh set of function labels. The anchor and
 * the label position stay; for a label left of its anchor the edge next to the anchor is kept (not
 * the stored left edge), so a longer name grows outward instead of into the anchor.
 *
 * Colour: the smart colour of the new name; with no rule matching, the current colour is kept
 * unless it was just the automatic colour of the old name (it would now be misleading, e.g. the
 * "physical pin" teal of a placeholder P3 on a pin renamed NC).
 */
export const applyEntryToPin = (
  pin: PinData,
  entry: PinTableEntry,
  { labelScale, measure = measureLabelText, newId = () => crypto.randomUUID() }: ApplyPinTableOptions,
): PinData => {
  const oldWidth = labelUnitWidth(pin.text, measure) * labelScale;
  const newWidth = labelUnitWidth(entry.name, measure) * labelScale;
  const isLeftOfAnchor = pin.x + oldWidth / 2 < pin.targetX;
  const wasAutoColor = pin.color === getSmartColor(pin.text);

  return {
    ...pin,
    x: isLeftOfAnchor ? pin.x + oldWidth - newWidth : pin.x,
    text: entry.name,
    color: getSmartColor(entry.name) ?? (wasAutoColor ? DEFAULT_PIN_COLOR : pin.color),
    functions: entry.functions.map(text => ({ id: newId(), text, color: getSmartColor(text) ?? DEFAULT_PIN_COLOR })),
  };
};

/** Returns all pins with the header's pins filled from the table; other pins are untouched. */
export const applyPinTable = (
  pins: PinData[],
  headerPins: PinData[],
  rows: string[][],
  reverse: boolean,
  options: ApplyPinTableOptions,
): PinData[] => {
  const updates = new Map<string, PinData>();
  for (const { pin, entry } of assignRowsToHeader(headerPins, rows, reverse)) {
    if (entry) updates.set(pin.id, applyEntryToPin(pin, entry, options));
  }
  return pins.map(p => updates.get(p.id) ?? p);
};
