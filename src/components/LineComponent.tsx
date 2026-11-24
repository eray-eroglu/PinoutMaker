import React, { useRef, useLayoutEffect } from 'react';
import { Line, Circle, Group } from 'react-konva';
import Konva from 'konva';
import type { LineData } from '../types';
import { buildOrthogonalPoints } from '../utils/lineUtils';

interface LineComponentProps {
  line: LineData;
  scale: number;
  /** World size of one label unit; line thickness is expressed in label units. */
  labelScale: number;
  isSelected: boolean;
  onSelect: (
    id: string,
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => void;
  onUpdate: (line: LineData, saveHistory?: boolean) => void;
}

export const LineComponent: React.FC<LineComponentProps> = ({
  line,
  scale,
  labelScale,
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
        // Thickness scales with the board, like labels; the hit area stays finger-sized on screen
        strokeWidth={line.thickness * labelScale}
        hitStrokeWidth={Math.max(15 / scale, line.thickness * labelScale)}
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
