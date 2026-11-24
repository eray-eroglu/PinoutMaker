import Konva from 'konva';
import type { LegendItem, LineData, PinData } from '../types';
import type { LoadedImage } from './project';
import { getContentBounds } from './viewport';

export interface ExportPdfInput {
  images: LoadedImage[];
  pins: PinData[];
  lines: LineData[];
  /** Current editor zoom (only used for the screen-sized padding). */
  scale: number;
  /** World size of one label unit. */
  labelScale: number;
  legendItems: LegendItem[];
  isLegendVisible: boolean;
}

const buildLegendGroup = (legendItems: LegendItem[], x: number, y: number, legendScale: number) => {
  const group = new Konva.Group({ x, y, scaleX: legendScale, scaleY: legendScale });

  group.add(new Konva.Rect({
    x: 0, y: 0, width: 192, height: 40 + legendItems.length * 20 + 40,
    fill: '#e6e6e6', stroke: '#d1d5db', strokeWidth: 1,
    cornerRadius: 4, shadowColor: 'black', shadowBlur: 4, shadowOpacity: 0.1,
  }));
  group.add(new Konva.Text({ x: 8, y: 8, text: 'TABLE', fontSize: 12, fontFamily: 'sans-serif', fill: '#4b5563' }));

  let currentY = 24;
  legendItems.forEach(item => {
    group.add(new Konva.Rect({
      x: 8, y: currentY, width: 176, height: 18,
      fill: item.color, stroke: 'rgba(0,0,0,0.5)', strokeWidth: 1,
    }));
    group.add(new Konva.Text({
      x: 8, y: currentY + 4, width: 176, text: item.text,
      fontSize: 10, fontFamily: 'sans-serif', fill: 'white', align: 'center',
    }));
    currentY += 20;
  });

  currentY += 8;
  group.add(new Konva.Line({ points: [8, currentY, 184, currentY], stroke: '#d1d5db', strokeWidth: 1 }));
  currentY += 8;
  group.add(new Konva.Line({ points: [8, currentY + 5, 28, currentY + 5], stroke: 'black', strokeWidth: 1 }));
  group.add(new Konva.Text({ x: 36, y: currentY, text: 'Standard Pin', fontSize: 10, fill: '#4b5563' }));
  currentY += 16;
  group.add(new Konva.Line({
    points: [8, currentY + 5, 13, currentY, 18, currentY + 5, 28, currentY + 5],
    stroke: 'black', strokeWidth: 1, tension: 0.4,
  }));
  group.add(new Konva.Text({ x: 36, y: currentY, text: 'PWM Pin', fontSize: 10, fill: '#4b5563' }));

  return group;
};

/** Maximum export dimension, to stay under browser canvas memory limits. */
const MAX_EXPORT_DIM = 2400;

/**
 * Renders the whole board (plus the legend, when visible) to an A4 PDF.
 * The stage is temporarily re-framed around the content and restored afterwards.
 * Returns false when there is nothing to export.
 */
export const exportPdf = async (stage: Konva.Stage, input: ExportPdfInput): Promise<boolean> => {
  const bounds = getContentBounds(input);
  if (!bounds) return false;
  let { minX, minY, maxX, maxY } = bounds;

  const padding = 50 / input.scale;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  // Legend sits to the left of the board, scaled with the board so it stays readable.
  const legendScale = Math.max(1, (maxX - minX) / 1000);
  const legendX = minX - 200 * legendScale - padding;
  const legendY = minY;
  if (input.isLegendVisible) {
    minX = legendX - padding;
    maxY = Math.max(maxY, legendY + 350 * legendScale + padding);
  }

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const fit = Math.min(1, MAX_EXPORT_DIM / Math.max(contentWidth, contentHeight));
  const exportWidth = Math.round(contentWidth * fit);
  const exportHeight = Math.round(contentHeight * fit);
  const exportScale = exportWidth / contentWidth;

  const old = { scale: stage.scaleX(), pos: stage.position(), width: stage.width(), height: stage.height() };
  const gridLayer = stage.findOne<Konva.Layer>('.grid-layer');
  const contentLayer = stage.findOne<Konva.Layer>('.content-layer');
  const tempNodes: Konva.Node[] = [];

  try {
    stage.scale({ x: exportScale, y: exportScale });
    stage.position({ x: -minX * exportScale, y: -minY * exportScale });
    stage.width(exportWidth);
    stage.height(exportHeight);
    gridLayer?.hide();

    if (contentLayer) {
      const bg = new Konva.Rect({ x: minX, y: minY, width: contentWidth, height: contentHeight, fill: 'white', listening: false });
      contentLayer.add(bg);
      bg.moveToBottom();
      tempNodes.push(bg);

      if (input.isLegendVisible) {
        const legend = buildLegendGroup(input.legendItems, legendX, legendY, legendScale);
        contentLayer.add(legend);
        tempNodes.push(legend);
      }
      contentLayer.draw();
    }

    const dataUrl = stage.toDataURL({
      pixelRatio: 1.5,
      x: 0,
      y: 0,
      width: exportWidth,
      height: exportHeight,
      mimeType: 'image/jpeg',
      quality: 0.95,
    });

    // jsPDF is large; load it only when the user actually exports
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF(exportWidth > exportHeight ? 'l' : 'p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const k = Math.min(pageWidth / exportWidth, pageHeight / exportHeight);
    const printWidth = exportWidth * k;
    const printHeight = exportHeight * k;
    pdf.addImage(dataUrl, 'JPEG', (pageWidth - printWidth) / 2, (pageHeight - printHeight) / 2, printWidth, printHeight);
    pdf.save('pinout-diagram.pdf');
    return true;
  } finally {
    tempNodes.forEach(n => n.destroy());
    gridLayer?.show();
    stage.scale({ x: old.scale, y: old.scale });
    stage.position(old.pos);
    stage.width(old.width);
    stage.height(old.height);
  }
};
