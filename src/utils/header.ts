import type { BoardImage, PinData } from '../types';
import { DEFAULT_PIN_COLOR, getSmartColor } from './pinUtils';
import { LABEL_HEIGHT, labelUnitWidth } from './pinLayout';
import type { MeasureLabel } from './pinLayout';
import { measureLabelText } from './labelMeasure';
import type { Language } from '../i18n';

/**
 * Header tool
 * -----------
 * A header is a row of pads placed in one go: the user clicks the first and the last pad and the
 * pins in between are spaced evenly. All of its pins share a `headerId` and know their
 * `headerIndex`, which is what lets a pasted pin table fill them in order.
 *
 * Distances below are label units (world = × labelScale), like the rest of the label geometry.
 */

export interface Point {
  x: number;
  y: number;
}

/** Where the labels go. 'auto' faces away from the board the header sits on. */
export type HeaderSideSetting = 'auto' | 'left' | 'right' | 'above' | 'below';
export type HeaderSide = Exclude<HeaderSideSetting, 'auto'>;

export interface HeaderSettings {
  count: number;
  /** 'blank' leaves every name empty, to be filled later (e.g. from a pin table). */
  naming: 'numbered' | 'blank';
  prefix: string;
  startNumber: number;
  step: number;
  side: HeaderSideSetting;
}

export const DEFAULT_HEADER_SETTINGS: HeaderSettings = {
  count: 10,
  naming: 'numbered',
  prefix: 'P',
  startNumber: 1,
  step: 1,
  side: 'auto',
};

export const MAX_HEADER_PINS = 200;

/** Gap between the anchor and the anchor-side edge of a label; the same as a single new pin. */
export const HEADER_LABEL_OFFSET = 50;
/** Above/below: distance of the nearest label row's centre from the header. */
export const FAN_FIRST_OFFSET = 36;
/** Above/below: vertical distance between stacked label rows (a label plus a small gap). */
export const FAN_ROW_STEP = LABEL_HEIGHT + 6;

export const clampHeaderCount = (count: number): number =>
  Number.isFinite(count) ? Math.min(MAX_HEADER_PINS, Math.max(1, Math.round(count))) : 1;

/**
 * Anchor positions of `count` pins spread evenly from `start` to `end`, both ends included.
 * A single pin sits on the first pad clicked.
 */
export const headerPinPositions = (start: Point, end: Point, count: number): Point[] => {
  const n = clampHeaderCount(count);
  if (n === 1) return [{ x: start.x, y: start.y }];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  });
};

/** Snaps `end` so the header is exactly horizontal or vertical (whichever is closer). */
export const constrainToAxis = (start: Point, end: Point): Point =>
  Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? { x: end.x, y: start.y } : { x: start.x, y: end.y };

/**
 * Resolves 'auto' to a concrete side. A header that runs mostly vertically gets its labels left or
 * right, a horizontal one above or below; 'auto' picks the side facing away from `centre` (the
 * board the header is on), so labels land outside the board instead of on top of it.
 */
export const resolveHeaderSide = (
  side: HeaderSideSetting,
  start: Point,
  end: Point,
  centre: Point | null,
): HeaderSide => {
  if (side !== 'auto') return side;
  const vertical = Math.abs(end.y - start.y) >= Math.abs(end.x - start.x);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  if (vertical) return centre && mid.x < centre.x ? 'left' : 'right';
  return centre && mid.y < centre.y ? 'above' : 'below';
};

const isPointOnImage = (img: BoardImage, p: Point): boolean => {
  // Images are drawn centred on img.x/img.y and rotated about that centre
  const a = (-img.rotation * Math.PI) / 180;
  const dx = p.x - img.x;
  const dy = p.y - img.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(lx) <= img.width / 2 && Math.abs(ly) <= img.height / 2;
};

/** Centre of the topmost image under `p`, or null when the point is not on an image. */
export const imageCentreAt = (images: BoardImage[], p: Point): Point | null => {
  for (let i = images.length - 1; i >= 0; i--) {
    if (isPointOnImage(images[i], p)) return { x: images[i].x, y: images[i].y };
  }
  return null;
};

export const headerPinName = (settings: Pick<HeaderSettings, 'naming' | 'prefix' | 'startNumber' | 'step'>, index: number): string =>
  settings.naming === 'blank' ? '' : `${settings.prefix}${settings.startNumber + index * settings.step}`;

/**
 * Top-left corners (world) of each pin's primary label.
 *
 * Left/right: one column with the anchor-side edges aligned (the outermost anchor + the usual
 * offset), each label vertically centred on its anchor so the leader lines are straight.
 *
 * Above/below: labels cannot sit side by side (a label is wider than a pad pitch) and the text is
 * never rotated, so the rows are stacked outward from the header as a fan: the left half of the
 * pins points left, the right half right, and the pins nearest the header's ends get the rows
 * nearest the header. Every row is pushed sideways at least as far as it is pushed out, which keeps
 * each L-shaped leader horizontal-first, so no leader crosses another row or leader.
 */
export const headerLabelPositions = (
  anchors: Point[],
  names: string[],
  side: HeaderSide,
  labelScale: number,
  measure: MeasureLabel = measureLabelText,
): Point[] => {
  const ls = labelScale;
  const halfHeight = (LABEL_HEIGHT / 2) * ls;
  const widthOf = (i: number) => labelUnitWidth(names[i] ?? '', measure) * ls;

  if (side === 'left' || side === 'right') {
    const xs = anchors.map(a => a.x);
    const edge = side === 'left' ? Math.min(...xs) - HEADER_LABEL_OFFSET * ls : Math.max(...xs) + HEADER_LABEL_OFFSET * ls;
    return anchors.map((a, i) => ({ x: side === 'left' ? edge - widthOf(i) : edge, y: a.y - halfHeight }));
  }

  const ys = anchors.map(a => a.y);
  const baseY = side === 'above' ? Math.min(...ys) : Math.max(...ys);
  const outward = side === 'above' ? -1 : 1;
  const byX = anchors.map((a, i) => ({ a, i })).sort((p, q) => p.a.x - q.a.x || p.i - q.i);
  const leftCount = Math.floor(anchors.length / 2);

  const result: Point[] = new Array(anchors.length);
  byX.forEach(({ a, i }, rank) => {
    const pointsLeft = rank < leftCount;
    const tier = pointsLeft ? rank : anchors.length - 1 - rank;
    const distance = (FAN_FIRST_OFFSET + tier * FAN_ROW_STEP) * ls;
    result[i] = {
      x: pointsLeft ? a.x - distance - widthOf(i) : a.x + distance,
      y: baseY + outward * distance - halfHeight,
    };
  });
  return result;
};

export interface BuildHeaderOptions {
  start: Point;
  end: Point;
  settings: HeaderSettings;
  side: HeaderSide;
  labelScale: number;
  headerId?: string;
  newId?: () => string;
  measure?: MeasureLabel;
}

/** The pins of a new header, in header order (index 0 = first pad clicked). */
export const buildHeaderPins = ({
  start,
  end,
  settings,
  side,
  labelScale,
  headerId = crypto.randomUUID(),
  newId = () => crypto.randomUUID(),
  measure = measureLabelText,
}: BuildHeaderOptions): PinData[] => {
  const anchors = headerPinPositions(start, end, settings.count);
  const names = anchors.map((_, i) => headerPinName(settings, i));
  const labels = headerLabelPositions(anchors, names, side, labelScale, measure);
  return anchors.map((a, i) => ({
    id: newId(),
    x: labels[i].x,
    y: labels[i].y,
    targetX: a.x,
    targetY: a.y,
    text: names[i],
    color: getSmartColor(names[i]) ?? DEFAULT_PIN_COLOR,
    isPwm: false,
    headerId,
    headerIndex: i,
  }));
};

export interface HeaderGroup {
  id: string;
  /** The header's pins sorted by headerIndex. */
  pins: PinData[];
}

/** All headers on the board, in the order their first pin appears. */
export const getHeaders = (pins: PinData[]): HeaderGroup[] => {
  const groups = new Map<string, PinData[]>();
  for (const pin of pins) {
    if (!pin.headerId) continue;
    const group = groups.get(pin.headerId);
    if (group) group.push(pin);
    else groups.set(pin.headerId, [pin]);
  }
  return [...groups].map(([id, group]) => ({
    id,
    pins: [...group].sort((a, b) => (a.headerIndex ?? 0) - (b.headerIndex ?? 0)),
  }));
};

/** Short description of a header for pickers, e.g. "P1 – P8 (8 pins)" (Turkish: "P1 – P8 (8 pin)"). */
export const describeHeader = (header: HeaderGroup, language: Language = 'en'): string => {
  const first = header.pins[0]?.text || '?';
  const last = header.pins[header.pins.length - 1]?.text || '?';
  const n = header.pins.length;
  // Turkish keeps the noun singular after a number
  const count = language === 'tr' ? `${n} pin` : `${n} pin${n === 1 ? '' : 's'}`;
  return n === 1 ? `${first} (${count})` : `${first} – ${last} (${count})`;
};

/**
 * Gives every header in `pins` a new id (pins of one header keep sharing theirs). Used when the
 * same pins are added again, e.g. a library pinout imported twice, so the copies don't merge.
 */
export const withFreshHeaderIds = (pins: PinData[], newId: () => string = () => crypto.randomUUID()): PinData[] => {
  const ids = new Map<string, string>();
  return pins.map(pin => {
    if (!pin.headerId) return pin;
    let id = ids.get(pin.headerId);
    if (!id) {
      id = newId();
      ids.set(pin.headerId, id);
    }
    return { ...pin, headerId: id };
  });
};

/** Copy of a pin that is no longer part of any header. */
export const withoutHeader = (pin: PinData): PinData => {
  const rest = { ...pin };
  delete rest.headerId;
  delete rest.headerIndex;
  return rest;
};
