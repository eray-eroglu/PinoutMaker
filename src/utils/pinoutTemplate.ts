import type { LegendItem, LineData, PinData } from '../types';
import { DEFAULT_PIN_COLOR, scaleLabelsAroundAnchors } from './pinUtils';

/**
 * A ready-made pinout shipped with a library product (Supabase `products.pinout`).
 *
 * Coordinates are relative to the image CENTRE, with the image unrotated at imageWidth x imageHeight
 * (the editor draws images centred on img.x/img.y). `labelScale` is the world size of one label
 * unit in that same pixel space.
 */
export interface PinoutTemplate {
  version: 1;
  imageWidth: number;
  imageHeight: number;
  labelScale: number;
  pins: PinData[];
  lines?: LineData[];
  legendItems?: LegendItem[];
}

/** Where an image sits in the world: centre, displayed size and rotation in degrees (clockwise). */
export interface PlacedImage {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ImportedPinout {
  pins: PinData[];
  lines: LineData[];
  legendItems: LegendItem[];
  /** The project's label scale after the import: the existing one, or the template's when there is none yet. */
  labelScale: number;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * Validates untrusted JSON (a jsonb column, or an authored file) and returns a clean template,
 * or null when it is unusable. A broken template must never take the image import down with it.
 */
export const parsePinoutTemplate = (raw: unknown): PinoutTemplate | null => {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(raw) || raw.version !== 1) return null;
  const { imageWidth, imageHeight, labelScale, pins, lines, legendItems } = raw;
  if (!isFiniteNumber(imageWidth) || imageWidth <= 0) return null;
  if (!isFiniteNumber(imageHeight) || imageHeight <= 0) return null;
  if (!isFiniteNumber(labelScale) || labelScale <= 0) return null;
  if (!Array.isArray(pins)) return null;

  const cleanPins: PinData[] = [];
  for (const p of pins) {
    if (!isRecord(p)) return null;
    if (![p.x, p.y, p.targetX, p.targetY].every(isFiniteNumber)) return null;
    cleanPins.push({
      ...p,
      id: typeof p.id === 'string' ? p.id : '',
      text: typeof p.text === 'string' ? p.text : '',
      color: typeof p.color === 'string' ? p.color : DEFAULT_PIN_COLOR,
      isPwm: p.isPwm === true,
    } as PinData);
  }

  const cleanLines: LineData[] = [];
  if (lines !== undefined) {
    if (!Array.isArray(lines)) return null;
    for (const l of lines) {
      if (!isRecord(l) || !Array.isArray(l.points)) return null;
      if (l.points.length < 4 || l.points.length % 2 !== 0 || !l.points.every(isFiniteNumber)) return null;
      cleanLines.push({
        ...l,
        id: typeof l.id === 'string' ? l.id : '',
        color: typeof l.color === 'string' ? l.color : '#1f2937',
        thickness: isFiniteNumber(l.thickness) && l.thickness > 0 ? l.thickness : 2,
      } as LineData);
    }
  }

  const cleanLegend: LegendItem[] = [];
  if (legendItems !== undefined) {
    if (!Array.isArray(legendItems)) return null;
    for (const item of legendItems) {
      if (!isRecord(item) || typeof item.text !== 'string' || typeof item.color !== 'string') return null;
      cleanLegend.push({ id: typeof item.id === 'string' ? item.id : '', text: item.text, color: item.color });
    }
  }

  return {
    version: 1,
    imageWidth,
    imageHeight,
    labelScale,
    pins: cleanPins,
    ...(lines !== undefined ? { lines: cleanLines } : {}),
    ...(legendItems !== undefined ? { legendItems: cleanLegend } : {}),
  };
};

/**
 * Gives an object a new id, and every nested array item that carries an `id` too
 * (e.g. a pin's function list). Everything else is passed through untouched.
 */
const withFreshIds = <T extends { id: string }>(item: T, newId: () => string): T => {
  const copy: Record<string, unknown> = { ...item, id: newId() };
  for (const [key, value] of Object.entries(copy)) {
    if (key !== 'id' && Array.isArray(value)) {
      copy[key] = value.map(v => (isRecord(v) && 'id' in v ? { ...v, id: newId() } : v));
    }
  }
  return copy as T;
};

type PointMap = (x: number, y: number) => [number, number];

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Template pixels -> world: scale, rotate clockwise about the centre (Konva, y down), translate. */
const templateToWorld = (img: PlacedImage, fx: number, fy: number): PointMap => {
  const cos = Math.cos(toRadians(img.rotation));
  const sin = Math.sin(toRadians(img.rotation));
  return (x, y) => {
    const sx = x * fx;
    const sy = y * fy;
    return [img.x + sx * cos - sy * sin, img.y + sx * sin + sy * cos];
  };
};

/** Exact inverse of {@link templateToWorld}. */
const worldToTemplate = (img: PlacedImage, fx: number, fy: number): PointMap => {
  const cos = Math.cos(toRadians(img.rotation));
  const sin = Math.sin(toRadians(img.rotation));
  return (x, y) => {
    const dx = x - img.x;
    const dy = y - img.y;
    return [(dx * cos + dy * sin) / fx, (-dx * sin + dy * cos) / fy];
  };
};

const mapPin = (pin: PinData, map: PointMap): PinData => {
  const [x, y] = map(pin.x, pin.y);
  const [targetX, targetY] = map(pin.targetX, pin.targetY);
  return { ...pin, x, y, targetX, targetY };
};

const mapLine = (line: LineData, map: PointMap): LineData => {
  const points: number[] = [];
  for (let i = 0; i + 1 < line.points.length; i += 2) points.push(...map(line.points[i], line.points[i + 1]));
  return { ...line, points };
};

/**
 * Places a template on an image: pins and lines in world coordinates with fresh ids.
 *
 * Label size: the template's labelScale (times the image's scale factor) is what its label offsets
 * were designed for. A project that already has a labelScale keeps it, so the imported label
 * offsets are rescaled around their anchors to match; otherwise the project adopts the template's.
 * A label is only moved, never rotated, so a rotated image keeps upright, readable text.
 */
export const importPinoutTemplate = (
  template: PinoutTemplate,
  image: PlacedImage,
  projectLabelScale: number | null,
  newId: () => string = () => crypto.randomUUID(),
): ImportedPinout => {
  const fx = image.width / template.imageWidth;
  const fy = image.height / template.imageHeight;
  const map = templateToWorld(image, fx, fy);

  // Label units are isotropic, so a non-uniform resize contributes its geometric mean.
  const templateWorldLabelScale = template.labelScale * Math.sqrt(fx * fy);
  const labelScale = projectLabelScale ?? templateWorldLabelScale;

  const pins = scaleLabelsAroundAnchors(
    template.pins.map(p => withFreshIds(mapPin(p, map), newId)),
    labelScale / templateWorldLabelScale,
  );
  const lines = (template.lines ?? []).map(l => withFreshIds(mapLine(l, map), newId));
  const legendItems = (template.legendItems ?? []).map(item => ({ ...item, id: newId() }));

  return { pins, lines, legendItems, labelScale };
};

/**
 * Builds a template from the current pins and lines relative to an image: the inverse of
 * {@link importPinoutTemplate} with the image's current size as the template's reference size.
 */
export const exportPinoutTemplate = (
  image: PlacedImage,
  pins: PinData[],
  lines: LineData[],
  labelScale: number,
  legendItems: LegendItem[] = [],
): PinoutTemplate => {
  const map = worldToTemplate(image, 1, 1);
  const roundPin = (p: PinData): PinData => ({
    ...p, x: round(p.x), y: round(p.y), targetX: round(p.targetX), targetY: round(p.targetY),
  });
  return {
    version: 1,
    imageWidth: round(image.width),
    imageHeight: round(image.height),
    labelScale: Math.round(labelScale * 1e6) / 1e6,
    pins: pins.map(p => roundPin(mapPin(p, map))),
    lines: lines.map(l => {
      const mapped = mapLine(l, map);
      return { ...mapped, points: mapped.points.map(round) };
    }),
    legendItems: legendItems.map(item => ({ ...item })),
  };
};

/** `<name>-pinout.json`, where the name comes from the image URL when it has one. */
export const pinoutFileName = (imageSrc: string): string => {
  let base = '';
  if (/^https?:/i.test(imageSrc)) {
    try {
      base = decodeURIComponent(new URL(imageSrc).pathname.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '');
    } catch {
      base = '';
    }
  }
  const safe = base.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safe || 'board'}-pinout.json`;
};
