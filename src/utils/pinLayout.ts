import type { PinData } from '../types';

/**
 * Label geometry
 * --------------
 * A pin shows a row of labels: the primary label (pin.text, joined to the anchor by the leader
 * line) followed by its extra function labels. Only the primary label's top-left (pin.x/pin.y)
 * is stored; the rest of the row is derived here, so every consumer (canvas, snapping, PDF)
 * agrees on where each label is.
 *
 * Sizes below are label units (multiply by the project's labelScale for world units).
 */

/** Every label is at least this wide, so labels of different pins line up as columns. */
export const MIN_LABEL_WIDTH = 60;
export const LABEL_FONT_SIZE = 12;
export const LABEL_PADDING = 6;
export const LABEL_HEIGHT = LABEL_FONT_SIZE + 2 * LABEL_PADDING;
export const LABEL_FONT_FAMILY = 'Inter, sans-serif';
export const LABEL_FONT_STYLE = '600';

/** Width of a label showing `text`, in label units, including padding. */
export type MeasureLabel = (text: string) => number;

/** Axis-aligned rectangle in world coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PinLabelLayout {
  /** Which side of the anchor the row is on; the row grows away from the anchor. */
  side: 'left' | 'right';
  /** World rects: [0] is the primary label, [i + 1] is pin.functions[i]. */
  labels: Rect[];
  /** Bounding box of the whole row. */
  bounds: Rect;
}

export const labelUnitWidth = (text: string, measure: MeasureLabel): number =>
  Math.max(MIN_LABEL_WIDTH, measure(text));

/**
 * Lays out the label row of a pin. The primary label stays at pin.x/pin.y; extra labels follow
 * it away from the anchor (to the left when the primary label's centre is left of the anchor,
 * otherwise to the right), `gapSize` world units apart.
 */
export const layoutPinLabels = (
  pin: Pick<PinData, 'x' | 'y' | 'targetX' | 'text' | 'functions'>,
  labelScale: number,
  gapSize: number,
  measure: MeasureLabel,
): PinLabelLayout => {
  const height = LABEL_HEIGHT * labelScale;
  const primary: Rect = { x: pin.x, y: pin.y, width: labelUnitWidth(pin.text, measure) * labelScale, height };
  const side = primary.x + primary.width / 2 < pin.targetX ? 'left' : 'right';

  const labels = [primary];
  let prev = primary;
  for (const fn of pin.functions ?? []) {
    const width = labelUnitWidth(fn.text, measure) * labelScale;
    const x = side === 'left' ? prev.x - gapSize - width : prev.x + prev.width + gapSize;
    prev = { x, y: pin.y, width, height };
    labels.push(prev);
  }

  const minX = Math.min(...labels.map(r => r.x));
  const maxX = Math.max(...labels.map(r => r.x + r.width));
  return { side, labels, bounds: { x: minX, y: pin.y, width: maxX - minX, height } };
};
