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

export const LineComponent: React.FC<LineComponentProps> = ({
  line,
  scale,
  isSelected,
  onSelect,
  onUpdate,
}) => {
  const lineRef = useRef<Konva.Line>(null);
  const startRef = useRef<Konva.Circle>(null);
  const endRef = useRef<Konva.Circle>(null);

  const invScale = 1 / scale;

  const updateLineVisuals = React.useCallback(() => {
    if (lineRef.current && startRef.current && endRef.current) {
      const p1 = startRef.current.position();
      const p2 = endRef.current.position();

      if (line.isAngled) {
        lineRef.current.points(calculateManhattanPath(p1.x, p1.y, p2.x, p2.y));
      } else {
        lineRef.current.points([p1.x, p1.y, p2.x, p2.y]);
      }
      
      lineRef.current.getLayer()?.batchDraw();
    }
  }, [line.isAngled]);

  useLayoutEffect(() => {
    updateLineVisuals();
  }, [line.x1, line.y1, line.x2, line.y2, line.isAngled, scale, updateLineVisuals]);

  const handleDragEnd = () => {
    const x1 = startRef.current?.x() ?? line.x1;
    const y1 = startRef.current?.y() ?? line.y1;
    const x2 = endRef.current?.x() ?? line.x2;
    const y2 = endRef.current?.y() ?? line.y2;
    
    // Save to history on drop
    onUpdate({
        ...line,
        x1, y1, x2, y2
    }, true);
  };

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    onSelect(line.id, e);
  };

  return (
    <Group>
      <Line
        ref={lineRef}
        points={line.isAngled
          ? calculateManhattanPath(line.x1, line.y1, line.x2, line.y2)
          : [line.x1, line.y1, line.x2, line.y2]}
        stroke={line.color}
        strokeWidth={line.thickness / scale}
        hitStrokeWidth={Math.max(15 / scale, line.thickness / scale)}
        onClick={handleSelect}
        onTap={handleSelect}
        lineCap="round"
        lineJoin="round"
        shadowColor={isSelected ? "black" : undefined}
        shadowBlur={isSelected ? 4 : 0}
        shadowOpacity={0.5}
      />

      {isSelected && (
        <>
          <Circle
            ref={startRef}
            x={line.x1}
            y={line.y1}
            radius={6 * invScale}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={2 * invScale}
            draggable
            onDragMove={updateLineVisuals}
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
          <Circle
            ref={endRef}
            x={line.x2}
            y={line.y2}
            radius={6 * invScale}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={2 * invScale}
            draggable
            onDragMove={updateLineVisuals}
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
        </>
      )}
    </Group>
  );
};
