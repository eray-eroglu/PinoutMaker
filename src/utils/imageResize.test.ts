import { describe, it, expect } from 'vitest';
import { computeResize, getHandlePosition } from './imageResize';
import type { ImageBox } from './imageResize';

const img: ImageBox = { x: 0, y: 0, width: 200, height: 100, rotation: 0 };

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x);
  expect(a.y).toBeCloseTo(b.y);
};

describe('getHandlePosition', () => {
  it('places handles on the unrotated corners', () => {
    close(getHandlePosition(img, 'br'), { x: 100, y: 50 });
    close(getHandlePosition(img, 't'), { x: 0, y: -50 });
  });

  it('rotates handles with the image', () => {
    // 90° clockwise: the local bottom-right corner (100, 50) ends up at (-50, 100)
    close(getHandlePosition({ ...img, rotation: 90 }, 'br'), { x: -50, y: 100 });
  });
});

describe('computeResize', () => {
  it('keeps the opposite corner fixed and the aspect ratio', () => {
    const { box, handle } = computeResize(img, 'br', 300, 150);
    expect(box.width).toBeCloseTo(400);
    expect(box.height).toBeCloseTo(200);
    close(getHandlePosition(box, 'tl'), { x: -100, y: -50 }); // unchanged
    close(handle, { x: 300, y: 150 });
  });

  it('resizes correctly when the image is rotated', () => {
    const rotated = { ...img, rotation: 90 };
    const fixedBefore = getHandlePosition(rotated, 'tl');
    // Fixed corner is at (50, -100); doubling the size puts the bottom-right
    // handle at local (300, 150), i.e. world (-150, 300) after the 90° rotation.
    const { box } = computeResize(rotated, 'br', -150, 300);
    expect(box.width).toBeCloseTo(400);
    expect(box.height).toBeCloseTo(200);
    close(getHandlePosition(box, 'tl'), fixedBefore);
  });

  it('edge handles scale proportionally from the opposite edge', () => {
    const { box } = computeResize(img, 'r', 300, 0);
    expect(box.width).toBeCloseTo(400);
    expect(box.height).toBeCloseTo(200);
    close(getHandlePosition(box, 'l'), { x: -100, y: 0 });
  });

  it('never shrinks below the minimum size', () => {
    const { box } = computeResize(img, 'br', -500, -500);
    expect(box.width).toBeGreaterThanOrEqual(10);
    expect(box.height).toBeGreaterThanOrEqual(10);
  });
});
