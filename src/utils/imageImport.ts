import { loadImageElement } from './project';

/**
 * Longest side, in pixels, an image imported from disk is stored at.
 *
 * Why 3000: an A4 page is 297 mm on its long side, so 3000 px is ~256 dpi even if the photo
 * fills the whole page edge to edge — already print-crisp, and in practice the photo shares the
 * page with labels and the legend, which raises the effective dpi further. PNG export at the
 * usual 2x scale of a board a few thousand units wide stays at ~1 source pixel per output pixel.
 * The export code (src/utils/export/images.ts, MAX_RASTER_SIDE = 8192) caps re-drawn images
 * well above this, so export never has to shrink an imported image again; 3000 only removes
 * resolution nothing downstream would show. A 12 MP phone photo (4032x3024, often 3-6 MB)
 * drops to ~6.8 MP and typically well under 1.5 MB as JPEG 0.9, which keeps the project JSON
 * and the debounced IndexedDB autosave fast.
 */
export const DEFAULT_MAX_IMPORT_SIDE = 3000;

/** JPEG quality for re-encoded opaque images (visually lossless for photos). */
export const DEFAULT_JPEG_QUALITY = 0.9;

export interface Size {
  width: number;
  height: number;
}

/**
 * Size to store an image at: unchanged when its longest side is within `maxSide`, otherwise
 * scaled down proportionally so the longest side equals `maxSide`. Never upscales; each side
 * is at least 1 px.
 */
export const targetSize = (width: number, height: number, maxSide: number): Size & { scaled: boolean } => {
  const longest = Math.max(width, height);
  if (!(longest > maxSide) || !(maxSide > 0)) return { width, height, scaled: false };
  const k = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * k)),
    height: Math.max(1, Math.round(height * k)),
    scaled: true,
  };
};

/** MIME type of a data URL ('image/png', ...), lower-cased; '' if it is not a data URL. */
export const dataUrlMime = (src: string): string => {
  const m = /^data:([^;,]+)[;,]/i.exec(src);
  return m ? m[1].toLowerCase() : '';
};

/**
 * Whether a source format can be decoded, redrawn and re-encoded without losing something the
 * user would notice. SVG is vector (rasterizing it would lose sharpness, and its intrinsic
 * size is arbitrary) and GIF may be animated; unknown types are left alone too.
 */
export const canReencode = (mime: string): boolean =>
  ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/bmp', 'image/x-ms-bmp', 'image/avif', 'image/tiff']
    .includes(mime.toLowerCase());

/** True when any pixel of RGBA data is not fully opaque. */
export const hasTransparency = (rgba: ArrayLike<number>): boolean => {
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 255) return true;
  }
  return false;
};

export interface Encoding {
  mime: 'image/png' | 'image/jpeg';
  quality?: number;
}

/**
 * Output format for a downscaled image: PNG whenever the pixels really contain transparency
 * (so it is kept), otherwise JPEG — which also covers sources that already were JPEG.
 */
export const chooseEncoding = (transparent: boolean, jpegQuality = DEFAULT_JPEG_QUALITY): Encoding =>
  transparent ? { mime: 'image/png' } : { mime: 'image/jpeg', quality: jpegQuality };

/** The re-encoded data URL if it is actually smaller than the original, else the original. */
export const pickSmaller = (original: string, candidate: string | null): { src: string; replaced: boolean } =>
  candidate && candidate.startsWith('data:image/') && candidate.length < original.length
    ? { src: candidate, replaced: true }
    : { src: original, replaced: false };

/** The subset of a 2D context the import path uses (lets tests pass a fake). */
export interface ImportCanvasContext {
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  drawImage(image: HTMLImageElement, dx: number, dy: number, dw: number, dh: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): { data: ArrayLike<number> };
}

/** The subset of a canvas the import path uses. */
export interface ImportCanvas {
  getContext(type: '2d'): ImportCanvasContext | null;
  toDataURL(type: string, quality?: number): string;
}

export interface PrepareImportOptions {
  /** Longest side to store, in px (default {@link DEFAULT_MAX_IMPORT_SIDE}). */
  maxSide?: number;
  /** JPEG quality for opaque re-encodes (default {@link DEFAULT_JPEG_QUALITY}). */
  jpegQuality?: number;
  /** Reads the file as a data URL (default: FileReader). */
  readFile?: (file: File) => Promise<string>;
  /** Decodes a src into a loaded image (default: loadImageElement). Rejects on corrupt data. */
  loadImage?: (src: string) => Promise<HTMLImageElement>;
  /** Creates a canvas of the given size (default: document.createElement('canvas')). */
  createCanvas?: (width: number, height: number) => ImportCanvas;
}

export interface PreparedImage {
  src: string;
  element: HTMLImageElement;
  downscaled: boolean;
}

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Could not read ${file.name}`));
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

const createDomCanvas = (width: number, height: number): ImportCanvas => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as ImportCanvas;
};

/**
 * Prepares an image file from disk for embedding in the project: decodes it and, when its
 * longest side exceeds `maxSide`, stores a downscaled re-encode instead of the original so
 * project files and the autosave stay small.
 *
 * - Small images, SVG/GIF/unknown formats, and re-encodes that would not be smaller keep the
 *   original data URL byte-for-byte (`downscaled: false`).
 * - Transparency is detected from the scaled pixels themselves: transparent → PNG, opaque →
 *   JPEG (a source JPEG stays JPEG).
 * - EXIF orientation: browsers apply it when decoding an <img> (`image-orientation: from-image`
 *   is the default), and naturalWidth/naturalHeight and drawImage both use the oriented image.
 *   The size is therefore taken from naturalWidth/Height and the canvas receives upright pixels;
 *   the re-encode has no EXIF, so it displays the same way everywhere.
 * - A file that cannot be read or decoded rejects (as the previous import path did). Canvas
 *   failures (no 2D context, encoding errors) fall back to the original instead.
 */
export const prepareImportedImage = async (
  file: File,
  options: PrepareImportOptions = {},
): Promise<PreparedImage> => {
  const {
    maxSide = DEFAULT_MAX_IMPORT_SIDE,
    jpegQuality = DEFAULT_JPEG_QUALITY,
    readFile = readFileAsDataUrl,
    loadImage = loadImageElement,
    createCanvas = createDomCanvas,
  } = options;

  const original = await readFile(file);
  const element = await loadImage(original);
  const keep: PreparedImage = { src: original, element, downscaled: false };

  const mime = dataUrlMime(original) || file.type.toLowerCase();
  if (!canReencode(mime)) return keep;

  const natural = {
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
  const size = targetSize(natural.width, natural.height, maxSide);
  if (!size.scaled) return keep;

  let candidate: string | null = null;
  try {
    const canvas = createCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return keep;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(element, 0, 0, size.width, size.height);
    // JPEG has no alpha channel, so there is nothing to scan for.
    const isJpegSource = /^image\/(jpe?g|pjpeg)$/.test(mime);
    const transparent = !isJpegSource && hasTransparency(ctx.getImageData(0, 0, size.width, size.height).data);
    const encoding = chooseEncoding(transparent, jpegQuality);
    candidate = canvas.toDataURL(encoding.mime, encoding.quality);
  } catch {
    return keep;
  }

  const picked = pickSmaller(original, candidate);
  if (!picked.replaced) return keep;
  try {
    return { src: picked.src, element: await loadImage(picked.src), downscaled: true };
  } catch {
    return keep;
  }
};
