import type { Scene } from './scene';

/**
 * Paints the scene onto a 2D context, `pixelScale` device pixels per world unit, with the
 * scene's top-left at the canvas origin. Used for PNG export: drawing the scene directly (rather
 * than rasterising the SVG) uses the editor's own fonts, reuses the loaded image elements and
 * avoids the canvas tainting some browsers apply to SVG images.
 */
export const renderToCanvas = (
  scene: Scene,
  ctx: CanvasRenderingContext2D,
  pixelScale: number,
  background: string | null,
) => {
  const { bounds } = scene;
  ctx.save();
  ctx.setTransform(pixelScale, 0, 0, pixelScale, -bounds.x * pixelScale, -bounds.y * pixelScale);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  for (const p of scene.primitives) {
    ctx.save();
    switch (p.kind) {
      case 'image':
        if (!p.element) break;
        ctx.translate(p.cx, p.cy);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.drawImage(p.element, -p.width / 2, -p.height / 2, p.width, p.height);
        break;
      case 'polyline':
        if (p.points.length < 4) break;
        ctx.globalAlpha = p.opacity ?? 1;
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.strokeWidth;
        ctx.lineCap = p.cap;
        ctx.lineJoin = p.join;
        ctx.beginPath();
        ctx.moveTo(p.points[0], p.points[1]);
        for (let i = 2; i + 1 < p.points.length; i += 2) ctx.lineTo(p.points[i], p.points[i + 1]);
        ctx.stroke();
        break;
      case 'circle':
        ctx.fillStyle = p.fill;
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'rect':
        ctx.globalAlpha = p.opacity ?? 1;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.width, p.height, p.radius);
        if (p.shadow) {
          // Canvas shadows ignore the transform, so they are given in device pixels
          ctx.shadowColor = `rgba(0,0,0,${p.shadow.opacity})`;
          ctx.shadowBlur = p.shadow.blur * pixelScale;
          ctx.shadowOffsetX = p.shadow.dx * pixelScale;
          ctx.shadowOffsetY = p.shadow.dy * pixelScale;
        }
        ctx.fillStyle = p.fill;
        ctx.fill();
        if (p.stroke && p.strokeWidth) {
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = p.strokeWidth;
          ctx.stroke();
        }
        break;
      case 'text':
        ctx.globalAlpha = p.opacity ?? 1;
        ctx.font = `${p.fontWeight} ${p.fontSize}px ${p.fontFamily}`;
        ctx.fillStyle = p.fill;
        ctx.textAlign = p.align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(p.text, p.x, p.y, p.maxWidth);
        break;
    }
    ctx.restore();
  }
  ctx.restore();
};
