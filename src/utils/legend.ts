import type { LegendItem, LegendMode, PinData } from '../types';

export interface LegendRow {
  item: LegendItem;
  /** True when at least one label uses this colour. */
  used: boolean;
  /** How many labels use this colour. */
  count: number;
}

/** Lower-cases and expands #abc to #aabbcc so equal colours always compare equal. */
export const normalizeColor = (color: string): string => {
  const c = color.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : c;
};

/** Colours of every label on a pin: its main label plus any per-function labels (if the pin has them). */
const pinLabelColors = (pin: PinData): string[] => {
  const colors: unknown[] = [pin.color];
  // `functions` is added by a separate feature; read it defensively so this works with or without it.
  const functions = (pin as { functions?: unknown }).functions;
  if (Array.isArray(functions)) {
    for (const fn of functions) colors.push((fn as { color?: unknown } | null)?.color);
  }
  return colors.filter((c): c is string => typeof c === 'string');
};

/** Number of labels per normalised colour. */
export const countColorUsage = (pins: PinData[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const pin of pins) {
    for (const color of pinLabelColors(pin)) {
      const key = normalizeColor(color);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
};

/** Rows to draw, in original order. Shared by the canvas legend and the PDF so they always match. */
export const getLegendRows = (items: LegendItem[], pins: PinData[], mode: LegendMode): LegendRow[] => {
  const counts = countColorUsage(pins);
  const rows = items.map((item) => {
    const count = counts.get(normalizeColor(item.color)) ?? 0;
    return { item, used: count > 0, count };
  });
  return mode === 'used' ? rows.filter((r) => r.used) : rows;
};
