import type { SceneImage } from './scene';
import { rotatedSize } from './scene';
import type { PdfImage } from './pdf';

/** Longest side of an image re-drawn for export; keeps huge photos within canvas limits. */
const MAX_RASTER_SIDE = 8192;

const isJpeg = (src: string) => /^data:image\/jpe?g[;,]/i.test(src) || /\.jpe?g(\?|#|$)/i.test(src);

const sourceSize = (el: HTMLImageElement) => ({
  width: el.naturalWidth || el.width,
  height: el.naturalHeight || el.height,
});

/**
 * Draws the image, rotated, into a canvas the size of its rotated bounding box at the source
 * resolution (capped). The canvas covers world box `box`.
 */
const drawRotated = (img: SceneImage, el: HTMLImageElement) => {
  const src = sourceSize(el);
  // Source pixels per world unit (images are usually scaled down to fit the board)
  const density = Math.max(src.width / img.width, src.height / img.height, 0.01);
  const box = rotatedSize(img.width, img.height, img.rotation);
  const fit = Math.min(1, MAX_RASTER_SIDE / (Math.max(box.width, box.height) * density));
  const ppu = density * fit;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(box.width * ppu));
  canvas.height = Math.max(1, Math.round(box.height * ppu));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((img.rotation * Math.PI) / 180);
  ctx.drawImage(el, (-img.width * ppu) / 2, (-img.height * ppu) / 2, img.width * ppu, img.height * ppu);
  return { canvas, box };
};

/**
 * Raster for the PDF at the image's own resolution. An unrotated JPEG data URL is embedded
 * byte-for-byte; everything else goes through a canvas (PNG, or high-quality JPEG when the
 * source is a JPEG rotated by a right angle so no transparent corners appear).
 */
export const pdfImageFor = (img: SceneImage): PdfImage | null => {
  const el = img.element;
  const rotation = ((img.rotation % 360) + 360) % 360;
  const at = (box: { width: number; height: number }) => ({
    x: img.cx - box.width / 2, y: img.cy - box.height / 2, width: box.width, height: box.height,
  });

  if (rotation === 0 && /^data:image\/jpe?g[;,]/i.test(img.src)) {
    return { data: img.src, format: 'JPEG', ...at(img) };
  }
  if (rotation === 0 && /^data:image\/png[;,]/i.test(img.src)) {
    return { data: img.src, format: 'PNG', ...at(img) };
  }
  if (!el) return null;
  const { canvas, box } = drawRotated(img, el);
  if (isJpeg(img.src) && rotation % 90 === 0) {
    return { data: canvas.toDataURL('image/jpeg', 0.95), format: 'JPEG', ...at(box) };
  }
  return { data: canvas, format: 'PNG', ...at(box) };
};

/**
 * Data URL for embedding in SVG. Data URLs are used as they are; remote images (loaded with
 * CORS by the app) are re-encoded through a canvas at their source resolution.
 */
export const svgImageHref = (img: SceneImage): string | null => {
  if (img.src.startsWith('data:')) return img.src;
  const el = img.element;
  if (!el) return null;
  const src = sourceSize(el);
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(el, 0, 0);
  return isJpeg(img.src) ? canvas.toDataURL('image/jpeg', 0.95) : canvas.toDataURL('image/png');
};
