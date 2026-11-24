import type { Scene, SceneImage } from './scene';
import { resolveColor } from './color';

/** The part of jsPDF the renderer uses (an interface so tests can pass a recording stub). */
export interface PdfDoc {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  setFillColor(r: number, g: number, b: number): unknown;
  setDrawColor(r: number, g: number, b: number): unknown;
  setTextColor(r: number, g: number, b: number): unknown;
  setLineWidth(width: number): unknown;
  setLineCap(style: string): unknown;
  setLineJoin(style: string): unknown;
  setFont(family: string, style: string): unknown;
  setFontSize(size: number): unknown;
  getTextWidth(text: string): number;
  text(text: string, x: number, y: number, options: { align: 'left' | 'center'; baseline: 'alphabetic' }): unknown;
  rect(x: number, y: number, w: number, h: number, style: string): unknown;
  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style: string): unknown;
  circle(x: number, y: number, r: number, style: string): unknown;
  lines(lines: number[][], x: number, y: number, scale: [number, number], style: string, closed: boolean): unknown;
  addImage(data: string | HTMLCanvasElement | HTMLImageElement, format: string, x: number, y: number, w: number, h: number): unknown;
  saveGraphicsState(): unknown;
  restoreGraphicsState(): unknown;
  setGState(state: unknown): unknown;
}

/** An image ready to embed: raster data plus the world-space box it fills (already rotated). */
export interface PdfImage {
  data: string | HTMLCanvasElement | HTMLImageElement;
  format: 'JPEG' | 'PNG';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfRenderDeps {
  /** jsPDF's GState constructor (opacity). */
  createGState: (options: { opacity: number; 'stroke-opacity': number }) => unknown;
  /** Embeddable raster for an image primitive, or null to skip it. */
  imageFor: (image: SceneImage) => PdfImage | null;
}

/** 1 pt in mm (jsPDF font sizes are points while the page uses mm). */
const PT_IN_MM = 25.4 / 72;

/**
 * Draws the scene onto the first page of `pdf` (unit mm), fitted and centred. Everything except
 * images is vector: rounded rects, polylines, circles and real (selectable) Helvetica text.
 */
export const renderPdf = (scene: Scene, pdf: PdfDoc, deps: PdfRenderDeps) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const { bounds } = scene;
  const k = Math.min(pageWidth / bounds.width, pageHeight / bounds.height);
  const ox = (pageWidth - bounds.width * k) / 2 - bounds.x * k;
  const oy = (pageHeight - bounds.height * k) / 2 - bounds.y * k;
  const X = (x: number) => ox + x * k;
  const Y = (y: number) => oy + y * k;

  /** Runs `draw` with fill/stroke opacity applied; plain colours skip the graphics state. */
  const withOpacity = (fill: number, stroke: number, draw: () => void) => {
    if (fill >= 1 && stroke >= 1) {
      draw();
      return;
    }
    pdf.saveGraphicsState();
    pdf.setGState(deps.createGState({ opacity: fill, 'stroke-opacity': stroke }));
    draw();
    pdf.restoreGraphicsState();
  };

  const rectPath = (x: number, y: number, w: number, h: number, r: number, style: string) => {
    if (r > 0) pdf.roundedRect(X(x), Y(y), w * k, h * k, r * k, r * k, style);
    else pdf.rect(X(x), Y(y), w * k, h * k, style);
  };

  for (const p of scene.primitives) {
    switch (p.kind) {
      case 'image': {
        const img = deps.imageFor(p);
        if (img) pdf.addImage(img.data, img.format, X(img.x), Y(img.y), img.width * k, img.height * k);
        break;
      }
      case 'polyline': {
        if (p.points.length < 4) break;
        const c = resolveColor(p.stroke);
        const deltas: number[][] = [];
        for (let i = 2; i + 1 < p.points.length; i += 2) {
          deltas.push([(p.points[i] - p.points[i - 2]) * k, (p.points[i + 1] - p.points[i - 1]) * k]);
        }
        withOpacity(1, c.a * (p.opacity ?? 1), () => {
          pdf.setDrawColor(c.r, c.g, c.b);
          pdf.setLineWidth(p.strokeWidth * k);
          pdf.setLineCap(p.cap);
          pdf.setLineJoin(p.join);
          pdf.lines(deltas, X(p.points[0]), Y(p.points[1]), [1, 1], 'S', false);
        });
        break;
      }
      case 'circle': {
        const c = resolveColor(p.fill);
        withOpacity(c.a, 1, () => {
          pdf.setFillColor(c.r, c.g, c.b);
          pdf.circle(X(p.cx), Y(p.cy), p.r * k, 'F');
        });
        break;
      }
      case 'rect': {
        const opacity = p.opacity ?? 1;
        if (p.shadow && p.shadow.opacity > 0) {
          // PDF has no blur: stack faint offset copies that grow by the blur radius so the edge fades out
          const s = p.shadow;
          for (const t of [-0.5, 0, 0.5]) {
            const spread = (s.blur / 2) * t;
            withOpacity(s.opacity * 0.3 * opacity, 1, () => {
              pdf.setFillColor(0, 0, 0);
              rectPath(
                p.x + s.dx - spread, p.y + s.dy - spread, p.width + 2 * spread, p.height + 2 * spread,
                Math.max(0, p.radius + spread), 'F',
              );
            });
          }
        }
        const fill = resolveColor(p.fill);
        const stroke = p.stroke && p.strokeWidth ? resolveColor(p.stroke) : null;
        withOpacity(fill.a * opacity, (stroke?.a ?? 1) * opacity, () => {
          pdf.setFillColor(fill.r, fill.g, fill.b);
          if (stroke) {
            pdf.setDrawColor(stroke.r, stroke.g, stroke.b);
            pdf.setLineWidth(p.strokeWidth! * k);
          }
          rectPath(p.x, p.y, p.width, p.height, p.radius, fill.a === 0 ? 'S' : stroke ? 'FD' : 'F');
        });
        break;
      }
      case 'text': {
        const c = resolveColor(p.fill);
        const fontSize = (p.fontSize * k) / PT_IN_MM;
        pdf.setFont('helvetica', p.fontWeight >= 600 ? 'bold' : 'normal');
        pdf.setFontSize(fontSize);
        // Helvetica Bold is wider than Inter; shrink rather than spill out of the label
        let shrink = 1;
        if (p.maxWidth !== undefined) {
          const width = pdf.getTextWidth(p.text);
          const max = p.maxWidth * k;
          if (width > max && width > 0) {
            shrink = max / width;
            pdf.setFontSize(fontSize * shrink);
          }
        }
        // The baseline sits 0.35 em below the centre line (see baselineFor); keep smaller text centred
        const y = p.y - 0.35 * p.fontSize * (1 - shrink);
        withOpacity(c.a * (p.opacity ?? 1), 1, () => {
          pdf.setTextColor(c.r, c.g, c.b);
          pdf.text(p.text, X(p.x), Y(y), { align: p.align, baseline: 'alphabetic' });
        });
        break;
      }
    }
  }
};
