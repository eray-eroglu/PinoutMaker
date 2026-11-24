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

/** Suggests a label color from a pin name (GND → black, SDA → I2C blue, ...). */
export const getSmartColor = (text: string): string | null => {
  const t = text.toUpperCase().trim();
  if (!t) return null;

  if (t === 'GND') return '#000000'; // GROUND
  if (['VCC', '5V', '3V3', 'VIN', 'VDD', 'VSS'].includes(t)) return '#dc2626'; // POWER
  if (['SDA', 'SCL', 'I2C'].includes(t)) return '#0ea5e9'; // I2C
  if (t.startsWith('ADC') || t.startsWith('AIN') || t.startsWith('DAC')) return '#16a34a'; // ANALOG
  if (['RX', 'TX', 'CTS', 'RTS'].includes(t) || t.startsWith('UART') || t.startsWith('USART')) return '#1d4ed8'; // USART
  if (['CS', 'SCK', 'MOSI', 'MISO', 'NSS', 'CLK'].includes(t) || t.startsWith('SPI')) return '#9333ea'; // SPI
  if (t.startsWith('CAN')) return '#db2777'; // CAN BUS
  if (t.startsWith('TIM') || /^CH\d/.test(t)) return '#e11d48'; // TIMER & CHANNEL
  if (t.startsWith('USB') || ['D+', 'D-'].includes(t)) return '#65a30d'; // USB
  if (['EN', 'BOOT', 'RST', 'RESET'].includes(t)) return '#ca8a04'; // CONTROL
  // Port pins: P1, P12, PA0, PB12 ... and the bare port names
  if (['GPIO', 'PA', 'PB', 'PC'].includes(t) || /^P[A-K]?\d{1,2}$/.test(t)) return '#0d9488'; // PHYSICAL PIN

  return null;
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
