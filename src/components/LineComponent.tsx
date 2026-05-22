import React, { useRef, useLayoutEffect } from 'react';
import { Line, Circle, Group } from 'react-konva';
import Konva from 'konva';
import type { LineData } from '../types';
import { calculateManhattanPath } from '../utils/lineUtils';

interface LineComponentProps {
  line: LineData;
  scale: number;
  isSelected: boolean;
  onSelect: (
    id: string,
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => void;
  onUpdate: (line: LineData, saveHistory?: boolean) => void;
}

/**
 * Build the full Konva points array for a multi-point polyline where every
 * consecutive pair of user-defined anchors is connected by an orthogonal
 * (Manhattan) two-segment path.
 */
function buildOrthogonalPoints(anchors: number[]): number[] {
  if (anchors.length < 4) return anchors;
  const result: number[] = [];
  for (let i = 0; i < anchors.length - 2; i += 2) {
    const x1 = anchors[i];
    const y1 = anchors[i + 1];
    const x2 = anchors[i + 2];
    const y2 = anchors[i + 3];
    const seg = calculateManhattanPath(x1, y1, x2, y2);
    if (i === 0) {
      result.push(...seg);
    } else {
      // Skip the first point of the segment (same as previous end point)
      result.push(...seg.slice(2));
    }
  }
  return result;
}

export const LineComponent: React.FC<LineComponentProps> = ({
  line,
  scale,
  isSelected,
  onSelect,
  onUpdate,
}) => {
  const lineRef = useRef<Konva.Line>(null);
  // One ref per anchor point (dynamic, kept as array)
  const handleRefs = useRef<(Konva.Circle | null)[]>([]);

  const invScale = 1 / scale;

  const anchors = line.points;

  const refreshLine = React.useCallback(() => {
    if (!lineRef.current) return;
    const liveAnchors: number[] = [];
    for (let i = 0; i < handleRefs.current.length; i++) {
      const h = handleRefs.current[i];
      if (h) {
        liveAnchors.push(h.x(), h.y());
      }
    }
    lineRef.current.points(buildOrthogonalPoints(liveAnchors));
    lineRef.current.getLayer()?.batchDraw();
  }, []);

  const handleDragEnd = () => {
    const liveAnchors: number[] = [];
    for (let i = 0; i < handleRefs.current.length; i++) {
      const h = handleRefs.current[i];
      if (h) {
        liveAnchors.push(h.x(), h.y());
      }
    }
    onUpdate({ ...line, points: liveAnchors }, true);
  };

  useLayoutEffect(() => {
    if (lineRef.current) {
      lineRef.current.points(buildOrthogonalPoints(anchors));
      lineRef.current.getLayer()?.batchDraw();
    }
  }, [anchors, scale]);

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    onSelect(line.id, e);
  };

  return (
    <Group>
      <Line
        ref={lineRef}
        points={buildOrthogonalPoints(anchors)}
        stroke={line.color}
        strokeWidth={line.thickness / scale}
        hitStrokeWidth={Math.max(15 / scale, line.thickness / scale)}
        onClick={handleSelect}
        onTap={handleSelect}
        lineCap="round"
        lineJoin="round"
        shadowColor={isSelected ? 'black' : undefined}
        shadowBlur={isSelected ? 4 : 0}
        shadowOpacity={0.5}
      />

      {isSelected &&
        Array.from({ length: anchors.length / 2 }, (_, i) => {
          const ax = anchors[i * 2];
          const ay = anchors[i * 2 + 1];
          return (
            <Circle
              key={i}
              ref={(el) => {
                handleRefs.current[i] = el;
              }}
              x={ax}
              y={ay}
              radius={6 * invScale}
              fill="white"
              stroke="#3b82f6"
              strokeWidth={2 * invScale}
              draggable
              onDragMove={refreshLine}
              onDragEnd={handleDragEnd}
              hitStrokeWidth={20 * invScale}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'grab';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
              onClick={handleSelect}
            />
          );
        })}
    </Group>
  );
};
