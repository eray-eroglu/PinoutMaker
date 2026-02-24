// src/utils/lineUtils.ts

/**
 * Calculates a Manhattan-style (L-shaped) path between two points.
 * Prioritizes the longer axis for the first segment to look cleaner.
 */
export const calculateManhattanPath = (x1: number, y1: number, x2: number, y2: number): number[] => {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal Dominant: (x1,y1) -> (x2, y1) -> (x2, y2)
    return [x1, y1, x2, y1, x2, y2];
  } else {
    // Vertical Dominant: (x1,y1) -> (x1, y2) -> (x2, y2)
    return [x1, y1, x1, y2, x2, y2];
  }
};

/**
 * Generates points for a PWM-style wavy line effect along the segments of a path.
 * 
 * @param points The original path points [x1, y1, x2, y2, ...]
 * @param scale Current zoom scale of the canvas (to keep wave size consistent visually)
 */
export const calculateWavePoints = (points: number[], scale: number): number[] => {
  const wavePoints: number[] = [];

  // Iterate over segments (3 points -> 2 segments for Manhattan usually)
  for (let i = 0; i < points.length - 2; i += 2) {
    const sx = points[i];
    const sy = points[i + 1];
    const ex = points[i + 2];
    const ey = points[i + 3];

    const segDx = ex - sx;
    const segDy = ey - sy;
    const dist = Math.sqrt(segDx * segDx + segDy * segDy);

    // Skip very short segments
    if (dist < 1) {
      continue;
    }

    const nx = segDx / dist;
    const ny = segDy / dist;
    const px = -ny;
    const py = nx;

    // Config
    const desiredWaveLength = 10;
    const amplitude = 3 / scale;
    
    // If segment is too short for a full wave cycle, just draw a line
    if (dist < (15 / scale)) {
      wavePoints.push(sx, sy);
      wavePoints.push(ex, ey);
      continue;
    }

    const cycleCount = Math.max(1, Math.round(dist / (desiredWaveLength / scale)));
    const waveLength = dist / cycleCount;
    // Step size for drawing the curve
    const step = Math.max(1 / scale, dist / (cycleCount * 8));

    // Add start point for first segment
    if (i === 0) wavePoints.push(sx, sy);

    for (let d = 0; d <= dist; d += step) {
      const waveOffset = amplitude * Math.sin((d / waveLength) * Math.PI * 2);
      const wx = sx + nx * d + px * waveOffset;
      const wy = sy + ny * d + py * waveOffset;
      wavePoints.push(wx, wy);
    }
    
    // Ensure accurate end point
    wavePoints.push(ex, ey);
  }

  return wavePoints;
};
