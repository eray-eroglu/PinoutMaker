import { describe, it, expect, vi } from 'vitest';
import {
  canReencode,
  chooseEncoding,
  dataUrlMime,
  hasTransparency,
  pickSmaller,
  prepareImportedImage,
  targetSize,
  DEFAULT_MAX_IMPORT_SIDE,
} from './imageImport';
import type { ImportCanvas, ImportCanvasContext, PrepareImportOptions } from './imageImport';

describe('targetSize', () => {
  it('keeps images within the limit unchanged', () => {
    expect(targetSize(3000, 2000, 3000)).toEqual({ width: 3000, height: 2000, scaled: false });
    expect(targetSize(800, 600, 3000)).toEqual({ width: 800, height: 600, scaled: false });
  });

  it('scales landscape and portrait so the longest side equals the limit', () => {
    expect(targetSize(4032, 3024, 3000)).toEqual({ width: 3000, height: 2250, scaled: true });
    expect(targetSize(3024, 4032, 3000)).toEqual({ width: 2250, height: 3000, scaled: true });
  });

  it('never upscales and keeps at least 1 px per side', () => {
    expect(targetSize(10, 10, 3000).scaled).toBe(false);
    expect(targetSize(100000, 1, 3000)).toEqual({ width: 3000, height: 1, scaled: true });
  });

  it('ignores a non-positive limit', () => {
    expect(targetSize(5000, 5000, 0).scaled).toBe(false);
  });

  it('defaults to 3000', () => {
    expect(DEFAULT_MAX_IMPORT_SIDE).toBe(3000);
  });
});

describe('dataUrlMime / canReencode', () => {
  it('reads the MIME type of a data URL', () => {
    expect(dataUrlMime('data:image/PNG;base64,AAA')).toBe('image/png');
    expect(dataUrlMime('data:image/svg+xml,<svg/>')).toBe('image/svg+xml');
    expect(dataUrlMime('https://x/y.png')).toBe('');
  });

  it('re-encodes raster formats but not SVG, GIF or unknown types', () => {
    for (const m of ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']) expect(canReencode(m)).toBe(true);
    for (const m of ['image/svg+xml', 'image/gif', 'application/octet-stream', '']) expect(canReencode(m)).toBe(false);
  });
});

describe('hasTransparency', () => {
  it('detects any non-opaque alpha byte', () => {
    expect(hasTransparency([1, 2, 3, 255, 4, 5, 6, 255])).toBe(false);
    expect(hasTransparency([1, 2, 3, 255, 4, 5, 6, 254])).toBe(true);
    expect(hasTransparency([])).toBe(false);
  });
});

describe('chooseEncoding', () => {
  it('uses PNG for transparent pixels and JPEG otherwise', () => {
    expect(chooseEncoding(true)).toEqual({ mime: 'image/png' });
    expect(chooseEncoding(false)).toEqual({ mime: 'image/jpeg', quality: 0.9 });
    expect(chooseEncoding(false, 0.8)).toEqual({ mime: 'image/jpeg', quality: 0.8 });
  });
});

describe('pickSmaller', () => {
  it('keeps the original unless the candidate is a smaller image data URL', () => {
    expect(pickSmaller('data:image/png;base64,AAAAAAAA', 'data:image/jpeg;base64,AA')).toEqual({
      src: 'data:image/jpeg;base64,AA', replaced: true,
    });
    expect(pickSmaller('data:image/png;base64,AA', 'data:image/jpeg;base64,AAAA').replaced).toBe(false);
    expect(pickSmaller('data:image/png;base64,AAAA', 'data:,').replaced).toBe(false);
    expect(pickSmaller('data:image/png;base64,AAAA', null).replaced).toBe(false);
  });
});

// --- glue, with fakes -------------------------------------------------------------------------

const fakeImage = (width: number, height: number, src = '') =>
  ({ width, height, naturalWidth: width, naturalHeight: height, src }) as unknown as HTMLImageElement;

interface Setup {
  original: string;
  size: [number, number];
  alpha?: number;
  encoded?: (mime: string, quality?: number) => string;
  context?: boolean;
  fileType?: string;
}

const setup = ({ original, size, alpha = 255, encoded, context = true, fileType = '' }: Setup) => {
  const draws: unknown[][] = [];
  const canvases: { width: number; height: number; ctx: ImportCanvasContext }[] = [];
  const toDataURL = vi.fn(encoded ?? ((mime: string) => `data:${mime};base64,X`));
  const loadImage = vi.fn(async (src: string) =>
    src === original ? fakeImage(size[0], size[1], src) : fakeImage(-1, -1, src));
  const createCanvas = vi.fn((width: number, height: number): ImportCanvas => {
    const ctx: ImportCanvasContext = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: (...args) => { draws.push(args); },
      getImageData: (_x, _y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4).fill(255);
        data[data.length - 1] = alpha;
        return { data };
      },
    };
    canvases.push({ width, height, ctx });
    return { getContext: () => (context ? ctx : null), toDataURL };
  });
  const options: PrepareImportOptions = {
    readFile: async () => original,
    loadImage,
    createCanvas,
  };
  const file = new File(['x'], 'photo', { type: fileType });
  return { file, options, draws, canvases, toDataURL, loadImage, createCanvas };
};

const big = (mime: string) => `data:${mime};base64,${'A'.repeat(1000)}`;

describe('prepareImportedImage', () => {
  it('returns a small image untouched, without a canvas', async () => {
    const s = setup({ original: big('image/png'), size: [1200, 800] });
    const r = await prepareImportedImage(s.file, s.options);
    expect(r.src).toBe(big('image/png'));
    expect(r.downscaled).toBe(false);
    expect(r.element.width).toBe(1200);
    expect(s.createCanvas).not.toHaveBeenCalled();
  });

  it('downscales an opaque JPEG to the limit as JPEG 0.9 with high-quality smoothing', async () => {
    const s = setup({ original: big('image/jpeg'), size: [4032, 3024] });
    const r = await prepareImportedImage(s.file, s.options);
    expect(r.downscaled).toBe(true);
    expect(r.src).toBe('data:image/jpeg;base64,X');
    expect(s.canvases[0]).toMatchObject({ width: 3000, height: 2250 });
    expect(s.canvases[0].ctx.imageSmoothingEnabled).toBe(true);
    expect(s.canvases[0].ctx.imageSmoothingQuality).toBe('high');
    expect(s.draws[0].slice(1)).toEqual([0, 0, 3000, 2250]);
    expect(s.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9);
    // The returned element is decoded from the new src
    expect(s.loadImage).toHaveBeenLastCalledWith('data:image/jpeg;base64,X');
    expect(r.element.src).toBe('data:image/jpeg;base64,X');
  });

  it('keeps PNG when the scaled pixels contain transparency', async () => {
    const s = setup({ original: big('image/png'), size: [5000, 1000], alpha: 0 });
    const r = await prepareImportedImage(s.file, s.options);
    expect(s.toDataURL).toHaveBeenCalledWith('image/png', undefined);
    expect(r.src).toBe('data:image/png;base64,X');
  });

  it('turns an opaque PNG into JPEG', async () => {
    const s = setup({ original: big('image/png'), size: [5000, 1000] });
    await prepareImportedImage(s.file, s.options);
    expect(s.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9);
  });

  it('uses the oriented natural size (EXIF already applied by the decoder)', async () => {
    const s = setup({ original: big('image/jpeg'), size: [3024, 4032] });
    await prepareImportedImage(s.file, s.options);
    expect(s.canvases[0]).toMatchObject({ width: 2250, height: 3000 });
  });

  it('keeps the original when the re-encode is not smaller', async () => {
    const s = setup({ original: big('image/png'), size: [4000, 4000], encoded: () => big('image/jpeg') + 'more' });
    const r = await prepareImportedImage(s.file, s.options);
    expect(r).toMatchObject({ src: big('image/png'), downscaled: false });
    expect(r.element.width).toBe(4000);
    expect(s.loadImage).toHaveBeenCalledTimes(1);
  });

  it('leaves SVG and GIF untouched', async () => {
    for (const mime of ['image/svg+xml', 'image/gif']) {
      const s = setup({ original: big(mime), size: [9000, 9000] });
      const r = await prepareImportedImage(s.file, s.options);
      expect(r).toMatchObject({ src: big(mime), downscaled: false });
      expect(s.createCanvas).not.toHaveBeenCalled();
    }
  });

  it('falls back to the original when the canvas is unavailable or encoding throws', async () => {
    const noCtx = setup({ original: big('image/jpeg'), size: [6000, 4000], context: false });
    expect((await prepareImportedImage(noCtx.file, noCtx.options)).downscaled).toBe(false);
    const throws = setup({
      original: big('image/jpeg'), size: [6000, 4000], encoded: () => { throw new Error('tainted'); },
    });
    expect(await prepareImportedImage(throws.file, throws.options)).toMatchObject({
      src: big('image/jpeg'), downscaled: false,
    });
  });

  it('honours a custom limit', async () => {
    const s = setup({ original: big('image/jpeg'), size: [1000, 500] });
    await prepareImportedImage(s.file, { ...s.options, maxSide: 400 });
    expect(s.canvases[0]).toMatchObject({ width: 400, height: 200 });
  });

  it('rejects when the file cannot be decoded', async () => {
    const s = setup({ original: big('image/jpeg'), size: [10, 10] });
    await expect(prepareImportedImage(s.file, {
      ...s.options,
      loadImage: () => Promise.reject(new Error('Failed to load image')),
    })).rejects.toThrow('Failed to load image');
  });

  it('reads files with FileReader by default', async () => {
    const file = new File(['hello'], 'a.svg', { type: 'image/svg+xml' });
    const r = await prepareImportedImage(file, { loadImage: async src => fakeImage(5, 5, src) });
    expect(r.src.startsWith('data:image/svg+xml')).toBe(true);
    expect(r.downscaled).toBe(false);
  });
});
