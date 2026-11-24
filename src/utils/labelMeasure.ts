import { LABEL_FONT_FAMILY, LABEL_FONT_SIZE, LABEL_FONT_STYLE, LABEL_PADDING } from './pinLayout';
import type { MeasureLabel } from './pinLayout';

let context: CanvasRenderingContext2D | null | undefined;

/**
 * Widths by text. Every render lays out every label (canvas, snapping, bulk panel), and with
 * hundreds of labels canvas measureText dominated a nudge; a project only has a few hundred
 * distinct texts, so they are measured once. Capped so endless typing can't grow it forever.
 */
const cache = new Map<string, number>();
const CACHE_LIMIT = 5000;

const getContext = () => {
  if (context === undefined) {
    try {
      context = document.createElement('canvas').getContext('2d');
    } catch {
      context = null;
    }
    if (context) context.font = `${LABEL_FONT_STYLE} ${LABEL_FONT_SIZE}px ${LABEL_FONT_FAMILY}`;
    // Widths measured with a fallback font are stale once a font finishes loading
    if (context && typeof document !== 'undefined') document.fonts?.addEventListener?.('loadingdone', () => cache.clear());
  }
  return context;
};

/**
 * Browser measurement of a label's width in label units, using the same font the canvas draws
 * labels with. Without a 2D canvas (tests, SSR) it falls back to a rough per-character estimate.
 */
export const measureLabelText: MeasureLabel = (text) => {
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  const ctx = getContext();
  const textWidth = ctx ? ctx.measureText(text).width : text.length * LABEL_FONT_SIZE * 0.6;
  // Round up so the text never touches the padding because of sub-pixel differences
  const width = Math.ceil(textWidth) + 2 * LABEL_PADDING;
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(text, width);
  return width;
};
