import type { PinData } from '../types';

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
 * Color to use after the pin name changes. The smart color is only applied while the
 * pin still has an automatic color (the default, or the smart color of its previous
 * name); a color the user picked by hand is never overwritten.
 */
export const getColorForRename = (pin: PinData, newText: string): string => {
  const previousSmart = getSmartColor(pin.text);
  const isAutoColor = pin.color === DEFAULT_PIN_COLOR || pin.color === previousSmart;
  if (!isAutoColor) return pin.color;
  return getSmartColor(newText) ?? (previousSmart !== null ? DEFAULT_PIN_COLOR : pin.color);
};
