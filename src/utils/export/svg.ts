import type { Scene, SceneImage, SceneShadow } from './scene';
import { resolveColor, toHex } from './color';

export interface SvgOptions {
  /** Page colour behind everything; null leaves the SVG transparent. */
  background: string | null;
  /** URL embedded for an image, normally a data URL so the file is standalone. */
  imageHref: (image: SceneImage) => string | null;
}

/** Exported SVG text uses Inter when the viewer has it, else the usual sans-serif fallbacks. */
export const SVG_FONT_FAMILY = 'Inter, Helvetica, Arial, sans-serif';

/** Short, stable number formatting (world units are pixels; 3 decimals is plenty). */
const n = (v: number) => String(Math.round(v * 1000) / 1000);

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]!);

/** fill="…" plus fill-opacity when the colour has alpha, so every SVG viewer handles it. */
const paint = (attr: 'fill' | 'stroke', color: string) => {
  const rgba = resolveColor(color);
  if (rgba.a === 0) return `${attr}="none"`;
  return rgba.a < 1 ? `${attr}="${toHex(rgba)}" ${attr}-opacity="${n(rgba.a)}"` : `${attr}="${toHex(rgba)}"`;
};

const opacityAttr = (opacity: number | undefined) => (opacity !== undefined && opacity < 1 ? ` opacity="${n(opacity)}"` : '');

const pathData = (points: number[]) => {
  const parts: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) parts.push(`${i === 0 ? 'M' : 'L'}${n(points[i])} ${n(points[i + 1])}`);
  return parts.join(' ');
};

/**
 * Renders the scene as a standalone SVG document. Shadows use a blur/offset filter chain
 * (rather than feDropShadow) because more editors (Inkscape, Illustrator) understand it.
 */
export const renderSvg = (scene: Scene, options: SvgOptions): string => {
  const { x, y, width, height } = scene.bounds;
  const filters = new Map<string, string>();
  const filterFor = (s: SceneShadow) => {
    const key = [s.dx, s.dy, s.blur, s.opacity].map(n).join(',');
    let id = filters.get(key);
    if (!id) {
      id = `shadow${filters.size}`;
      filters.set(key, id);
    }
    return id;
  };

  const body: string[] = [];
  if (options.background) {
    body.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" ${paint('fill', options.background)}/>`);
  }

  for (const p of scene.primitives) {
    switch (p.kind) {
      case 'image': {
        const href = options.imageHref(p);
        if (!href) break;
        const transform = p.rotation ? ` transform="rotate(${n(p.rotation)} ${n(p.cx)} ${n(p.cy)})"` : '';
        body.push(
          `<image x="${n(p.cx - p.width / 2)}" y="${n(p.cy - p.height / 2)}" width="${n(p.width)}" height="${n(p.height)}"` +
          ` preserveAspectRatio="none"${transform} xlink:href="${escapeXml(href)}"/>`,
        );
        break;
      }
      case 'polyline':
        body.push(
          `<path d="${pathData(p.points)}" fill="none" ${paint('stroke', p.stroke)} stroke-width="${n(p.strokeWidth)}"` +
          ` stroke-linecap="${p.cap}" stroke-linejoin="${p.join}"${opacityAttr(p.opacity)}/>`,
        );
        break;
      case 'circle':
        body.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" ${paint('fill', p.fill)}/>`);
        break;
      case 'rect': {
        const radius = p.radius > 0 ? ` rx="${n(p.radius)}"` : '';
        const stroke = p.stroke && p.strokeWidth ? ` ${paint('stroke', p.stroke)} stroke-width="${n(p.strokeWidth)}"` : '';
        const filter = p.shadow ? ` filter="url(#${filterFor(p.shadow)})"` : '';
        body.push(
          `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.width)}" height="${n(p.height)}"${radius}` +
          ` ${paint('fill', p.fill)}${stroke}${opacityAttr(p.opacity)}${filter}/>`,
        );
        break;
      }
      case 'text':
        body.push(
          `<text x="${n(p.x)}" y="${n(p.y)}"${p.align === 'center' ? ' text-anchor="middle"' : ''}` +
          ` font-family="${SVG_FONT_FAMILY}" font-size="${n(p.fontSize)}" font-weight="${p.fontWeight}"` +
          ` ${paint('fill', p.fill)}${opacityAttr(p.opacity)}>${escapeXml(p.text)}</text>`,
        );
        break;
    }
  }

  const defs = [...filters].map(([key, id]) => {
    const [dx, dy, blur, opacity] = key.split(',');
    return (
      `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(Number(blur) / 2)}"/>` +
      `<feOffset dx="${dx}" dy="${dy}"/>` +
      `<feComponentTransfer><feFuncA type="linear" slope="${opacity}"/></feComponentTransfer>` +
      `<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>` +
      `</filter>`
    );
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"` +
    ` width="${n(width)}" height="${n(height)}" viewBox="${n(x)} ${n(y)} ${n(width)} ${n(height)}">`,
    '<title>Pinout</title>',
    ...(defs.length ? ['<defs>', ...defs, '</defs>'] : []),
    ...body,
    '</svg>',
    '',
  ].join('\n');
};
