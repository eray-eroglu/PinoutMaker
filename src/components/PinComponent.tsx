import React, { useRef, useLayoutEffect, useEffect, useEffectEvent } from 'react';
import { Label, Tag, Text, Circle, Line } from 'react-konva';
import Konva from 'konva';
import type { PinData } from '../types';
import { calculateManhattanPath, calculateWavePoints } from '../utils/lineUtils';
import { isLightColor } from '../utils/colorUtils';

interface PinComponentProps {
  pin: PinData;
  /** World size of one label unit (project-wide). Labels, anchor and leader line scale with it. */
  labelScale: number;
  isSelected: boolean;
  onSelect: (
    id: string,
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => void;
  onUpdate: (pin: PinData, saveHistory?: boolean) => void;
  onDragMove?: (id: string, x: number, y: number, isCtrlPressed: boolean) => { x: number, y: number } | void;
  onDragEnd?: () => void;
  onDoubleClick: (id: string, currentText: string) => void;
  anchorSize: number;
}

export const PinComponent: React.FC<PinComponentProps> = ({
  pin,
  labelScale,
  isSelected,
  onSelect,
  onUpdate,
  onDragMove,
  onDragEnd,
  onDoubleClick,
  anchorSize,
}) => {
  const labelRef = useRef<Konva.Label>(null);
  const anchorRef = useRef<Konva.Circle>(null);
  const lineRef = useRef<Konva.Line>(null);
  const lastClickTimeRef = useRef(0);

  // Store the measured label size (label units) so CanvasStage can snap to label edges.
  const syncLabelMetrics = useEffectEvent(() => {
    if (!labelRef.current) return;
    const w = labelRef.current.width();
    const h = labelRef.current.height();
    if (pin.labelWidth !== w || pin.labelHeight !== h) {
      onUpdate({ ...pin, labelWidth: w, labelHeight: h }, false);
    }
  });

  // Run on mount and whenever the text (and therefore the label size) changes
  useEffect(() => {
    syncLabelMetrics();
  }, [pin.text]);

  const updateLine = React.useCallback(() => {
    if (labelRef.current && anchorRef.current && lineRef.current) {
      const labelNode = labelRef.current;
      const anchorNode = anchorRef.current;
      
      const width = labelNode.width();
      const height = labelNode.height();

      const labelX = labelNode.x();
      const labelY = labelNode.y();

      const centerX = labelX + (width * labelNode.scaleX()) / 2;
      const centerY = labelY + (height * labelNode.scaleY()) / 2;

      const anchorPos = anchorNode.position();

      // Set points via refs
      const x1 = centerX;
      const y1 = centerY;
      const x2 = anchorPos.x;
      const y2 = anchorPos.y;

      let points = calculateManhattanPath(x1, y1, x2, y2);

      // PWM Wave Effect
      if (pin.isPwm) {
        // The wave helper sizes the wave as 1/scale; pass 1/labelScale so it scales with the label
        points = calculateWavePoints(points, 1 / labelScale);
      }
      
      lineRef.current.points(points);
      
      // Force a layer redraw (prevents flickering and position drift)
      lineRef.current.getLayer()?.batchDraw(); 
    }
  }, [pin.isPwm, labelScale]); // Note: We read positions from refs directly (labelNode.x()) which is updated by Konva during drag.
                          // However, for initial render or props change, we need to trigger it.

  useLayoutEffect(() => {
    updateLine();
  }, [pin.x, pin.y, pin.targetX, pin.targetY, pin.text, labelScale, pin.isPwm, updateLine]);


  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Notify parent about new position during drag
    let snappedPos = { x: 0, y: 0};
    if (labelRef.current) {
        snappedPos.x = labelRef.current.x();
        snappedPos.y = labelRef.current.y();
        
        if (onDragMove) {
            const isCtrlPressed = e.evt.ctrlKey || e.evt.metaKey;
            const result = onDragMove(pin.id, snappedPos.x, snappedPos.y, isCtrlPressed);
            if (result && (result.x !== snappedPos.x || result.y !== snappedPos.y)) {
                // If snap occurred, update position immediately
                labelRef.current.position({ x: result.x, y: result.y });
                snappedPos = result;
            }
        }
    }
    
    updateLine();
  };

  const handleLabelDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (onDragEnd) onDragEnd(); // Clear guides
    onUpdate({
      ...pin,
      x: e.target.x(),
      y: e.target.y(),
      // Keep the measured size so CanvasStage can align right edges
      labelWidth: labelRef.current?.width() || pin.labelWidth,
      labelHeight: labelRef.current?.height() || pin.labelHeight,
    }, true);
  };

  const handleAnchorDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    // The label moves with its anchor
    const dx = e.target.x() - pin.targetX;
    const dy = e.target.y() - pin.targetY;
    onUpdate({
      ...pin,
      targetX: pin.targetX + dx,
      targetY: pin.targetY + dy,
      x: pin.x + dx,
      y: pin.y + dy,
    }, true);
  };

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    
    // Manual double click detection
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTimeRef.current;

    if (timeDiff < 300) {
      onDoubleClick(pin.id, pin.text);
      lastClickTimeRef.current = 0; // Reset
    } else {
      lastClickTimeRef.current = currentTime;
      onSelect(pin.id, e);
    }
  };


  return (
    <>
      <Line
        ref={lineRef}
        // Points are set via ref in updateLine
        stroke={pin.color}
        strokeWidth={2 * labelScale}
        listening={false}
      />

      <Circle
        ref={anchorRef}
        x={pin.targetX}
        y={pin.targetY}
        radius={Math.max(0.1, anchorSize)}
        fill={anchorSize === 0 ? 'transparent' : pin.color}
        draggable
        scaleX={labelScale}
        scaleY={labelScale}
        onDragMove={updateLine}
        onDragEnd={handleAnchorDragEnd}
        onClick={handleSelect}
        onTap={handleSelect}
        stroke={isSelected && anchorSize > 0 ? '#333' : undefined}
        strokeWidth={isSelected && anchorSize > 0 ? 2 : 0}
        strokeScaleEnabled={false}
        hitStrokeWidth={15}
      />

      <Label
        ref={labelRef}
        x={pin.x}
        y={pin.y}
        draggable
        scaleX={labelScale}
        scaleY={labelScale}
        onDragMove={handleDragMove}
        onDragEnd={handleLabelDragEnd}
        onClick={handleSelect}
        onTap={handleSelect}
      >
        <Tag
          fill={pin.color}
          cornerRadius={4}
          shadowColor='black'
          shadowBlur={isSelected ? 10 : 2}
          shadowOpacity={0.2}
          shadowOffset={{ x: 2, y: 2 }}
          stroke={isSelected ? '#333' : undefined}
          strokeWidth={isSelected ? 1.5 : 0}
          strokeScaleEnabled={false}
          listening={true}
          onClick={handleSelect}
          onTap={handleSelect}
        />
        <Text
          text={pin.text}
          onClick={handleSelect}
          onTap={handleSelect}
          fill={
            pin.textColor || (isLightColor(pin.color)
              ? 'black'
              : 'white')
          }
          padding={6}
          fontFamily='Inter, sans-serif'
          fontSize={12}
          fontStyle='600'
          width={pin.text.length <= 6 ? 60 : undefined} 
          align='center' 
          listening={true}
        />
      </Label>
    </>
  );
};