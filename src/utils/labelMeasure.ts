import { LABEL_FONT_FAMILY, LABEL_FONT_SIZE, LABEL_FONT_STYLE, LABEL_PADDING } from './pinLayout';
import type { MeasureLabel } from './pinLayout';

let context: CanvasRenderingContext2D | null | undefined;

const getContext = () => {
  if (context === undefined) {
    try {
      context = document.createElement('canvas').getContext('2d');
    } catch {
      context = null;
    }
    if (context) context.font = `${LABEL_FONT_STYLE} ${LABEL_FONT_SIZE}px ${LABEL_FONT_FAMILY}`;
  }
  return context;
};

/**
 * Browser measurement of a label's width in label units, using the same font the canvas draws
 * labels with. Without a 2D canvas (tests, SSR) it falls back to a rough per-character estimate.
 */
export const measureLabelText: MeasureLabel = (text) => {
  const ctx = getContext();
  const textWidth = ctx ? ctx.measureText(text).width : text.length * LABEL_FONT_SIZE * 0.6;
  // Round up so the text never touches the padding because of sub-pixel differences
  return Math.ceil(textWidth) + 2 * LABEL_PADDING;
};
