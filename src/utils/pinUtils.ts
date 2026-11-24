import type { PinData } from '../types';

export const DEFAULT_PIN_COLOR = '#ef4444'; // red-500

/**
 * World-space top-left position of a pin's label.
 *
 * Labels are stored as a screen-pixel offset from their anchor (labelDx/labelDy)
 * so they keep a constant on-screen distance at every zoom level. Older pins only
 * have the legacy world-space x/y, which is used as a fallback.
 *
 * Everything that needs the label position (rendering, snapping, nudging, export)
 * must go through this function; reading pin.x/pin.y directly is stale after zooming.
 */
export const getLabelPosition = (pin: PinData, scale: number): { x: number; y: number } => {
  if (pin.labelDx !== undefined && pin.labelDy !== undefined) {
    return {
      x: pin.targetX + pin.labelDx / scale,
      y: pin.targetY + pin.labelDy / scale,
    };
  }
  return { x: pin.x, y: pin.y };
};

/**
 * Returns a copy of the pin with its label shifted by the given amount of screen pixels.
 * Keeps the legacy x/y fields in sync with the new offset.
 */
export const nudgeLabel = (pin: PinData, dxScreen: number, dyScreen: number, scale: number): PinData => {
  const current = getLabelPosition(pin, scale);
  const labelDx = (current.x - pin.targetX) * scale + dxScreen;
  const labelDy = (current.y - pin.targetY) * scale + dyScreen;
  return {
    ...pin,
    labelDx,
    labelDy,
    x: pin.targetX + labelDx / scale,
    y: pin.targetY + labelDy / scale,
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
