import { buildExportScene } from './scene';
import type { ExportSceneInput, Scene } from './scene';
import { renderPdf } from './pdf';
import { renderSvg } from './svg';
import { renderToCanvas } from './canvas';
import { pdfImageFor, svgImageHref } from './images';

export type ExportFormat = 'pdf' | 'svg' | 'png';
export type PngScale = 1 | 2 | 4;

export interface ExportOptions {
  format: ExportFormat;
  includeLegend: boolean;
  /** Device pixels per world unit (board-image pixel) for PNG. */
  pngScale: PngScale;
  /** PNG only: leave the background transparent instead of white. */
  transparent: boolean;
}

export const EXPORT_FILE_NAME = 'pinout-diagram';

/** Canvas limits that hold in every current browser (Safari is the strictest on area). */
const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_AREA = 16384 * 16384 / 4;

const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before the URL goes away
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

const exportPdf = async (scene: Scene) => {
  // jsPDF is large; load it only when the user actually exports
  const { jsPDF, GState } = await import('jspdf');
  const { width, height } = scene.bounds;
  const pdf = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: 'Pinout' });
  renderPdf(scene, pdf, {
    createGState: options => new GState(options),
    imageFor: pdfImageFor,
  });
  pdf.save(`${EXPORT_FILE_NAME}.pdf`);
};

/** Largest scale ≤ `requested` that keeps the canvas within browser limits. */
export const clampPngScale = (scene: Scene, requested: number) => {
  const { width, height } = scene.bounds;
  return Math.min(
    requested,
    MAX_CANVAS_SIDE / width,
    MAX_CANVAS_SIDE / height,
    Math.sqrt(MAX_CANVAS_AREA / (width * height)),
  );
};

const exportPng = async (scene: Scene, options: ExportOptions): Promise<string | undefined> => {
  const scale = clampPngScale(scene, options.pngScale);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(scene.bounds.width * scale));
  canvas.height = Math.max(1, Math.round(scene.bounds.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  renderToCanvas(scene, ctx, scale, options.transparent ? null : '#ffffff');
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not encode the PNG');
  download(blob, `${EXPORT_FILE_NAME}.png`);
  if (scale < options.pngScale) {
    return `The diagram is too large for ×${options.pngScale}; it was exported at ×${Math.floor(scale * 100) / 100} (${canvas.width}×${canvas.height} px).`;
  }
};

/**
 * Exports the diagram in the chosen format and starts the download.
 * Resolves to false when there is nothing to export; may resolve with a note for the user.
 */
export const exportDiagram = async (
  input: Omit<ExportSceneInput, 'includeLegend'>,
  options: ExportOptions,
): Promise<{ exported: boolean; note?: string }> => {
  const scene = buildExportScene({ ...input, includeLegend: options.includeLegend });
  if (!scene) return { exported: false };

  switch (options.format) {
    case 'pdf':
      await exportPdf(scene);
      return { exported: true };
    case 'svg': {
      const svg = renderSvg(scene, { background: '#ffffff', imageHref: svgImageHref });
      download(new Blob([svg], { type: 'image/svg+xml' }), `${EXPORT_FILE_NAME}.svg`);
      return { exported: true };
    }
    case 'png':
      return { exported: true, note: await exportPng(scene, options) };
  }
};
