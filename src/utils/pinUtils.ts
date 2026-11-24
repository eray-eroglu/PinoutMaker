import type { PinData, PinFunction } from '../types';

export const DEFAULT_PIN_COLOR = '#ef4444'; // red-500

/**
 * Coordinate model
 * ----------------
 * Everything on the board lives in world coordinates (board-image pixels): pin.x/pin.y is the
 * label's top-left corner, pin.targetX/targetY the anchor. Labels are drawn at the project-wide
 * `labelScale`, so zooming scales the board and its labels together and the layout never shifts.
 */

/** Returns a copy of the pin with its label moved by the given world offset. */
export const nudgeLabel = (pin: PinData, dx: number, dy: number): PinData => ({
  ...pin,
  x: pin.x + dx,
  y: pin.y + dy,
});

/**
 * Resizes all labels by `ratio`: each label's offset from its anchor scales with it,
 * so the layout keeps its proportions instead of labels growing into each other.
 */
export const scaleLabelsAroundAnchors = (pins: PinData[], ratio: number): PinData[] =>
  pins.map(p => ({
    ...p,
    x: p.targetX + (p.x - p.targetX) * ratio,
    y: p.targetY + (p.y - p.targetY) * ratio,
  }));

/**
 * Converts a pin from older files. Those stored the label as a screen-pixel offset from the
 * anchor (labelDx/labelDy) and drew it at 1/zoom, so its world position depended on the zoom.
 * We freeze it the way it looked at the zoom the file was saved with.
 */
export const migrateLegacyPin = (pin: PinData, savedScale: number): PinData => {
  const { labelDx, labelDy, ...rest } = pin;
  if (labelDx === undefined || labelDy === undefined) return rest;
  return {
    ...rest,
    x: pin.targetX + labelDx / savedScale,
    y: pin.targetY + labelDy / savedScale,
  };
};

/**
 * Name patterns → legend colors. Names are matched upper-cased with spaces, '_' and '-' removed,
 * and may carry a peripheral/channel number (SDA1, TXD2, T1C2N, MOSI1, CAN TX ...).
 * Order matters: the first matching rule wins.
 */
const SMART_COLOR_RULES: Array<[RegExp, string]> = [
  [/^(GND|VSS|AGND|DGND|PGND)$/, '#000000'], // GROUND
  [/^(VCC|VDD|VDDA|VIN|VBAT|VBUS|3V3|3\.3V|5V|12V|AVCC)$/, '#dc2626'], // POWER
  [/^(SDA|SCL|SMBA|I2C)\d*$/, '#0ea5e9'], // I2C
  [/^(ADC|AIN|DAC)/, '#16a34a'], // ANALOG
  [/^(U?S?ART|RXD?|TXD?|CTS|RTS|CK)\d*$/, '#1d4ed8'], // USART
  [/^(SPI|MOSI|MISO|SCK|NSS|CS|CLK)\d*$/, '#9333ea'], // SPI
  [/^CAN/, '#db2777'], // CAN BUS
  [/^(TIM\d*|T\d+(C\d+N?E?|BKIN|ETR)|CH\d+N?)$/, '#e11d48'], // TIMER & CHANNEL
  [/^(USB.*|D[+-]|DP|DM)$/, '#65a30d'], // USB
  [/^(EN|BOOT\d*|N?RST|RESET|WAKEUP|WKUP|SWDIO|SWCLK|SWO|SWD|JT[A-Z]+)$/, '#ca8a04'], // CONTROL
  [/^(GPIO|P[A-K]|P[A-K]?\d{1,2})$/, '#0d9488'], // PHYSICAL PIN
];

/** Suggests a label color from a pin or function name (GND → black, SDA1 → I2C blue, ...). */
const matchRule = (name: string): string | null => {
  for (const [pattern, color] of SMART_COLOR_RULES) {
    if (pattern.test(name)) return color;
  }
  return null;
};

export const getSmartColor = (text: string): string | null => {
  const upper = text.toUpperCase().trim();
  if (!upper) return null;
  // Whole name first ("CAN TX" → CANTX, "WAKE UP" → WAKEUP), then each word on its own
  // ("I2C SDA" → I2C, "SPI1_MOSI" → SPI1) so prefixed datasheet names still get a color.
  const joined = upper.replace(/[\s_-]+(?=.)/g, '');
  return matchRule(joined) ?? upper.split(/[\s_/]+/).reduce<string | null>((found, word) => found ?? (word ? matchRule(word) : null), null);
};

/**
 * Color to use after a label's text changes (the pin name or one of its functions). The smart
 * color is only applied while the label still has an automatic color (the default, or the
 * smart color of its previous text); a color the user picked by hand is never overwritten.
 */
export const getColorForRename = (label: { text: string; color: string }, newText: string): string => {
  const previousSmart = getSmartColor(label.text);
  const isAutoColor = label.color === DEFAULT_PIN_COLOR || label.color === previousSmart;
  if (!isAutoColor) return label.color;
  return getSmartColor(newText) ?? (previousSmart !== null ? DEFAULT_PIN_COLOR : label.color);
};

// --- Function labels ---
// All helpers return a new pin; the functions array is never mutated, so history snapshots
// that share it stay intact.

export const addPinFunction = (pin: PinData, text = ''): PinData => ({
  ...pin,
  functions: [...(pin.functions ?? []), { id: crypto.randomUUID(), text, color: getSmartColor(text) ?? DEFAULT_PIN_COLOR }],
});

export const removePinFunction = (pin: PinData, index: number): PinData => ({
  ...pin,
  functions: (pin.functions ?? []).filter((_, i) => i !== index),
});

/** Moves a function label one place towards (-1) or away from (+1) the primary label. */
export const movePinFunction = (pin: PinData, index: number, delta: -1 | 1): PinData => {
  const functions = [...(pin.functions ?? [])];
  const target = index + delta;
  if (index < 0 || index >= functions.length || target < 0 || target >= functions.length) return pin;
  [functions[index], functions[target]] = [functions[target], functions[index]];
  return { ...pin, functions };
};

export const updatePinFunction = (pin: PinData, index: number, changes: Partial<Omit<PinFunction, 'id'>>): PinData => ({
  ...pin,
  functions: (pin.functions ?? []).map((fn, i) => (i === index ? { ...fn, ...changes } : fn)),
});

/** Renames a function label; its color follows the name like the primary label's does. */
export const renamePinFunction = (pin: PinData, index: number, text: string): PinData => {
  const fn = pin.functions?.[index];
  if (!fn) return pin;
  return updatePinFunction(pin, index, { text, color: getColorForRename(fn, text) });
};

/** Copy of a pin (for paste) moved by a world offset, with fresh ids for it and its functions. */
export const clonePin = (pin: PinData, dx: number, dy: number): PinData => ({
  ...pin,
  id: crypto.randomUUID(),
  x: pin.x + dx,
  y: pin.y + dy,
  targetX: pin.targetX + dx,
  targetY: pin.targetY + dy,
  ...(pin.functions ? { functions: pin.functions.map(fn => ({ ...fn, id: crypto.randomUUID() })) } : {}),
});
