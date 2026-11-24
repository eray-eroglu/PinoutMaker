export type ResizeAnchor = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';

export interface ImageBox {
  /** Center of the image in world coordinates (images are drawn with a centered origin). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise. */
  rotation: number;
}

const MIN_SIZE = 10;

/** -1 / 0 / 1 direction of a handle along the image's local axes. */
export const anchorSigns = (anchor: ResizeAnchor): { sx: number; sy: number } => ({
  sx: anchor.includes('l') ? -1 : anchor.includes('r') ? 1 : 0,
  sy: anchor.includes('t') ? -1 : anchor.includes('b') ? 1 : 0,
});

const rotate = (x: number, y: number, rad: number) => ({
  x: x * Math.cos(rad) - y * Math.sin(rad),
  y: x * Math.sin(rad) + y * Math.cos(rad),
});

/** World position of a resize handle, taking the image rotation into account. */
export const getHandlePosition = (img: ImageBox, anchor: ResizeAnchor): { x: number; y: number } => {
  const { sx, sy } = anchorSigns(anchor);
  const rad = (img.rotation * Math.PI) / 180;
  const p = rotate((sx * img.width) / 2, (sy * img.height) / 2, rad);
  return { x: img.x + p.x, y: img.y + p.y };
};

/**
 * Aspect-ratio-preserving resize from a dragged handle. The opposite handle stays fixed.
 * Works in the image's local (unrotated) frame so rotated images resize correctly.
 *
 * Returns the new box and the world position the dragged handle should be pinned to.
 */
export const computeResize = (
  img: ImageBox,
  anchor: ResizeAnchor,
  dragX: number,
  dragY: number,
): { box: ImageBox; handle: { x: number; y: number } } => {
  const { sx, sy } = anchorSigns(anchor);
  const rad = (img.rotation * Math.PI) / 180;
  const aspect = img.width / img.height;

  // Drag point in the image's local frame (origin at the current center)
  const local = rotate(dragX - img.x, dragY - img.y, -rad);
  const fixed = { x: (-sx * img.width) / 2, y: (-sy * img.height) / 2 };

  let newW: number;
  if (sx !== 0 && sy !== 0) {
    const dw = (local.x - fixed.x) * sx;
    const dh = (local.y - fixed.y) * sy;
    newW = Math.abs(dw) > Math.abs(dh * aspect) ? dw : dh * aspect;
  } else if (sx !== 0) {
    newW = (local.x - fixed.x) * sx;
  } else {
    newW = (local.y - fixed.y) * sy * aspect;
  }
  newW = Math.max(MIN_SIZE, newW);
  let newH = newW / aspect;
  if (newH < MIN_SIZE) {
    newH = MIN_SIZE;
    newW = newH * aspect;
  }

  const centerLocal = { x: fixed.x + (sx * newW) / 2, y: fixed.y + (sy * newH) / 2 };
  const handleLocal = { x: fixed.x + sx * newW, y: fixed.y + sy * newH };
  const c = rotate(centerLocal.x, centerLocal.y, rad);
  const h = rotate(handleLocal.x, handleLocal.y, rad);

  return {
    box: { ...img, x: img.x + c.x, y: img.y + c.y, width: newW, height: newH },
    handle: { x: img.x + h.x, y: img.y + h.y },
  };
};
