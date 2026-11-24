import type { BoardImage, LegendItem, LegendMode, LineData, PinData, PinFunction, ProjectData } from '../types';
import { DEFAULT_ANCHOR_SIZE, DEFAULT_GAP_SIZE, DEFAULT_LEGEND_ITEMS } from '../constants';
import { DEFAULT_PIN_COLOR, migrateLegacyPin } from './pinUtils';

export interface LoadedImage extends BoardImage {
  element: HTMLImageElement;
}

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

/**
 * Pins from older files have no `functions` and are returned untouched. Hand-edited or
 * generated files may leave out ids or colors; fill them so the editor can rely on them.
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
    functions: pin.functions.map((fn: Partial<PinFunction>) => ({
      ...fn,
      id: fn.id || crypto.randomUUID(),
      text: typeof fn.text === 'string' ? fn.text : '',
      color: fn.color || DEFAULT_PIN_COLOR,
    })),
  };
};

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
  const lines = (data.lines ?? []).map((l): LineData => {
    if (!l.points || l.points.length === 0) {
      return { ...l, points: [l.x1 ?? 0, l.y1 ?? 0, l.x2 ?? 100, l.y2 ?? 100] };
    }
    return l;
  });

  const migratedPins = (isLegacy ? pins.map(p => migrateLegacyPin(p, savedScale)) : pins).map(normalizeFunctions);

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

/** Loads every project image; images that fail are reported instead of blocking the rest. */
export const loadProjectImages = async (
  images: ParsedProject['images'],
): Promise<{ loaded: LoadedImage[]; failed: number }> => {
  const results = await Promise.allSettled(
    images.map(async (bImg): Promise<LoadedImage> => {
      const element = await loadImageElement(bImg.src);
      return {
        ...bImg,
        width: bImg.width ?? element.width,
        height: bImg.height ?? element.height,
        element,
      };
    }),
  );
  const loaded = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
  return { loaded, failed: results.length - loaded.length };
};
