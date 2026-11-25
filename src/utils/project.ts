import type { BoardImage, LegendItem, LegendMode, LineData, PinData, PinFunction, ProjectData } from '../types';
import { DEFAULT_ANCHOR_SIZE, DEFAULT_GAP_SIZE, DEFAULT_LEGEND_ITEMS } from '../constants';
import { DEFAULT_PIN_COLOR, migrateLegacyPin } from './pinUtils';
import { withoutHeader } from './header';

export interface LoadedImage extends BoardImage {
  /**
   * Null when the image could not be loaded (unreachable URL, corrupt data). The image is kept
   * as a placeholder so saving and autosave still write it back, instead of silently dropping
   * it from the project; the canvas draws a grey box and export leaves it out.
   */
  element: HTMLImageElement | null;
}

/** Size given to a placeholder whose file has no stored size (legacy single-image projects). */
export const MISSING_IMAGE_SIZE = { width: 400, height: 300 };

export interface ProjectState {
  images: BoardImage[];
  pins: PinData[];
  lines: LineData[];
  scale: number;
  position: { x: number; y: number };
  gapSize: number;
  legendItems: LegendItem[];
  isLegendVisible: boolean;
  legendMode: LegendMode;
  legendShowCounts: boolean;
  anchorSize: number;
  /** World size of one label unit; null until the first pin or line fixes it. */
  labelScale: number | null;
}

/** Builds the JSON-serialisable project (drops the runtime HTMLImageElement). */
export const serializeProject = (state: ProjectState): ProjectData => ({
  images: state.images.map(({ id, src, x, y, width, height, rotation }) => ({ id, src, x, y, width, height, rotation })),
  pins: state.pins,
  lines: state.lines,
  scale: state.scale,
  position: state.position,
  gapSize: state.gapSize,
  legendItems: state.legendItems,
  isLegendVisible: state.isLegendVisible,
  legendMode: state.legendMode,
  legendShowCounts: state.legendShowCounts,
  anchorSize: state.anchorSize,
  ...(state.labelScale !== null ? { labelScale: state.labelScale } : {}),
});

export interface ParsedProject extends Omit<ProjectState, 'images'> {
  /** Images still to be loaded. Legacy single-image projects are converted to one entry. */
  images: Array<Omit<BoardImage, 'width' | 'height'> & { width?: number; height?: number }>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmptyString = (v: unknown): v is string => typeof v === 'string' && v !== '';

/**
 * Pins from older files have no `functions` and are returned untouched. Hand-edited or
 * generated files (and library pinouts) may leave out ids or colors, or hold values of the
 * wrong type; fill or drop them so rendering can rely on them.
 */
const normalizeFunctions = (pin: PinData): PinData => {
  if (pin.functions === undefined) return pin;
  if (!Array.isArray(pin.functions)) {
    const rest = { ...pin };
    delete rest.functions;
    return rest;
  }
  return {
    ...pin,
    functions: (pin.functions as unknown[]).filter(isObject).map((fn): PinFunction => {
      const rest = { ...fn };
      delete rest.textColor;
      return {
        ...rest,
        id: nonEmptyString(fn.id) ? fn.id : crypto.randomUUID(),
        text: typeof fn.text === 'string' ? fn.text : '',
        color: nonEmptyString(fn.color) ? fn.color : DEFAULT_PIN_COLOR,
        ...(nonEmptyString(fn.textColor) ? { textColor: fn.textColor } : {}),
      };
    }),
  };
};

/**
 * Header membership is optional. A pin with only one of the two fields, or with values of the
 * wrong type, is treated as a stand-alone pin rather than guessing its place in a header.
 */
const normalizeHeader = (pin: PinData): PinData => {
  if (pin.headerId === undefined && pin.headerIndex === undefined) return pin;
  const valid = typeof pin.headerId === 'string' && pin.headerId !== ''
    && typeof pin.headerIndex === 'number' && Number.isInteger(pin.headerIndex) && pin.headerIndex >= 0;
  return valid ? pin : withoutHeader(pin);
};

/** Measured label size written by older versions; geometry now comes from layoutPinLabels. */
const withoutLegacyLabelSize = (pin: PinData): PinData => {
  const rest = { ...pin } as PinData & { labelWidth?: unknown; labelHeight?: unknown };
  delete rest.labelWidth;
  delete rest.labelHeight;
  return rest;
};

/** Cleans the optional pin fields (function labels, header membership) of untrusted data. */
export const normalizePin = (pin: PinData): PinData => normalizeHeader(normalizeFunctions(withoutLegacyLabelSize(pin)));

/** A line as older files stored it: one segment as x1/y1/x2/y2, sometimes with an isAngled flag. */
type LegacyLine = LineData & { x1?: number; y1?: number; x2?: number; y2?: number; isAngled?: boolean };

/** Parses a saved project file, filling defaults and migrating legacy formats. Throws on invalid JSON. */
export const parseProject = (content: string): ParsedProject => {
  const data = JSON.parse(content) as Partial<ProjectData>;
  if (!data || typeof data !== 'object') throw new Error('Project file is not an object');

  const images: ParsedProject['images'] = data.image
    ? [{ id: crypto.randomUUID(), src: data.image, x: 0, y: 0, rotation: data.rotation || 0 }]
    : (data.images ?? []);

  const savedScale = data.scale || 1;
  const pins = data.pins ?? [];

  // Files without labelScale drew labels and lines at 1/zoom. Freeze them as they looked
  // at the zoom the file was saved with.
  const isLegacy = data.labelScale === undefined;
  const hasContent = pins.length > 0 || (data.lines?.length ?? 0) > 0;
  const labelScale = data.labelScale ?? (hasContent ? 1 / savedScale : null);

  // Legacy lines used x1/y1/x2/y2 instead of points[]
  const lines = ((data.lines ?? []) as LegacyLine[]).map((legacy): LineData => {
    const line = { ...legacy };
    delete line.x1;
    delete line.y1;
    delete line.x2;
    delete line.y2;
    delete line.isAngled;
    if (line.points && line.points.length > 0) return line;
    return { ...line, points: [legacy.x1 ?? 0, legacy.y1 ?? 0, legacy.x2 ?? 100, legacy.y2 ?? 100] };
  });

  const migratedPins = (isLegacy ? pins.map(p => migrateLegacyPin(p, savedScale)) : pins).map(normalizePin);

  return {
    images,
    pins: migratedPins,
    lines,
    scale: savedScale,
    position: data.position ?? { x: 0, y: 0 },
    gapSize: data.gapSize ?? DEFAULT_GAP_SIZE,
    legendItems: data.legendItems && data.legendItems.length > 0 ? data.legendItems : DEFAULT_LEGEND_ITEMS.map(i => ({ ...i })),
    isLegendVisible: data.isLegendVisible ?? true,
    legendMode: data.legendMode === 'used' || data.legendMode === 'dimUnused' ? data.legendMode : 'all',
    legendShowCounts: data.legendShowCounts ?? false,
    anchorSize: data.anchorSize ?? DEFAULT_ANCHOR_SIZE,
    labelScale,
  };
};

/**
 * Loads an image element. Remote URLs are requested with CORS so the canvas
 * is not tainted (otherwise PDF export fails with a SecurityError).
 */
export const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
    img.src = src;
  });

/**
 * Loads every project image, in order. An image that fails does not block the rest; it is
 * returned as a placeholder (element null) with its stored data, and counted in `failed`.
 */
export const loadProjectImages = async (
  images: ParsedProject['images'],
  load: (src: string) => Promise<HTMLImageElement> = loadImageElement,
): Promise<{ images: LoadedImage[]; failed: number }> => {
  const results = await Promise.allSettled(images.map(bImg => load(bImg.src)));
  let failed = 0;
  const loaded = images.map((bImg, i): LoadedImage => {
    const result = results[i];
    const element = result.status === 'fulfilled' ? result.value : null;
    if (!element) failed++;
    return {
      ...bImg,
      width: bImg.width ?? element?.width ?? MISSING_IMAGE_SIZE.width,
      height: bImg.height ?? element?.height ?? MISSING_IMAGE_SIZE.height,
      element,
    };
  });
  return { images: loaded, failed };
};
