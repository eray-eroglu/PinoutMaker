/** A colour as 0–255 channels plus 0–1 alpha. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED: Record<string, Rgba> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

const clampByte = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

/**
 * Parses the colour notations the app produces (#rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(),
 * black/white/transparent). Returns null for anything else.
 */
export const parseColor = (color: string): Rgba | null => {
  const c = color.trim().toLowerCase();
  if (NAMED[c]) return { ...NAMED[c] };

  const hex = /^#([0-9a-f]{3,8})$/.exec(c)?.[1];
  if (hex && [3, 4, 6, 8].includes(hex.length)) {
    const full = hex.length <= 4 ? hex.split('').map(ch => ch + ch).join('') : hex;
    const byte = (i: number) => parseInt(full.slice(i * 2, i * 2 + 2), 16);
    return { r: byte(0), g: byte(1), b: byte(2), a: full.length === 8 ? byte(3) / 255 : 1 };
  }

  const fn = /^rgba?\(([^)]*)\)$/.exec(c)?.[1];
  if (fn) {
    const parts = fn.split(/[\s,/]+/).filter(Boolean);
    if (parts.length === 3 || parts.length === 4) {
      const [r, g, b] = parts.slice(0, 3).map(p => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p)));
      const alpha = parts[3];
      const a = alpha === undefined ? 1 : alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
      if ([r, g, b, a].every(Number.isFinite)) {
        return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: Math.min(1, Math.max(0, a)) };
      }
    }
  }
  return null;
};

let probe: CanvasRenderingContext2D | null | undefined;

/**
 * Like parseColor, but also understands any CSS colour name by letting the browser normalise it.
 * Unknown colours become opaque black, which is what a canvas does with an invalid fill.
 */
export const resolveColor = (color: string): Rgba => {
  const parsed = parseColor(color);
  if (parsed) return parsed;
  if (probe === undefined) {
    try {
      probe = document.createElement('canvas').getContext('2d');
    } catch {
      probe = null;
    }
  }
  if (probe) {
    probe.fillStyle = '#000000';
    probe.fillStyle = color;
    const normalised = parseColor(String(probe.fillStyle));
    if (normalised) return normalised;
  }
  return { ...NAMED.black };
};

/** #rrggbb without alpha (for formats that take opacity separately). */
export const toHex = ({ r, g, b }: Rgba): string =>
  '#' + [r, g, b].map(v => clampByte(v).toString(16).padStart(2, '0')).join('');
